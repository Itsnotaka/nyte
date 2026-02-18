import { db } from "@nyte/db/client";
import { feedbackEntries, workItems } from "@nyte/db/schema";
import { eq } from "drizzle-orm";
import { Data, Effect } from "effect";

import { recordAuditLog } from "../audit/audit-log";
import { runApplicationEffect } from "../effect-runtime";
import { recordWorkItemRun } from "../run-log";

export type FeedbackRating = "positive" | "negative";
export type FeedbackErrorCode = "not_found" | "invalid_state";

export type FeedbackError = Data.TaggedEnum<{
  FeedbackNotFoundError: {
    code: "not_found";
    message: string;
  };
  FeedbackInvalidStateError: {
    code: "invalid_state";
    message: string;
  };
}>;

const FeedbackErrors = Data.taggedEnum<FeedbackError>();

function feedbackNotFoundError(message: string): FeedbackError {
  return FeedbackErrors.FeedbackNotFoundError({
    code: "not_found",
    message,
  });
}

function feedbackInvalidStateError(message: string): FeedbackError {
  return FeedbackErrors.FeedbackInvalidStateError({
    code: "invalid_state",
    message,
  });
}

export function isFeedbackError(error: unknown): error is FeedbackError {
  return (
    FeedbackErrors.$is("FeedbackNotFoundError")(error) ||
    FeedbackErrors.$is("FeedbackInvalidStateError")(error)
  );
}

export function recordFeedbackProgram(
  itemId: string,
  rating: FeedbackRating,
  note?: string,
  now = new Date()
) {
  return Effect.gen(function* () {
    const existing = yield* Effect.tryPromise(() =>
      db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1)
    );
    const item = existing.at(0);
    if (!item) {
      return yield* Effect.fail(feedbackNotFoundError("Work item not found."));
    }

    if (item.status !== "completed" && item.status !== "dismissed") {
      return yield* Effect.fail(
        feedbackInvalidStateError(
          "Feedback is only available for processed items."
        )
      );
    }

    yield* Effect.tryPromise(() =>
      db.transaction(async (tx) => {
        await tx
          .insert(feedbackEntries)
          .values({
            id: itemId,
            workItemId: itemId,
            rating,
            note: note?.trim() ? note.trim() : null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: feedbackEntries.id,
            set: {
              rating,
              note: note?.trim() ? note.trim() : null,
              updatedAt: now,
            },
          });

        await recordWorkItemRun({
          workItemId: itemId,
          phase: "feedback",
          status: "completed",
          now,
          executor: tx,
          events: [
            {
              kind: "feedback.recorded",
              payload: {
                rating,
                hasNote: Boolean(note?.trim()),
              },
            },
          ],
        });

        await recordAuditLog({
          userId: item.userId,
          action: "feedback.recorded",
          targetType: "work_item",
          targetId: itemId,
          payload: {
            rating,
          },
          now,
          executor: tx,
        });
      })
    );

    return {
      itemId,
      rating,
      notedAt: now.toISOString(),
    };
  });
}

export async function recordFeedback(
  itemId: string,
  rating: FeedbackRating,
  note?: string,
  now = new Date()
) {
  return runApplicationEffect(recordFeedbackProgram(itemId, rating, note, now));
}
