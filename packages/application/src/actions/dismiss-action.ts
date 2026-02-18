import { db } from "@nyte/db/client";
import { proposedActions, workItems } from "@nyte/db/schema";
import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";

import { recordAuditLog } from "../audit/audit-log";
import { runApplicationEffect } from "../effect-runtime";
import { recordWorkItemRun } from "../run-log";

export type DismissErrorCode = "not_found" | "invalid_state";

export type DismissError = Data.TaggedEnum<{
  DismissNotFoundError: {
    code: "not_found";
    message: string;
  };
  DismissInvalidStateError: {
    code: "invalid_state";
    message: string;
  };
}>;

const DismissErrors = Data.taggedEnum<DismissError>();

function dismissNotFoundError(message: string): DismissError {
  return DismissErrors.DismissNotFoundError({
    code: "not_found",
    message,
  });
}

function dismissInvalidStateError(message: string): DismissError {
  return DismissErrors.DismissInvalidStateError({
    code: "invalid_state",
    message,
  });
}

export function isDismissError(error: unknown): error is DismissError {
  return (
    DismissErrors.$is("DismissNotFoundError")(error) ||
    DismissErrors.$is("DismissInvalidStateError")(error)
  );
}

export function dismissWorkItemProgram(itemId: string, now = new Date()) {
  return Effect.gen(function* () {
    const existing = yield* Effect.tryPromise(() =>
      db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1)
    );
    const item = existing.at(0);
    if (!item) {
      return yield* Effect.fail(dismissNotFoundError("Work item not found."));
    }

    if (item.status === "completed") {
      return yield* Effect.fail(
        dismissInvalidStateError("Completed work item cannot be dismissed.")
      );
    }

    if (item.status === "dismissed") {
      yield* Effect.tryPromise(() =>
        recordAuditLog({
          userId: item.userId,
          action: "action.dismiss.idempotent",
          targetType: "work_item",
          targetId: itemId,
          payload: {},
          now,
        })
      );

      return {
        itemId,
        status: "dismissed" as const,
        dismissedAt: now.toISOString(),
        idempotent: true,
      };
    }

    yield* Effect.tryPromise(() =>
      db.transaction(async (tx) => {
        await tx
          .update(workItems)
          .set({
            status: "dismissed",
            updatedAt: now,
          })
          .where(eq(workItems.id, itemId));

        await tx
          .update(proposedActions)
          .set({
            status: "dismissed",
            updatedAt: now,
          })
          .where(eq(proposedActions.workItemId, itemId));

        await recordWorkItemRun({
          workItemId: itemId,
          phase: "dismiss",
          status: "completed",
          now,
          executor: tx,
          events: [
            {
              kind: "action.dismissed",
              payload: {
                reason: "user dismissed from queue",
              },
            },
          ],
        });

        await recordAuditLog({
          userId: item.userId,
          action: "action.dismiss",
          targetType: "work_item",
          targetId: itemId,
          payload: {},
          now,
          executor: tx,
        });
      })
    );

    return {
      itemId,
      status: "dismissed" as const,
      dismissedAt: now.toISOString(),
      idempotent: false,
    };
  });
}

export async function dismissWorkItem(itemId: string, now = new Date()) {
  return runApplicationEffect(dismissWorkItemProgram(itemId, now));
}
