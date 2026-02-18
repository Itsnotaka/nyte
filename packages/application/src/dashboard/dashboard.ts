import { db } from "@nyte/db/client";
import {
  calendarEvents,
  feedbackEntries,
  gateEvaluations,
  gmailDrafts,
  proposedActions,
  workItems,
} from "@nyte/db/schema";
import type { ToolCallPayload, WorkItemWithAction } from "@nyte/domain/actions";
import type { WorkItem } from "@nyte/domain/triage";
import { and, desc, eq, inArray } from "drizzle-orm";

import { parseToolCallPayload } from "../shared/payload";
import { toIsoString } from "../shared/time";

export type ProcessedEntry = {
  id: string;
  itemId: string;
  actor: string;
  action: string;
  status: "executed" | "dismissed";
  detail: string;
  at: string;
  feedback: "positive" | "negative" | null;
};

export type DashboardData = {
  approvalQueue: WorkItemWithAction[];
  drafts: DraftEntry[];
  processed: ProcessedEntry[];
};

export type DraftEntry = {
  id: string;
  actor: string;
  kind: "gmail.createDraft";
  to: string[];
  subject: string;
  body: string;
  providerDraftId: string;
};

type ActionPresentation = {
  type: WorkItem["type"];
  actionLabel: string;
  secondaryLabel: string;
  cta: WorkItem["cta"];
};

function presentationForAction(
  kind: ToolCallPayload["kind"]
): ActionPresentation {
  if (kind === "google-calendar.createEvent") {
    return {
      type: "calendar",
      actionLabel: "Open scheduling form",
      secondaryLabel: "Decline",
      cta: "Create event",
    };
  }

  if (kind === "billing.queueRefund") {
    return {
      type: "refund",
      actionLabel: "Prepare refund response",
      secondaryLabel: "Dismiss",
      cta: "Queue refund",
    };
  }

  return {
    type: "draft",
    actionLabel: "Review draft reply",
    secondaryLabel: "Dismiss",
    cta: "Save draft",
  };
}

async function loadApprovalQueue(): Promise<WorkItemWithAction[]> {
  const pendingRows = await db
    .select()
    .from(workItems)
    .where(eq(workItems.status, "awaiting_approval"))
    .orderBy(desc(workItems.priorityScore), desc(workItems.updatedAt));

  const queue: WorkItemWithAction[] = [];

  for (const row of pendingRows) {
    const actionRow = await db
      .select()
      .from(proposedActions)
      .where(eq(proposedActions.workItemId, row.id))
      .limit(1);
    const proposal = actionRow.at(0);
    if (!proposal) {
      continue;
    }

    const payload = parseToolCallPayload(proposal.payloadJson);
    if (!payload) {
      continue;
    }
    const presentation = presentationForAction(payload.kind);

    const gateRows = await db
      .select({
        gate: gateEvaluations.gate,
      })
      .from(gateEvaluations)
      .where(
        and(
          eq(gateEvaluations.workItemId, row.id),
          eq(gateEvaluations.matched, true)
        )
      );

    queue.push({
      id: row.id,
      type: presentation.type,
      source: row.source as WorkItem["source"],
      actor: row.actor,
      summary: row.summary,
      context: row.context,
      preview: row.preview,
      actionLabel: presentation.actionLabel,
      secondaryLabel: presentation.secondaryLabel,
      cta: presentation.cta,
      gates: gateRows.map((gate) => gate.gate as WorkItem["gates"][number]),
      priorityScore: row.priorityScore,
      proposedAction: payload,
    });
  }

  return queue;
}

async function loadDrafts(): Promise<DraftEntry[]> {
  const rows = await db
    .select({
      id: workItems.id,
      actor: workItems.actor,
      payloadJson: proposedActions.payloadJson,
      providerDraftId: gmailDrafts.providerDraftId,
    })
    .from(gmailDrafts)
    .innerJoin(proposedActions, eq(gmailDrafts.actionId, proposedActions.id))
    .innerJoin(workItems, eq(proposedActions.workItemId, workItems.id))
    .orderBy(desc(gmailDrafts.syncedAt));

  return rows
    .map((row) => {
      const payload = parseToolCallPayload(row.payloadJson);
      if (!payload) {
        return null;
      }

      if (payload.kind !== "gmail.createDraft") {
        return null;
      }

      return {
        id: row.id,
        actor: row.actor,
        kind: payload.kind,
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        providerDraftId: row.providerDraftId,
      };
    })
    .filter((entry): entry is DraftEntry => entry !== null);
}

async function loadProcessed(): Promise<ProcessedEntry[]> {
  const feedbackRows = await db.select().from(feedbackEntries);
  const feedbackByItem = new Map(
    feedbackRows.map((entry) => [
      entry.workItemId,
      (entry.rating as "positive" | "negative" | null) ?? null,
    ])
  );

  const rows = await db
    .select()
    .from(workItems)
    .where(inArray(workItems.status, ["completed", "dismissed"]))
    .orderBy(desc(workItems.updatedAt));

  const processed: ProcessedEntry[] = [];

  for (const row of rows) {
    const actionRow = await db
      .select()
      .from(proposedActions)
      .where(eq(proposedActions.workItemId, row.id))
      .limit(1);
    const action = actionRow.at(0);
    if (!action) {
      continue;
    }

    if (row.status === "dismissed") {
      processed.push({
        id: `${row.id}:dismissed`,
        itemId: row.id,
        actor: row.actor,
        action: "Dismissed",
        status: "dismissed",
        detail: "Dismissed from approval queue.",
        at: toIsoString(row.updatedAt),
        feedback: feedbackByItem.get(row.id) ?? null,
      });
      continue;
    }

    const payload = parseToolCallPayload(action.payloadJson);
    if (!payload) {
      processed.push({
        id: `${row.id}:${action.id}`,
        itemId: row.id,
        actor: row.actor,
        action: "Unknown action",
        status: "executed",
        detail: "action_payload • unreadable",
        at: toIsoString(row.updatedAt),
        feedback: feedbackByItem.get(row.id) ?? null,
      });
      continue;
    }

    let detail = "Action executed.";

    if (payload.kind === "gmail.createDraft") {
      const draftRows = await db
        .select()
        .from(gmailDrafts)
        .where(eq(gmailDrafts.actionId, action.id))
        .limit(1);
      detail = `gmail_drafts • ${draftRows.at(0)?.providerDraftId ?? "pending"}`;
    } else if (payload.kind === "google-calendar.createEvent") {
      const eventRows = await db
        .select()
        .from(calendarEvents)
        .where(eq(calendarEvents.actionId, action.id))
        .limit(1);
      detail = `google_calendar • ${eventRows.at(0)?.providerEventId ?? "pending"}`;
    } else if (payload.kind === "billing.queueRefund") {
      detail = "refund_queue • queued";
    }

    processed.push({
      id: `${row.id}:${action.id}`,
      itemId: row.id,
      actor: row.actor,
      action: presentationForAction(payload.kind).actionLabel,
      status: "executed",
      detail,
      at: toIsoString(row.updatedAt),
      feedback: feedbackByItem.get(row.id) ?? null,
    });
  }

  return processed;
}

export async function getDashboardData(): Promise<DashboardData> {
  const [approvalQueue, drafts, processed] = await Promise.all([
    loadApprovalQueue(),
    loadDrafts(),
    loadProcessed(),
  ]);

  return {
    approvalQueue,
    drafts,
    processed,
  };
}
