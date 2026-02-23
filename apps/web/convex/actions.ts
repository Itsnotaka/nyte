import { ConvexError, v } from "convex/values";

import { mutation, type MutationCtx } from "./_generated/server";
import { requireAuthUserId } from "./lib/auth";

const toolCallPayloadValidator = v.union(
  v.object({
    kind: v.literal("gmail.createDraft"),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
  }),
  v.object({
    kind: v.literal("google-calendar.createEvent"),
    title: v.string(),
    startsAt: v.string(),
    endsAt: v.string(),
    attendees: v.array(v.string()),
    description: v.string(),
  }),
  v.object({
    kind: v.literal("billing.queueRefund"),
    customerName: v.string(),
    amount: v.number(),
    currency: v.literal("USD"),
    reason: v.string(),
  })
);

async function loadItemById(ctx: MutationCtx, userId: string, itemId: string) {
  const item = await ctx.db
    .query("queueItems")
    .withIndex("by_work_item_id", (q) => q.eq("workItemId", itemId))
    .unique();

  if (!item || item.userId !== userId) {
    throw new ConvexError("Item not found.");
  }

  return item;
}

export const approve = mutation({
  args: {
    itemId: v.string(),
    payloadOverride: v.optional(toolCallPayloadValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const item = await loadItemById(ctx, userId, args.itemId);
    const now = Date.now();

    await ctx.db.patch(item._id, {
      status: "completed",
      proposedAction: args.payloadOverride ?? item.proposedAction,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const dismiss = mutation({
  args: {
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const item = await loadItemById(ctx, userId, args.itemId);
    await ctx.db.patch(item._id, {
      status: "dismissed",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const feedback = mutation({
  args: {
    itemId: v.string(),
    rating: v.union(v.literal("positive"), v.literal("negative")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await loadItemById(ctx, userId, args.itemId);

    const existing = await ctx.db
      .query("feedbackEntries")
      .withIndex("by_work_item_id", (q) => q.eq("workItemId", args.itemId))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        note: args.note,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("feedbackEntries", {
        workItemId: args.itemId,
        userId,
        rating: args.rating,
        note: args.note,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { ok: true };
  },
});
