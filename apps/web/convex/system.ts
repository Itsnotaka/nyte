import { internalAction } from "./_generated/server";

export const heartbeat = internalAction({
  args: {},
  handler: async () => {
    return null;
  },
});
