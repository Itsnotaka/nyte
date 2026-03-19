import { db, syncedReposSchema } from "@sachikit/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getInstallationRepos, getOnboardingState } from "../../github/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const repoSyncRouter = createTRPCRouter({
  getSyncState: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const state = await getOnboardingState();
    if (state.step !== "has_installations") {
      return { installations: [], syncedRepos: [], accessible: [] };
    }

    const accessible = (
      await Promise.all(
        state.installations.map(async (inst) => {
          const repos = await getInstallationRepos(inst.id);
          return repos.map((r) => ({
            githubRepoId: r.id,
            installationId: inst.id,
            ownerLogin: r.owner.login,
            repoName: r.name,
            repoFullName: r.full_name,
            isPrivate: r.private,
            ownerAvatarUrl: r.owner.avatar_url,
          }));
        }),
      )
    ).flat();

    const synced = await db
      .select()
      .from(syncedReposSchema.syncedRepo)
      .where(eq(syncedReposSchema.syncedRepo.userId, userId));

    return {
      installations: state.installations,
      syncedRepos: synced,
      accessible,
    };
  }),

  getSyncedRepoIds: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await db
      .select({ githubRepoId: syncedReposSchema.syncedRepo.githubRepoId })
      .from(syncedReposSchema.syncedRepo)
      .where(eq(syncedReposSchema.syncedRepo.userId, userId));
    return rows.map((r) => r.githubRepoId);
  }),

  updateSyncedRepos: protectedProcedure
    .input(
      z.object({
        repos: z.array(
          z.object({
            githubRepoId: z.number().int(),
            installationId: z.number().int(),
            ownerLogin: z.string().min(1),
            repoName: z.string().min(1),
            repoFullName: z.string().min(1),
            isPrivate: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const now = new Date();

      await db
        .delete(syncedReposSchema.syncedRepo)
        .where(eq(syncedReposSchema.syncedRepo.userId, userId));

      if (input.repos.length > 0) {
        await db.insert(syncedReposSchema.syncedRepo).values(
          input.repos.map((r) => ({
            userId,
            githubRepoId: r.githubRepoId,
            installationId: r.installationId,
            ownerLogin: r.ownerLogin,
            repoName: r.repoName,
            repoFullName: r.repoFullName,
            isPrivate: r.isPrivate ? 1 : 0,
            syncedAt: now,
          })),
        );
      }

      return { count: input.repos.length };
    }),

  removeSyncedRepo: protectedProcedure
    .input(z.object({ githubRepoId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .delete(syncedReposSchema.syncedRepo)
        .where(
          and(
            eq(syncedReposSchema.syncedRepo.userId, userId),
            eq(syncedReposSchema.syncedRepo.githubRepoId, input.githubRepoId),
          ),
        );
    }),
});
