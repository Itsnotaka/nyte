import { z } from "zod";

import {
  getGitHubAppInstallUrl,
  resolveGitHubAppSetupRedirect,
} from "../../github/server";
import { createTRPCRouter, protectedProcedure } from "../server";

export const githubRouter = createTRPCRouter({
  startInstall: protectedProcedure.mutation(() => {
    return { url: getGitHubAppInstallUrl() };
  }),
  resolveSetupRedirect: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int().positive().nullable(),
        setupAction: z.string().nullable(),
      })
    )
    .mutation(({ input }) => {
      return resolveGitHubAppSetupRedirect(input);
    }),
});
