import { query } from "./_generated/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return {
      userId: identity.subject,
      name: identity.name ?? null,
      email: identity.email ?? null,
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});
