import { initTRPC } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

import { auth } from "../auth";
import { getUserSession } from "../auth/server";
import { log } from "../evlog";

export type CreateTRPCContextOptions = {
  headers?: Headers;
};

export const createTRPCContext = cache(async (opts?: CreateTRPCContextOptions) => {
  const session = opts?.headers
    ? await auth.api.getSession({ headers: opts.headers })
    : await getUserSession();
  return { session, auth };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

const timingMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = performance.now();
  const result = await next();
  log.info({
    area: "trpc",
    message: `${type} ${path}`,
    path,
    type,
    durationMs: Math.round(performance.now() - start),
    ok: result.ok,
  });
  return result;
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const protectedProcedure = t.procedure.use(timingMiddleware).use(
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
