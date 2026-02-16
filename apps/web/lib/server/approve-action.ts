import { eq } from "drizzle-orm";
import {
  calendarEvents,
  db,
  ensureDbSchema,
  gmailDrafts,
  proposedActions,
  workItems,
} from "@workspace/db";

import { type ToolCallPayload } from "../domain/actions";
import { executeProposedAction } from "../domain/execution";

export class ApprovalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalError";
  }
}

function parsePayload(payloadJson: string): ToolCallPayload {
  return JSON.parse(payloadJson) as ToolCallPayload;
}

export async function approveWorkItem(itemId: string, now = new Date()) {
  await ensureDbSchema();

  const action = await db
    .select()
    .from(proposedActions)
    .where(eq(proposedActions.workItemId, itemId))
    .limit(1);

  const proposal = action.at(0);
  if (!proposal) {
    throw new ApprovalError("No proposed action found for work item.");
  }

  const payload = parsePayload(proposal.payloadJson);
  const execution = executeProposedAction(payload, now);

  await db
    .update(proposedActions)
    .set({
      status: "executed",
      updatedAt: now,
    })
    .where(eq(proposedActions.id, proposal.id));

  if (execution.destination === "gmail_drafts") {
    await db
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
      payload.kind === "google-calendar.createEvent" ? new Date(payload.startsAt) : now;
    const endsAt = payload.kind === "google-calendar.createEvent" ? new Date(payload.endsAt) : now;

    await db
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

  await db
    .update(workItems)
    .set({
      status: "completed",
      updatedAt: now,
    })
    .where(eq(workItems.id, itemId));

  return {
    itemId,
    payload,
    execution,
  };
}
