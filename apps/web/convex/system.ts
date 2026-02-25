import { v } from "convex/values";
import { log } from "evlog";

import "./evlog";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

export const heartbeat = internalAction({
  args: {},
  handler: async (ctx) => {
    log.info({
      event: "system.heartbeat.start",
    });
    await ctx.runAction(internal.ingestion.enqueueCronIngestion, {});
    log.info({
      event: "system.heartbeat.complete",
    });
    return null;
  },
});

export const purgeLegacyCommandRuns = internalMutation({
  args: {
    ids: v.array(v.id("commandRuns")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
    return {
      deletedCount: args.ids.length,
      deletedIds: args.ids,
    };
  },
});
