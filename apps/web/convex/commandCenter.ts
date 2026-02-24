import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

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
