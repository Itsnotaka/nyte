import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";

import { api, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { recordAuditLog } from "./audit";
import { requireAuthUserId } from "./lib/auth";

const triggerTypeValidator = v.union(
  v.literal("manual"),
  v.literal("event"),
  v.literal("schedule")
);

function createFlowId(now: number): string {
  return `flow:${now}:${nanoid(8)}`;
}

async function triggerFlowRun({
  ctx,
  userId,
  flowId,
  message,
}: {
  ctx: MutationCtx;
  userId: string;
  flowId: string;
  message: string;
}): Promise<unknown> {
  const flow = await ctx.db
    .query("flowDefinitions")
    .withIndex("by_flow_id", (q) => q.eq("flowId", flowId))
    .unique();
  if (!flow || flow.userId !== userId) {
    throw new ConvexError("Flow not found.");
  }
  if (!flow.isActive) {
    throw new ConvexError("Flow is paused.");
  }

  const runResult = await ctx.runMutation(api.agent.run, {
    message,
  });
  const now = Date.now();
  await recordAuditLog(ctx, {
    userId,
    action: "flow.trigger",
    targetType: "flow",
    targetId: flow.flowId,
    payload: {
      triggerType: flow.triggerType,
      itemId:
        typeof runResult === "object" &&
        runResult !== null &&
        "itemId" in runResult
          ? ((runResult as { itemId?: string }).itemId ?? null)
          : null,
    },
    now,
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

export const trigger = mutation({
  args: {
    flowId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const userId = await requireAuthUserId(ctx);
    return triggerFlowRun({
      ctx,
      userId,
      flowId: args.flowId,
      message: args.message,
    });
  },
});

export const triggerInternal = internalMutation({
  args: {
    flowId: v.string(),
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
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
  handler: async (ctx, args): Promise<unknown> => {
    const preview: unknown = await ctx.runMutation(
      internal.flows.triggerInternal,
      {
        flowId: args.flowId,
        userId: args.userId,
        message: args.message,
      }
    );
    return preview;
  },
});

export const triggerEvent = internalAction({
  args: {
    flowId: v.string(),
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const preview: unknown = await ctx.runMutation(
      internal.flows.triggerInternal,
      {
        flowId: args.flowId,
        userId: args.userId,
        message: args.message,
      }
    );
    return preview;
  },
});
