import { githubRouter } from "./routers/github";
import { createTRPCRouter } from "./server";

export const appRouter = createTRPCRouter({
  github: githubRouter,
});

export type AppRouter = typeof appRouter;
