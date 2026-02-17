import { eq } from "drizzle-orm";
import { db, ensureDbSchema, proposedActions, workItems } from "@nyte/db";

import { recordAuditLog } from "../audit/audit-log";
import { recordWorkflowRun } from "../workflow/workflow-log";

export class DismissError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DismissError";
  }
}

export async function dismissWorkItem(itemId: string, now = new Date()) {
  await ensureDbSchema();

  const existing = await db.select().from(workItems).where(eq(workItems.id, itemId)).limit(1);
  const item = existing.at(0);
  if (!item) {
    throw new DismissError("Work item not found.");
  }
  if (item.status === "completed") {
    throw new DismissError("Completed work item cannot be dismissed.");
  }
  if (item.status === "dismissed") {
    await recordAuditLog({
      userId: item.userId,
      action: "action.dismiss.idempotent",
      targetType: "work_item",
      targetId: itemId,
      payload: {},
      now,
    });
    return {
      itemId,
      status: "dismissed" as const,
      dismissedAt: now.toISOString(),
      idempotent: true,
    };
  }

  await db.transaction(async (tx) => {
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

    await recordWorkflowRun({
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
  });

  return {
    itemId,
    status: "dismissed" as const,
    dismissedAt: now.toISOString(),
    idempotent: false,
  };
}
