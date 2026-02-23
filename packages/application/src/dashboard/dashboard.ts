import { db } from "@nyte/db/client";
import {
  calendarEvents,
  feedbackEntries,
  gateEvaluations,
  gmailDrafts,
  proposedActions,
  workItems,
} from "@nyte/db/schema";
import {
  isToolCallPayload,
  type ToolCallPayload,
  type WorkItemWithAction,
} from "@nyte/domain/actions";
import type { WorkItem } from "@nyte/domain/triage";
import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import { Effect } from "effect";

function toIsoString(value: Date): string {
  const timestamp = value.getTime();
  if (Number.isNaN(timestamp)) {
    throw new TypeError("Invalid date value.");
  }

  return value.toISOString();
}

function parseToolCallPayload(payloadJson: string): ToolCallPayload | null {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    return isToolCallPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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

export type DashboardDataOptions = {
  importantOnly?: boolean;
  includeSecondary?: boolean;
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

const SOURCES = ["Gmail", "Google Calendar"] as const;
const GATES = ["decision", "time", "relationship", "impact", "watch"] as const;
const FEEDBACK_RATINGS = ["positive", "negative"] as const;
const IMPORTANT_TIERS = ["critical", "important"] as const;

type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

type ActionPresentation = {
  type: WorkItem["type"];
  actionLabel: string;
  secondaryLabel: string;
  cta: WorkItem["cta"];
};

function isSource(value: string): value is WorkItem["source"] {
  return value === SOURCES[0] || value === SOURCES[1];
}

function isGate(value: string): value is WorkItem["gates"][number] {
  return (
    value === GATES[0] ||
    value === GATES[1] ||
    value === GATES[2] ||
    value === GATES[3] ||
    value === GATES[4]
  );
}

function toFeedbackRating(value: unknown): FeedbackRating | null {
  if (value === FEEDBACK_RATINGS[0]) {
    return value;
  }

  if (value === FEEDBACK_RATINGS[1]) {
    return value;
  }

  return null;
}

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

async function loadApprovalQueue({
  userId,
  importantOnly,
}: {
  userId: string;
  importantOnly: boolean;
}): Promise<WorkItemWithAction[]> {
  const whereClause = importantOnly
    ? and(
        eq(workItems.userId, userId),
        eq(workItems.status, "awaiting_approval"),
        or(
          inArray(workItems.importanceTier, IMPORTANT_TIERS),
          gte(workItems.importanceScore, 70)
        )
      )
    : and(eq(workItems.userId, userId), eq(workItems.status, "awaiting_approval"));

  const pendingRows = await db
    .select()
    .from(workItems)
    .where(whereClause)
    .orderBy(desc(workItems.priorityScore), desc(workItems.updatedAt));

  if (pendingRows.length === 0) {
    return [];
  }

  const workItemIds = pendingRows.map((row) => row.id);
  const [actionRows, gateRows] = await Promise.all([
    db
      .select({
        workItemId: proposedActions.workItemId,
        payloadJson: proposedActions.payloadJson,
      })
      .from(proposedActions)
      .where(inArray(proposedActions.workItemId, workItemIds)),
    db
      .select({
        workItemId: gateEvaluations.workItemId,
        gate: gateEvaluations.gate,
      })
      .from(gateEvaluations)
      .where(
        and(
          inArray(gateEvaluations.workItemId, workItemIds),
          eq(gateEvaluations.matched, true)
        )
      ),
  ]);

  const actionByItemId = new Map<string, ToolCallPayload>();
  for (const row of actionRows) {
    if (actionByItemId.has(row.workItemId)) {
      continue;
    }

    const payload = parseToolCallPayload(row.payloadJson);
    if (payload) {
      actionByItemId.set(row.workItemId, payload);
    }
  }

  const gatesByItemId = new Map<string, WorkItem["gates"]>();
  for (const row of gateRows) {
    if (!isGate(row.gate)) {
      continue;
    }

    const existing = gatesByItemId.get(row.workItemId) ?? [];
    existing.push(row.gate);
    gatesByItemId.set(row.workItemId, existing);
  }

  const queue: WorkItemWithAction[] = [];
  for (const row of pendingRows) {
    const payload = actionByItemId.get(row.id);
    if (!payload || !isSource(row.source)) {
      continue;
    }

    const presentation = presentationForAction(payload.kind);
    queue.push({
      id: row.id,
      type: presentation.type,
      source: row.source,
      actor: row.actor,
      summary: row.summary,
      context: row.context,
      preview: row.preview,
      actionLabel: presentation.actionLabel,
      secondaryLabel: presentation.secondaryLabel,
      cta: presentation.cta,
      gates: gatesByItemId.get(row.id) ?? [],
      priorityScore: row.priorityScore,
      proposedAction: payload,
    });
  }

  return queue;
}

async function loadDrafts(userId: string): Promise<DraftEntry[]> {
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
    .where(eq(workItems.userId, userId))
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

async function loadProcessed(userId: string): Promise<ProcessedEntry[]> {
  const feedbackRows = await db
    .select({
      workItemId: feedbackEntries.workItemId,
      rating: feedbackEntries.rating,
    })
    .from(feedbackEntries)
    .innerJoin(workItems, eq(feedbackEntries.workItemId, workItems.id))
    .where(eq(workItems.userId, userId));
  const feedbackByItem = new Map(
    feedbackRows.map((entry) => [
      entry.workItemId,
      toFeedbackRating(entry.rating),
    ])
  );

  const rows = await db
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.userId, userId),
        inArray(workItems.status, ["completed", "dismissed"])
      )
    )
    .orderBy(desc(workItems.updatedAt));

  if (rows.length === 0) {
    return [];
  }

  const workItemIds = rows.map((row) => row.id);
  const actionRows = await db
    .select({
      id: proposedActions.id,
      workItemId: proposedActions.workItemId,
      payloadJson: proposedActions.payloadJson,
    })
    .from(proposedActions)
    .where(inArray(proposedActions.workItemId, workItemIds));

  const actionByItemId = new Map<
    string,
    { id: string; payloadJson: string }
  >();
  for (const action of actionRows) {
    if (!actionByItemId.has(action.workItemId)) {
      actionByItemId.set(action.workItemId, {
        id: action.id,
        payloadJson: action.payloadJson,
      });
    }
  }

  const actionIds = Array.from(actionByItemId.values()).map((action) => action.id);
  const [draftRows, eventRows] =
    actionIds.length > 0
      ? await Promise.all([
          db
            .select({
              actionId: gmailDrafts.actionId,
              providerDraftId: gmailDrafts.providerDraftId,
            })
            .from(gmailDrafts)
            .where(inArray(gmailDrafts.actionId, actionIds)),
          db
            .select({
              actionId: calendarEvents.actionId,
              providerEventId: calendarEvents.providerEventId,
            })
            .from(calendarEvents)
            .where(inArray(calendarEvents.actionId, actionIds)),
        ])
      : [[], []];

  const draftByActionId = new Map(
    draftRows.map((row) => [row.actionId, row.providerDraftId])
  );
  const eventByActionId = new Map(
    eventRows.map((row) => [row.actionId, row.providerEventId])
  );

  const processed: ProcessedEntry[] = [];

  for (const row of rows) {
    const action = actionByItemId.get(row.id);
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

    const detail =
      payload.kind === "billing.queueRefund"
        ? "refund_queue • queued"
        : payload.kind === "gmail.createDraft"
          ? `gmail_drafts • ${draftByActionId.get(action.id) ?? "pending"}`
          : `google_calendar • ${eventByActionId.get(action.id) ?? "pending"}`;

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

export async function getDashboardData(
  userId: string,
  { importantOnly = false, includeSecondary = true }: DashboardDataOptions = {}
): Promise<DashboardData> {
  const approvalQueuePromise = loadApprovalQueue({ userId, importantOnly });
  const draftsPromise = includeSecondary
    ? loadDrafts(userId)
    : Promise.resolve([]);
  const processedPromise = includeSecondary
    ? loadProcessed(userId)
    : Promise.resolve([]);
  const [approvalQueue, drafts, processed] = await Promise.all([
    approvalQueuePromise,
    draftsPromise,
    processedPromise,
  ]);

  return {
    approvalQueue,
    drafts,
    processed,
  };
}

export const getDashboardDataProgram = (
  userId: string,
  options: DashboardDataOptions = {}
) => Effect.tryPromise(() => getDashboardData(userId, options));
