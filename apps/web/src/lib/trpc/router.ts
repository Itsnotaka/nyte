import { githubRouter } from "./routers/github";
import { settingsRouter } from "./routers/settings";
import { createTRPCRouter } from "./server";

export const appRouter = createTRPCRouter({
  github: githubRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
