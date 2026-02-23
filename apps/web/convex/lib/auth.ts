import { ConvexError } from "convex/values";

import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

export async function requireAuthUserId(ctx: AnyCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  const userId = identity?.subject?.trim();

  if (!userId) {
    throw new ConvexError("Authentication required.");
  }

  return userId;
}
