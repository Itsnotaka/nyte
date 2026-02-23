import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

type ProcessedEntry = {
  id: string;
  itemId: string;
  actor: string;
  action: string;
  status: "executed" | "dismissed";
  detail: string;
  at: number;
  feedback: "positive" | "negative" | null;
};

type DraftEntry = {
  id: string;
  actor: string;
  kind: "gmail.createDraft";
  to: string[];
  subject: string;
  body: string;
  providerDraftId: string;
};

const IMPORTANT_TIERS = new Set(["critical", "important"]);

function toPercent(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 1000) / 10;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return Math.round(((left + right) / 2) * 10) / 10;
}

export const getData = query({
  args: {
    importantOnly: v.optional(v.boolean()),
    includeSecondary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const importantOnly = args.importantOnly ?? false;
    const includeSecondary = args.includeSecondary ?? true;

    const rows = await ctx.db
      .query("queueItems")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const approvalQueue = rows
      .filter((item) => item.status === "awaiting_approval")
      .filter((item) => {
        if (!importantOnly) {
          return true;
        }
        const score = item.importanceScore ?? item.priorityScore;
        const tier = item.importanceTier;
        return score >= 70 || (tier ? IMPORTANT_TIERS.has(tier) : false);
      })
      .sort(
        (left, right) =>
          (right.importanceScore ?? right.priorityScore) -
            (left.importanceScore ?? left.priorityScore) ||
          right.updatedAt - left.updatedAt
      )
      .map((item) => ({
        id: item.workItemId,
        type: item.type,
        source: item.source,
        actor: item.actor,
        summary: item.summary,
        context: item.context,
        actionLabel: item.actionLabel,
        secondaryLabel: item.secondaryLabel,
        cta: item.cta,
        gates: item.gates,
        preview: item.preview,
        priorityScore: item.priorityScore,
        proposedAction: item.proposedAction,
      }));

    if (!includeSecondary) {
      return {
        approvalQueue,
        drafts: [] as DraftEntry[],
        processed: [] as ProcessedEntry[],
      };
    }

    const feedbackRows = await ctx.db
      .query("feedbackEntries")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const feedbackByItemId = new Map(
      feedbackRows.map((entry) => [entry.workItemId, entry.rating])
    );

    const drafts: DraftEntry[] = rows
      .filter(
        (item) =>
          item.status === "completed" &&
          item.actionStatus === "executed" &&
          item.actionDestination === "gmail_drafts" &&
          item.proposedAction.kind === "gmail.createDraft"
      )
      .map((item) => {
        const payload = item.proposedAction;
        if (payload.kind !== "gmail.createDraft") {
          return null;
        }

        return {
          id: item.workItemId,
          actor: item.actor,
          kind: "gmail.createDraft" as const,
          to: payload.to,
          subject: payload.subject,
          body: payload.body,
          providerDraftId: item.providerReference ?? "pending",
        };
      })
      .filter((entry): entry is DraftEntry => entry !== null);

    const processed: ProcessedEntry[] = rows
      .filter(
        (item) => item.status === "completed" || item.status === "dismissed"
      )
      .map((item) => {
        if (item.status === "dismissed") {
          return {
            id: `${item.workItemId}:dismissed`,
            itemId: item.workItemId,
            actor: item.actor,
            action: "Dismissed",
            status: "dismissed" as const,
            detail: "Dismissed from approval queue.",
            at: item.updatedAt,
            feedback: feedbackByItemId.get(item.workItemId) ?? null,
          };
        }

        const detail =
          item.actionDestination === "gmail_drafts"
            ? `gmail_drafts • ${item.providerReference ?? "pending"}`
            : item.actionDestination === "google_calendar"
              ? `google_calendar • ${item.providerReference ?? "pending"}`
              : "refund_queue • queued";

        return {
          id: `${item.workItemId}:processed`,
          itemId: item.workItemId,
          actor: item.actor,
          action: item.actionLabel,
          status: "executed" as const,
          detail,
          at: item.updatedAt,
          feedback: feedbackByItemId.get(item.workItemId) ?? null,
        };
      });

    return {
      approvalQueue,
      drafts,
      processed,
    };
  },
});

export const metricsSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const rows = await ctx.db
      .query("queueItems")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const feedbackRows = await ctx.db
      .query("feedbackEntries")
      .withIndex("by_user_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    let awaitingCount = 0;
    let completedCount = 0;
    let dismissedCount = 0;
    const decisionMinutes: number[] = [];

    const gateHitCounts = {
      decision: 0,
      time: 0,
      relationship: 0,
      impact: 0,
      watch: 0,
    };

    for (const row of rows) {
      if (row.status === "awaiting_approval") {
        awaitingCount += 1;
      } else if (row.status === "completed") {
        completedCount += 1;
      } else if (row.status === "dismissed") {
        dismissedCount += 1;
      }

      if (row.status === "completed" || row.status === "dismissed") {
        decisionMinutes.push(
          Math.round(((row.updatedAt - row.createdAt) / 60000) * 10) / 10
        );
      }

      for (const gate of row.gates) {
        gateHitCounts[gate] += 1;
      }
    }

    const totalSurfaced = awaitingCount + completedCount + dismissedCount;
    const decisions = completedCount + dismissedCount;
    const positiveFeedback = feedbackRows.filter(
      (entry) => entry.rating === "positive"
    ).length;

    return {
      generatedAt: now,
      awaitingCount,
      completedCount,
      dismissedCount,
      interruptionPrecision: toPercent(completedCount, decisions),
      approvalRate: toPercent(completedCount, totalSurfaced),
      medianDecisionMinutes: median(decisionMinutes),
      feedbackCount: feedbackRows.length,
      positiveFeedbackRate: toPercent(positiveFeedback, feedbackRows.length),
      gateHitCounts,
    };
  },
});
