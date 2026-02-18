import { db } from "@nyte/db/client";
import {
  calendarEvents,
  gmailDrafts,
  proposedActions,
  workItems,
} from "@nyte/db/schema";
import { isToolCallPayload, type ToolCallPayload } from "@nyte/domain/actions";
import { executeProposedAction } from "@nyte/domain/execution";
import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";

import { recordAuditLog } from "../audit/audit-log";
import { runApplicationEffect } from "../effect-runtime";
import { recordWorkItemRun } from "../run-log";

export type ApprovalErrorCode =
  | "not_found"
  | "invalid_state"
  | "invalid_payload";

export type ApprovalError = Data.TaggedEnum<{
  ApprovalNotFoundError: {
    code: "not_found";
    message: string;
  };
  ApprovalInvalidStateError: {
    code: "invalid_state";
    message: string;
  };
  ApprovalInvalidPayloadError: {
    code: "invalid_payload";
    message: string;
  };
}>;

const ApprovalErrors = Data.taggedEnum<ApprovalError>();

function approvalNotFoundError(message: string): ApprovalError {
  return ApprovalErrors.ApprovalNotFoundError({
    code: "not_found",
    message,
  });
}

function approvalInvalidStateError(message: string): ApprovalError {
  return ApprovalErrors.ApprovalInvalidStateError({
    code: "invalid_state",
    message,
  });
}

function approvalInvalidPayloadError(message: string): ApprovalError {
  return ApprovalErrors.ApprovalInvalidPayloadError({
    code: "invalid_payload",
    message,
  });
}

export function isApprovalError(error: unknown): error is ApprovalError {
  return (
    ApprovalErrors.$is("ApprovalNotFoundError")(error) ||
    ApprovalErrors.$is("ApprovalInvalidStateError")(error) ||
    ApprovalErrors.$is("ApprovalInvalidPayloadError")(error)
  );
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError("Invalid date value.");
    }

    return value.toISOString();
  }

  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError("Invalid date value.");
    }

    return parsed.toISOString();
  }

  throw new TypeError("Invalid date value.");
}

function parseToolCallPayload(payloadJson: string): ToolCallPayload | null {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    return isToolCallPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function resolveExecutionSnapshot(
  proposalId: string,
  payload: ToolCallPayload,
  updatedAt: unknown,
  idempotencyKey?: string
) {
  if (payload.kind === "gmail.createDraft") {
    const draftRows = await db
      .select()
      .from(gmailDrafts)
      .where(eq(gmailDrafts.actionId, proposalId))
      .limit(1);
    const draft = draftRows.at(0);
    return {
      status: "executed" as const,
      destination: "gmail_drafts" as const,
      providerReference:
        draft?.providerDraftId ??
        executeProposedAction(payload, new Date(toIsoString(updatedAt)), {
          idempotencyKey,
        }).providerReference,
      idempotencyKey:
        idempotencyKey ??
        executeProposedAction(payload, new Date(toIsoString(updatedAt)))
          .idempotencyKey,
      executedAt: toIsoString(draft?.syncedAt ?? updatedAt),
    };
  }

  if (payload.kind === "google-calendar.createEvent") {
    const eventRows = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.actionId, proposalId))
      .limit(1);
    const event = eventRows.at(0);
    return {
      status: "executed" as const,
      destination: "google_calendar" as const,
      providerReference:
        event?.providerEventId ??
        executeProposedAction(payload, new Date(toIsoString(updatedAt)), {
          idempotencyKey,
        }).providerReference,
      idempotencyKey:
        idempotencyKey ??
        executeProposedAction(payload, new Date(toIsoString(updatedAt)))
          .idempotencyKey,
      executedAt: toIsoString(event?.syncedAt ?? updatedAt),
    };
  }

  const execution = executeProposedAction(
    payload,
    new Date(toIsoString(updatedAt)),
    {
      idempotencyKey,
    }
  );
  return execution;
}

