import "server-only";
import { db, syncedReposSchema } from "@sachikit/db";
import {
  listInstallationRepos,
  listUserInstallations,
  type GitHubRepository,
} from "@sachikit/github";
import { eq } from "drizzle-orm";
import { cache } from "react";

import { getSession } from "../auth/server";
import { env } from "../server/env";
import { getGitHubAccessToken } from "./auth";
import { runGitHubEffectOrEmptyArray } from "./effect";
import type {
  OnboardingState,
  RepoCatalog,
  RepoCatalogEntry,
  SyncedRepoCatalog,
  SyncedRepoLookupRow,
  SyncedRepoSummary,
} from "./types";

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getSession();
  if (!session) return { step: "no_session" };

  const token = await getGitHubAccessToken();
  if (!token) return { step: "no_github_token" };

  const installations = await runGitHubEffectOrEmptyArray(listUserInstallations(token));
  const appInstallations = installations.filter(
    (installation) => installation.app_slug === env.GITHUB_APP_SLUG,
  );
  return appInstallations.length === 0
    ? { step: "no_installation" }
    : { step: "has_installations", installations: appInstallations };
});

const getSyncedRepoLookupRows = cache(async (): Promise<SyncedRepoLookupRow[]> => {
  const session = await getSession();
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
  const session = await getSession();
  if (!session) return [];

  const token = await getGitHubAccessToken();
  if (!token) return [];

  return runGitHubEffectOrEmptyArray(listInstallationRepos(token, installationId));
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
