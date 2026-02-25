import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";

import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { recordAuditLog } from "./audit";
import { requireAuthUserId } from "./lib/auth";

const triggerTypeValidator = v.union(
  v.literal("manual"),
  v.literal("event"),
  v.literal("schedule")
);

const flowRunStatusValidator = v.union(
  v.literal("awaiting_follow_up"),
  v.literal("awaiting_approval")
);

function createFlowId(now: number): string {
  return `flow:${now}:${nanoid(8)}`;
}

type FlowRunResult = {
  runId: string;
  status: "awaiting_follow_up" | "awaiting_approval";
  followUpQuestion?: string;
  proposal: unknown;
};

export const getDefinitionForUser = internalQuery({
  args: {
    flowId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("flowDefinitions")
      .withIndex("by_flow_id", (q) => q.eq("flowId", args.flowId))
      .unique();

    if (!row || row.userId !== args.userId) {
      return null;
    }

    return {
      flowId: row.flowId,
      triggerType: row.triggerType,
      isActive: row.isActive,
    };
  },
});

export const recordTriggerAudit = internalMutation({
  args: {
    userId: v.string(),
    flowId: v.string(),
    triggerType: triggerTypeValidator,
    runId: v.string(),
    status: flowRunStatusValidator,
    now: v.number(),
  },
  handler: async (ctx, args) => {
    await recordAuditLog(ctx, {
      userId: args.userId,
      action: "flow.trigger",
      targetType: "flow",
      targetId: args.flowId,
      payload: {
        triggerType: args.triggerType,
        runId: args.runId,
        status: args.status,
      },
      now: args.now,
    });
  },
});

async function triggerFlowRun({
  ctx,
  userId,
  flowId,
  message,
}: {
  ctx: ActionCtx;
  userId: string;
  flowId: string;
  message: string;
}): Promise<FlowRunResult> {
  const flow = await ctx.runQuery(internal.flows.getDefinitionForUser, {
    flowId,
    userId,
  });
  if (!flow) {
    throw new ConvexError("Flow not found.");
  }
  if (!flow.isActive) {
    throw new ConvexError("Flow is paused.");
  }

  const runResult = await ctx.runAction(internal.agent.previewFromFlowTrigger, {
    userId,
    message,
    triggerType: flow.triggerType,
  });

  await ctx.runMutation(internal.flows.recordTriggerAudit, {
    userId,
    flowId: flow.flowId,
    triggerType: flow.triggerType,
    runId: runResult.runId,
    status: runResult.status,
    now: Date.now(),
  });

  return runResult;
}

export const createDefinition = mutation({
  args: {
    name: v.string(),
    triggerType: triggerTypeValidator,
    triggerConfigJson: v.optional(v.string()),
    stepsJson: v.optional(v.string()),
    approvalPolicy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();
    const flowId = createFlowId(now);
    await ctx.db.insert("flowDefinitions", {
      flowId,
      userId,
      name: args.name.trim() || "Untitled flow",
      triggerType: args.triggerType,
      triggerConfigJson: args.triggerConfigJson ?? "{}",
      stepsJson: args.stepsJson ?? "[]",
      approvalPolicy: args.approvalPolicy ?? "explicit_confirm",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return { flowId };
  },
});

export const listDefinitions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const rows = await ctx.db
      .query("flowDefinitions")
      .withIndex("by_user_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    return rows.map((row) => ({
      flowId: row.flowId,
      name: row.name,
      triggerType: row.triggerType,
      approvalPolicy: row.approvalPolicy,
      isActive: row.isActive,
      updatedAt: row.updatedAt,
    }));
  },
});

export const trigger = action({
  args: {
    flowId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<FlowRunResult> => {
    const userId = await requireAuthUserId(ctx);
    return triggerFlowRun({
      ctx,
      userId,
      flowId: args.flowId,
      message: args.message,
    });
  },
});

export const triggerInternal = internalAction({
  args: {
    flowId: v.string(),
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<FlowRunResult> => {
    return triggerFlowRun({
      ctx,
      userId: args.userId,
      flowId: args.flowId,
      message: args.message,
    });
  },
});

export const triggerScheduled = internalAction({
  args: {
    flowId: v.string(),
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<FlowRunResult> => {
    const preview = await ctx.runAction(internal.flows.triggerInternal, {
      flowId: args.flowId,
      userId: args.userId,
      message: args.message,
    });
    return preview;
  },
});

export const triggerEvent = internalAction({
  args: {
    flowId: v.string(),
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<FlowRunResult> => {
    const preview = await ctx.runAction(internal.flows.triggerInternal, {
      flowId: args.flowId,
      userId: args.userId,
      message: args.message,
    });
    return preview;
  },
});
