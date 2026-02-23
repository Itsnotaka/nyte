import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

const MIN_IMPORTANT_PRIORITY = 70;

export const feed = query({
  args: {
    includeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const items = await ctx.db
      .query("queueItems")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "awaiting_approval")
      )
      .collect();

    const includeAll = args.includeAll ?? false;
    const filtered = includeAll
      ? items
      : items.filter(
          (item) =>
            (item.importanceScore ?? item.priorityScore) >=
            MIN_IMPORTANT_PRIORITY
        );

    const approvalQueue = filtered
      .slice()
      .sort(
        (a, b) => b.priorityScore - a.priorityScore || b.updatedAt - a.updatedAt
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

    return {
      approvalQueue,
    };
  },
});
