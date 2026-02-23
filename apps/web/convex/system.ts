import { log } from "evlog";

import "./evlog";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

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