export function approveWorkItemProgram(
  itemId: string,
  now = new Date(),
  idempotencyKey?: string,
  payloadOverride?: ToolCallPayload
) {
  return Effect.gen(function* () {
    const itemRows = yield* Effect.tryPromise(() =>
      db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1)
    );
    const workItem = itemRows.at(0);
    if (!workItem) {
      return yield* Effect.fail(approvalNotFoundError("Work item not found."));
    }

    if (workItem.status === "dismissed") {
      return yield* Effect.fail(
        approvalInvalidStateError(
          "Work item is dismissed and cannot be approved."
        )
      );
    }

    const action = yield* Effect.tryPromise(() =>
      db
        .select()
        .from(proposedActions)
        .where(eq(proposedActions.workItemId, itemId))
        .limit(1)
    );

    const proposal = action.at(0);
    if (!proposal) {
      return yield* Effect.fail(
        approvalNotFoundError("No proposed action found for work item.")
      );
    }

    const payload = parseToolCallPayload(proposal.payloadJson);
    if (!payload) {
      return yield* Effect.fail(
        approvalInvalidPayloadError("Proposed action payload is invalid.")
      );
    }

    const payloadForExecution = payloadOverride ?? payload;

    if (workItem.status === "completed" || proposal.status === "executed") {
      const execution = yield* Effect.tryPromise(() =>
        resolveExecutionSnapshot(
          proposal.id,
          payload,
          workItem.updatedAt,
          idempotencyKey
        )
      );

      yield* Effect.tryPromise(() =>
        recordAuditLog({
          userId: workItem.userId,
          action: "action.approve.idempotent",
          targetType: "work_item",
          targetId: itemId,
          payload: {
            idempotencyKey: execution.idempotencyKey,
          },
          now,
        })
      );

      return {
        itemId,
        payload,
        execution,
        idempotent: true,
      };
    }

    const execution = executeProposedAction(payloadForExecution, now, {
      idempotencyKey,
    });

    yield* Effect.tryPromise(() =>
      db.transaction(async (tx) => {
        await tx
          .update(proposedActions)
          .set({
            actionType: payloadForExecution.kind,
            payloadJson: JSON.stringify(payloadForExecution),
            status: "executed",
            updatedAt: now,
          })
          .where(eq(proposedActions.id, proposal.id));

        if (execution.destination === "gmail_drafts") {
          await tx
            .insert(gmailDrafts)
            .values({
              id: `${proposal.id}:gmail`,
              actionId: proposal.id,
              providerDraftId: execution.providerReference,
              threadId: itemId,
              syncedAt: now,
            })
            .onConflictDoUpdate({
              target: gmailDrafts.id,
              set: {
                providerDraftId: execution.providerReference,
                syncedAt: now,
              },
            });
        }

        if (execution.destination === "google_calendar") {
          const startsAt =
            payloadForExecution.kind === "google-calendar.createEvent"
              ? new Date(payloadForExecution.startsAt)
              : now;
          const endsAt =
            payloadForExecution.kind === "google-calendar.createEvent"
              ? new Date(payloadForExecution.endsAt)
              : now;

          await tx
            .insert(calendarEvents)
            .values({
              id: `${proposal.id}:calendar`,
              actionId: proposal.id,
              providerEventId: execution.providerReference,
              startsAt,
              endsAt,
              syncedAt: now,
            })
            .onConflictDoUpdate({
              target: calendarEvents.id,
              set: {
                providerEventId: execution.providerReference,
                startsAt,
                endsAt,
                syncedAt: now,
              },
            });
        }

        await tx
          .update(workItems)
          .set({
            status: "completed",
            updatedAt: now,
          })
          .where(eq(workItems.id, itemId));

        await recordWorkItemRun({
          workItemId: itemId,
          phase: "approve",
          status: "completed",
          now,
          executor: tx,
          events: [
            {
              kind: "action.approved",
              payload: {
                actionId: proposal.id,
                kind: payloadForExecution.kind,
              },
            },
            {
              kind: "action.executed",
              payload: {
                destination: execution.destination,
                providerReference: execution.providerReference,
                idempotencyKey: execution.idempotencyKey,
              },
            },
          ],
        });

        await recordAuditLog({
          userId: workItem.userId,
          action: "action.approve",
          targetType: "work_item",
          targetId: itemId,
          payload: {
            destination: execution.destination,
            providerReference: execution.providerReference,
            idempotencyKey: execution.idempotencyKey,
          },
          now,
          executor: tx,
        });
      })
    );

    return {
      itemId,
      payload: payloadForExecution,
      execution,
      idempotent: false,
    };
  });
}

export async function approveWorkItem(
  itemId: string,
  now = new Date(),
  idempotencyKey?: string,
  payloadOverride?: ToolCallPayload
) {
  return runApplicationEffect(
    approveWorkItemProgram(itemId, now, idempotencyKey, payloadOverride)
  );
}
