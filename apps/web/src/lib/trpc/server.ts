import { initTRPC } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

import { auth } from "../auth";
import { getSession } from "../auth/server";

export const createTRPCContext = cache(async () => {
  const session = await getSession();
  return { session, auth };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session) {
      throw new Error("Unauthorized");
    }
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
      },
    });
  }),
);
