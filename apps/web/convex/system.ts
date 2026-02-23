import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const heartbeat = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(internal.ingestion.enqueueCronIngestion, {});
    return null;
  },
});
