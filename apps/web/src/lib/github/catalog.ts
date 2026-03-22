import "server-only";
import { db, syncedReposSchema } from "@sachikit/db";
import {
  listInstallationRepos,
  listUserInstallations,
  type GitHubRepository,
} from "@sachikit/github";
import { eq } from "drizzle-orm";
import { cache } from "react";

import { getUserSession } from "../auth/server";
import { env } from "../server/env";
import { withToken } from "./auth";
import { runGitHubEffect } from "./effect";
import type {
  OnboardingState,
  RepoCatalog,
  RepoCatalogEntry,
  SyncedRepoCatalog,
  SyncedRepoLookupRow,
  SyncedRepoSummary,
} from "./types";

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getUserSession();
  if (!session) return { step: "no_user_session" };

  const installs = await withToken((token) => runGitHubEffect(listUserInstallations(token)));
  if (!installs) {
    return { step: "no_github_user_token" };
  }

  const appInstallations = installs.filter(
    (installation) => installation.app_slug === env.GITHUB_APP_SLUG,
  );
  return appInstallations.length === 0
    ? { step: "no_github_installation" }
    : { step: "has_installations", installations: appInstallations };
});

const getSyncedRepoLookupRows = cache(async (): Promise<SyncedRepoLookupRow[]> => {
  const session = await getUserSession();
  if (!session) {
    return [];
  }

  return db
    .select({
      githubRepoId: syncedReposSchema.syncedRepo.githubRepoId,
      installationId: syncedReposSchema.syncedRepo.installationId,
      ownerLogin: syncedReposSchema.syncedRepo.ownerLogin,
      repoName: syncedReposSchema.syncedRepo.repoName,
    })
    .from(syncedReposSchema.syncedRepo)
    .where(eq(syncedReposSchema.syncedRepo.userId, session.user.id));
});

export const getInstallationRepos = cache(async function getInstallationRepos(
  installationId: number,
): Promise<GitHubRepository[]> {
  const session = await getUserSession();
  if (!session) return [];

  const repos = await withToken((token) =>
    runGitHubEffect(listInstallationRepos(token, installationId)),
  );
  if (!repos) {
    return [];
  }

  return repos;
});

export const getRepoCatalog = cache(async (): Promise<RepoCatalog> => {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    return { installations: [], entries: [], repos: [] };
  }

  const entries: RepoCatalogEntry[] = [];
  const repoGroups = await Promise.all(
    state.installations.map(async (installation) => ({
      installation,
      repos: await getInstallationRepos(installation.id),
    })),
  );

  for (const { installation, repos } of repoGroups) {
    for (const repository of repos) {
      entries.push({ installation, repository });
    }
  }

  return {
    installations: state.installations,
    entries,
    repos: entries.map((e) => e.repository),
  };
});

export const getSyncedRepoCatalog = cache(async (): Promise<SyncedRepoCatalog> => {
  const [catalog, syncedRows] = await Promise.all([getRepoCatalog(), getSyncedRepoLookupRows()]);

  const syncedRepoIds = new Set(syncedRows.map((row) => row.githubRepoId));
  const syncedEntries = catalog.entries.filter((e) => syncedRepoIds.has(e.repository.id));

  return {
    ...catalog,
    syncedRepoIds,
    syncedEntries,
    syncedRepos: syncedEntries.map((e) => e.repository),
    totalAccessible: catalog.entries.length,
    totalSynced: syncedRepoIds.size,
  };
});

export const getSyncedRepoSummary = cache(async (): Promise<SyncedRepoSummary> => {
  const syncedRows = await getSyncedRepoLookupRows();
  return {
    totalSynced: new Set(syncedRows.map((row) => row.githubRepoId)).size,
  };
});

export { getSyncedRepoLookupRows };
