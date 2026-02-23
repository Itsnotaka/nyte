import { v } from "convex/values";
import { createRequestLogger } from "evlog";
import { nanoid } from "nanoid";

import "./evlog";
import { mutation } from "./_generated/server";
import { buildQueueItemFromCommand } from "./lib/agent";
import { requireAuthUserId } from "./lib/auth";

function createItemId(now: number): string {
  return `agent:${now}:${nanoid(10)}`;
}

export const run = mutation({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const log = createRequestLogger({
      method: "mutation",
      path: "agent/run",
    });

    try {
      const userId = await requireAuthUserId(ctx);
      const message = args.message.trim();
      log.set({ userId, messageLength: message.length });
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
      log.set({
        itemId,
        actionKind: queueItem.proposedAction.kind,
        workType: queueItem.type,
      });

      await ctx.db.insert("queueItems", queueItem);

      log.set({ queueState: "queued" });
      return { itemId };
    } finally {
      log.emit();
    }
  },
});
