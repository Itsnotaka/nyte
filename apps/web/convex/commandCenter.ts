import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

type ReviewRetrievalHit = {
  sourceType: string;
  sourceId: string;
  summary: string;
  score: number;
  whyRelevant: string;
};

type ReviewProposal = {
  type: "draft" | "calendar" | "refund";
  source: "Gmail" | "Google Calendar";
  summary: string;
  context: string;
  cta: "Send email" | "Create event" | "Queue refund";
  preview: string;
  riskLevel: "low" | "medium" | "high";
  suggestionText: string;
  payloadKind:
    | "gmail.createDraft"
    | "google-calendar.createEvent"
    | "billing.queueRefund";
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseReviewProposal(proposalJson: string): ReviewProposal {
  const parsed = asRecord(JSON.parse(proposalJson));
  if (!parsed) {
    throw new Error("Stored proposal is invalid.");
  }

  const type = parsed.type;
  const source = parsed.source;
  const cta = parsed.cta;
  const riskLevel = parsed.riskLevel;
  const summary = asNonEmptyString(parsed.summary);
  const context = asNonEmptyString(parsed.context);
  const preview = asNonEmptyString(parsed.preview);
  const suggestionText = asNonEmptyString(parsed.suggestionText);
  const payload = asRecord(parsed.payload);
  const payloadKind = payload?.kind;

  if (
    (type !== "draft" && type !== "calendar" && type !== "refund") ||
    (source !== "Gmail" && source !== "Google Calendar") ||
    (cta !== "Send email" && cta !== "Create event" && cta !== "Queue refund") ||
    (riskLevel !== "low" && riskLevel !== "medium" && riskLevel !== "high") ||
    !summary ||
    !context ||
    !preview ||
    !suggestionText ||
    (payloadKind !== "gmail.createDraft" &&
      payloadKind !== "google-calendar.createEvent" &&
      payloadKind !== "billing.queueRefund")
  ) {
    throw new Error("Stored proposal is incomplete.");
  }

  return {
    type,
    source,
    summary,
    context,
    cta,
    preview,
    riskLevel,
    suggestionText,
    payloadKind,
  };
}

function parseRetrievalHits(retrievalHitsJson: string): ReviewRetrievalHit[] {
  const parsed = JSON.parse(retrievalHitsJson);
  if (!Array.isArray(parsed)) {
    throw new Error("Stored retrieval hits are invalid.");
  }

  const hits: ReviewRetrievalHit[] = [];
  for (const entry of parsed) {
    const record = asRecord(entry);
    const sourceType = asNonEmptyString(record?.sourceType);
    const sourceId = asNonEmptyString(record?.sourceId);
    const summary = asNonEmptyString(record?.summary);
    const score = asNumber(record?.score);
    const whyRelevant = asNonEmptyString(record?.whyRelevant);
    if (!sourceType || !sourceId || !summary || score === null || !whyRelevant) {
      throw new Error("Stored retrieval hit is incomplete.");
    }

    hits.push({
      sourceType,
      sourceId,
      summary,
      score,
      whyRelevant,
    });
  }

  return hits;
}

export const reviewReplyList = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const runs = await ctx.db
      .query("commandRuns")
      .withIndex("by_user_status_updated", (q) =>
        q.eq("userId", userId).eq("status", "awaiting_approval")
      )
      .order("desc")
      .take(limit);

    return runs.map((run) => {
      const proposal = parseReviewProposal(run.proposalJson);
      return {
        runId: run.runId,
        status: run.status,
        summary: proposal.summary,
        context: proposal.context,
        preview: proposal.preview,
        cta: proposal.cta,
        source: proposal.source,
        type: proposal.type,
        riskLevel: proposal.riskLevel,
        suggestionText: proposal.suggestionText,
        payloadKind: proposal.payloadKind,
        inputText: run.inputText,
        updatedAt: run.updatedAt,
      };
    });
  },
});

export const reviewReplyDetail = query({
  args: {
    runId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const run = await ctx.db
      .query("commandRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();

    if (!run || run.userId !== userId || run.status !== "awaiting_approval") {
      return null;
    }

    const proposal = parseReviewProposal(run.proposalJson);
    return {
      runId: run.runId,
      status: run.status,
      summary: proposal.summary,
      context: proposal.context,
      preview: proposal.preview,
      cta: proposal.cta,
      source: proposal.source,
      type: proposal.type,
      riskLevel: proposal.riskLevel,
      suggestionText: proposal.suggestionText,
      payloadKind: proposal.payloadKind,
      inputText: run.inputText,
      updatedAt: run.updatedAt,
    };
  },
});

export const latestFollowUpRun = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const rows = await ctx.db
      .query("commandRuns")
      .withIndex("by_user_status_updated", (q) =>
        q.eq("userId", userId).eq("status", "awaiting_follow_up")
      )
      .order("desc")
      .take(1);

    const run = rows[0];
    if (!run) {
      return null;
    }

    const proposal = parseReviewProposal(run.proposalJson);
    const retrievalHits = parseRetrievalHits(run.retrievalHitsJson);
    return {
      runId: run.runId,
      status: run.status,
      followUpQuestion: run.followUpQuestion,
      proposal: {
        summary: proposal.summary,
        preview: proposal.preview,
        riskLevel: proposal.riskLevel,
        suggestionText: proposal.suggestionText,
        suggestedContactEmail: undefined,
        cta: proposal.cta,
        payload: { kind: proposal.payloadKind },
      },
      retrievalHits,
    };
  },
});

export const todoList = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const runs = await ctx.db
      .query("commandRuns")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
    const flows = await ctx.db
      .query("flowDefinitions")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    return {
      runs: runs.map((run) => ({
        runId: run.runId,
        inputText: run.inputText,
        status: run.status,
        riskLevel: run.riskLevel,
        followUpQuestion: run.followUpQuestion,
        lastError: run.lastError,
        updatedAt: run.updatedAt,
      })),
      flows: flows.map((flow) => ({
        flowId: flow.flowId,
        name: flow.name,
        triggerType: flow.triggerType,
        isActive: flow.isActive,
        updatedAt: flow.updatedAt,
      })),
    };
  },
});