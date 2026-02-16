import { eq } from "drizzle-orm";
import { db, ensureDbSchema, proposedActions, workItems } from "@workspace/db";
import { recordWorkflowRun } from "./workflow-log";

export class DismissError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DismissError";
  }
}

export async function dismissWorkItem(itemId: string, now = new Date()) {
  await ensureDbSchema();

  const existing = await db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1);
  if (!existing.at(0)) {
    throw new DismissError("Work item not found.");
  }

  await db
    .update(workItems)
    .set({
      status: "dismissed",
      updatedAt: now,
    })
    .where(eq(workItems.id, itemId));

  await db
    .update(proposedActions)
    .set({
      status: "dismissed",
      updatedAt: now,
    })
    .where(eq(proposedActions.workItemId, itemId));

  await recordWorkflowRun({
    workItemId: itemId,
    phase: "dismiss",
    status: "completed",
    now,
    events: [
      {
        kind: "action.dismissed",
        payload: {
          reason: "user dismissed from queue",
        },
      },
    ],
  });

  return {
    itemId,
    status: "dismissed" as const,
    dismissedAt: now.toISOString(),
  };
}
