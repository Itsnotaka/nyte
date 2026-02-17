import { db, ensureDbSchema, feedbackEntries, workItems } from "@nyte/db";
import { eq } from "@nyte/db/drizzle";

import { recordAuditLog } from "../audit/audit-log";
import { recordWorkflowRun } from "../workflow/workflow-log";

export type FeedbackRating = "positive" | "negative";

export class FeedbackError extends Error {
  readonly code: "not_found" | "invalid_state";

  constructor({
    code,
    message,
  }: {
    code: "not_found" | "invalid_state";
    message: string;
  }) {
    super(message);
    this.name = "FeedbackError";
    this.code = code;
  }
}

export async function recordFeedback(
  itemId: string,
  rating: FeedbackRating,
  note?: string,
  now = new Date(),
) {
  await ensureDbSchema();

  const existing = await db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1);
  const item = existing.at(0);
  if (!item) {
    throw new FeedbackError({
      code: "not_found",
      message: "Work item not found.",
    });
  }

  if (item.status !== "completed" && item.status !== "dismissed") {
    throw new FeedbackError({
      code: "invalid_state",
      message: "Feedback is only available for processed items.",
    });
  }

  await db.transaction(async (tx) => {
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

    await recordWorkflowRun({
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
  });

  return {
    itemId,
    rating,
    notedAt: now.toISOString(),
  };
}
