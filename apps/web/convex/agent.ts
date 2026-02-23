import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { buildQueueItemFromCommand } from "./lib/agent";
import { requireAuthUserId } from "./lib/auth";

function createItemId(now: number): string {
  return `agent:${now}:${Math.random().toString(36).slice(2, 10)}`;
}

export const run = mutation({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const message = args.message.trim();
    if (message.length === 0) {
      throw new Error("Message is required.");
    }

    const now = Date.now();
    const itemId = createItemId(now);
    const queueItem = buildQueueItemFromCommand({
      userId,
      message,
      now,
      itemId,
    });

    await ctx.db.insert("queueItems", queueItem);

    return { itemId };
  },
});
