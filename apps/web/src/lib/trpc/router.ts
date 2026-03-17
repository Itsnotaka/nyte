import { githubRouter } from "./routers/github";
import { repoSyncRouter } from "./routers/repo-sync";
import { settingsRouter } from "./routers/settings";
import { createTRPCRouter } from "./server";

export const appRouter = createTRPCRouter({
  github: githubRouter,
  repoSync: repoSyncRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
