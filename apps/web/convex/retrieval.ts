import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { embedTextForSearch, scoreKeywordOverlap } from "./lib/retrieval";

const sourceTypeValidator = v.union(
  v.literal("queue_item"),
  v.literal("workflow_event"),
  v.literal("feedback"),
  v.literal("audit")
);

function normalizeMetadata(
  metadataJson: string | undefined,
  fallback: Record<string, unknown>
): string {
  if (metadataJson && metadataJson.trim().length > 0) {
    return metadataJson;
  }
  return JSON.stringify(fallback);
}

async function upsertKnowledgeDoc(
  ctx: MutationCtx,
  args: {
    userId: string;
    sourceType: "queue_item" | "workflow_event" | "feedback" | "audit";
    sourceId: string;
    summary: string;
    metadataJson?: string;
    now?: number;
  }
) {
  const now = args.now ?? Date.now();
  const summary = args.summary.trim().slice(0, 5_000);
  if (summary.length === 0) {
    return null;
  }

  const existing = await ctx.db
    .query("commandKnowledge")
    .withIndex("by_user_source", (q) =>
      q
        .eq("userId", args.userId)
        .eq("sourceType", args.sourceType)
        .eq("sourceId", args.sourceId)
    )
    .unique();

  const embedding = embedTextForSearch(summary);
  const metadataJson = normalizeMetadata(args.metadataJson, {
    sourceType: args.sourceType,
    sourceId: args.sourceId,
  });

  if (existing) {
    await ctx.db.patch(existing._id, {
      summary,
      metadataJson,
      embedding,
      updatedAt: now,
    });
    return existing._id;
  }

  return ctx.db.insert("commandKnowledge", {
    userId: args.userId,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    summary,
    metadataJson,
    embedding,
    createdAt: now,
    updatedAt: now,
  });
}

export const upsertKnowledge = internalMutation({
  args: {
    userId: v.string(),
    sourceType: sourceTypeValidator,
    sourceId: v.string(),
    summary: v.string(),
    metadataJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await upsertKnowledgeDoc(ctx, args);
    return { id };
  },
});

export const upsertKnowledgeFromQueueItem = internalMutation({
  args: {
    queueItemId: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("queueItems")
      .withIndex("by_work_item_id", (q) => q.eq("workItemId", args.queueItemId))
      .unique();

    if (!item) {
      return { ok: false };
    }

    const summary = `${item.summary} ${item.preview}`.trim();
    await upsertKnowledgeDoc(ctx, {
      userId: item.userId,
      sourceType: "queue_item",
      sourceId: item.workItemId,
      summary,
      metadataJson: JSON.stringify({
        type: item.type,
        actionKind: item.proposedAction.kind,
      }),
      now: item.updatedAt,
    });
    return { ok: true };
  },
});

export const fetchByIds = internalQuery({
  args: {
    ids: v.array(v.id("commandKnowledge")),
  },
  handler: async (ctx, args) => {
    const rows = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc) {
        rows.push(doc);
      }
    }
    return rows;
  },
});

export const recentByUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 32, 1), 64);
    return ctx.db
      .query("commandKnowledge")
      .withIndex("by_user_updated", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const retrieveContextForCommand = internalAction({
  args: {
    userId: v.string(),
    queryText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const queryText = args.queryText.trim();
    if (queryText.length === 0) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 8, 1), 16);
    const vector = embedTextForSearch(queryText);
    const vectorResults = (await ctx.vectorSearch(
      "commandKnowledge",
      "by_embedding",
      {
        vector,
        limit,
        filter: (q) => q.eq("userId", args.userId),
      }
    )) as Array<{ _id: Id<"commandKnowledge">; _score: number }>;

    const vectorDocs = await ctx.runQuery(internal.retrieval.fetchByIds, {
      ids: vectorResults.map((row) => row._id),
    });
    const vectorScoreById = new Map(
      vectorResults.map((row) => [row._id, row._score] as const)
    );

    const recentDocs = await ctx.runQuery(internal.retrieval.recentByUser, {
      userId: args.userId,
      limit: limit * 4,
    });

    type Hit = {
      sourceType: string;
      sourceId: string;
      summary: string;
      score: number;
      whyRelevant: string;
    };
    const merged = new Map<string, Hit>();

    for (const doc of vectorDocs) {
      const score = vectorScoreById.get(doc._id) ?? 0;
      const key = `${doc.sourceType}:${doc.sourceId}`;
      merged.set(key, {
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        summary: doc.summary,
        score,
        whyRelevant: "semantic similarity",
      });
    }

    for (const doc of recentDocs) {
      const overlap = scoreKeywordOverlap(queryText, doc.summary);
      if (overlap <= 0) {
        continue;
      }
      const key = `${doc.sourceType}:${doc.sourceId}`;
      const existing = merged.get(key);
      const score = Math.max(existing?.score ?? 0, overlap * 0.9);
      merged.set(key, {
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        summary: doc.summary,
        score,
        whyRelevant:
          existing && existing.whyRelevant === "semantic similarity"
            ? "semantic + keyword overlap"
            : "keyword overlap",
      });
    }

    return [...merged.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
});
