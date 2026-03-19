import "server-only";
import {
  buildPullRequestReviewSignals,
  classifyPullRequests,
  computeReviewDecision,
  getPullRequest,
  listPullRequestReviews,
  listRecentPullRequests,
  type ClassifiedInboxPullRequest,
  type GitHubPullRequest,
  type GitHubPullRequestReview,
  type InboxSectionId,
} from "@sachikit/github";
import { subDays } from "date-fns";
import { Cause, Exit } from "effect";
import { cache } from "react";

import { log } from "../evlog";
import { getAuthenticatedGitHubLogin, getGitHubAppAuth } from "./auth";
import { getOnboardingState, getSyncedRepoCatalog } from "./catalog";
import { runGitHubEffectExit, type GitHubRuntimeEffect } from "./effect";
import type {
  InboxData,
  InboxDiagnostics,
  InboxPullRequestRow,
  InboxSectionCount,
  RepoCatalogEntry,
} from "./types";

export type InboxSectionMeta = {
  diagnostics: InboxDiagnostics;
  sections: Array<{
    id: InboxSectionId;
    label: string;
    count: number;
    hasItems: boolean;
  }>;
};

type RepoPRResult =
  | { ok: true; prs: GitHubPullRequest[]; entry: RepoCatalogEntry }
  | { ok: false; prs: GitHubPullRequest[]; entry: RepoCatalogEntry };

type PRStats = { additions: number | null; deletions: number | null };

async function attemptGitHubEffect<A>(effect: GitHubRuntimeEffect<A>): Promise<
  | { ok: true; value: A }
  | {
      ok: false;
      error: Error;
    }
> {
  const exit = await runGitHubEffectExit(effect);
  if (Exit.isSuccess(exit)) {
    return { ok: true, value: exit.value };
  }

  const error = Cause.squash(exit.cause);
  return {
    ok: false,
    error:
      error instanceof Error
        ? error
        : new Cause.UnknownError(error, "Unknown GitHub inbox failure"),
  };
}

const loadInboxData = cache(async (): Promise<InboxData | null> => {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    log.info("inbox", "No installations, skipping inbox fetch");
    return null;
  }

  const ghLogin = await getAuthenticatedGitHubLogin();
  if (!ghLogin) {
    log.info("inbox", "No GitHub login found, skipping inbox fetch");
    return null;
  }

  const syncedCatalog = await getSyncedRepoCatalog();
  const targetEntries = syncedCatalog.syncedEntries;

  log.info(
    "inbox",
    `Fetching inbox for ${ghLogin}: ${targetEntries.length} synced repos, ${syncedCatalog.totalAccessible} accessible`,
  );

  const recentCutoff = subDays(new Date(), 7).toISOString();

  const byInstallation = new Map<number, RepoCatalogEntry[]>();
  for (const entry of targetEntries) {
    const existing = byInstallation.get(entry.installation.id) ?? [];
    existing.push(entry);
    byInstallation.set(entry.installation.id, existing);
  }

  const installationResults = await Promise.all(
    Array.from(byInstallation.entries()).map(async ([installationId, entries]) => {
      const installationAuth = getGitHubAppAuth(installationId);
      const installationPullRequests: ClassifiedInboxPullRequest[] = [];
      const installationFailures: string[] = [];

      const repoPRResults = await Promise.all(
        entries.map(async (entry) => {
          const prsResult = await attemptGitHubEffect(
            listRecentPullRequests(
              installationAuth,
              entry.repository.owner.login,
              entry.repository.name,
            ),
          );

          if (prsResult.ok) {
            const prs = prsResult.value;
            log.info("inbox", `Fetched ${prs.length} PRs from ${entry.repository.full_name}`);
            const result: RepoPRResult = { ok: true, prs, entry };
            return result;
          }

          const message = prsResult.error.message;
          log.info("inbox", `Failed to fetch PRs from ${entry.repository.full_name}: ${message}`);
          installationFailures.push(
            `Failed to list PRs for ${entry.repository.full_name}: ${message}`,
          );
          const result: RepoPRResult = { ok: false, prs: [], entry };
          return result;
        }),
      );

      for (const result of repoPRResults) {
        const { entry, prs } = result;

        const relevantPRs = prs.filter(
          (pr) => pr.state === "open" || pr.updated_at >= recentCutoff,
        );

        const openPRs = relevantPRs.filter((pr) => pr.state === "open" && !pr.merged);
        const closedPRs = relevantPRs.filter((pr) => pr.state !== "open" || pr.merged);

        const [reviewResults, statEntries] = await Promise.all([
          Promise.all(
            openPRs.map(async (pr): Promise<[number, GitHubPullRequestReview[]]> => {
              const reviewsResult = await attemptGitHubEffect(
                listPullRequestReviews(
                  installationAuth,
                  entry.repository.owner.login,
                  entry.repository.name,
                  pr.number,
                ),
              );
              if (reviewsResult.ok) {
                return [pr.number, reviewsResult.value];
              }

              log.info(
                "inbox",
                `Failed to get reviews for ${entry.repository.full_name}#${pr.number}: ${reviewsResult.error.message}`,
              );
              return [pr.number, []];
            }),
          ),
          Promise.all(
            relevantPRs.map(async (pr): Promise<[number, PRStats]> => {
              const pullRequestResult = await attemptGitHubEffect(
                getPullRequest(
                  installationAuth,
                  entry.repository.owner.login,
                  entry.repository.name,
                  pr.number,
                ),
              );
              if (pullRequestResult.ok) {
                return [
                  pr.number,
                  {
                    additions: pullRequestResult.value.additions,
                    deletions: pullRequestResult.value.deletions,
                  },
                ];
              }

              return [pr.number, { additions: null, deletions: null }];
            }),
          ),
        ]);
        const reviewsByNumber = new Map(reviewResults);
        const statsByNumber = new Map(statEntries);

        for (const pr of openPRs) {
          const reviews = reviewsByNumber.get(pr.number) ?? [];
          const stats = statsByNumber.get(pr.number) ?? {
            additions: null,
            deletions: null,
          };
          const reviewSignals = buildPullRequestReviewSignals(pr, reviews);
          installationPullRequests.push({
            ...pr,
            additions: stats.additions,
            deletions: stats.deletions,
            auto_merge_enabled: pr.auto_merge_enabled,
            repoFullName: entry.repository.full_name,
            repoOwner: entry.repository.owner.login,
            repoName: entry.repository.name,
            reviewDecision: computeReviewDecision(reviewSignals),
            reviewSignals,
          });
        }

        for (const pr of closedPRs) {
          const stats = statsByNumber.get(pr.number) ?? {
            additions: null,
            deletions: null,
          };
          const reviewSignals = buildPullRequestReviewSignals(pr, []);
          installationPullRequests.push({
            ...pr,
            additions: stats.additions,
            deletions: stats.deletions,
            auto_merge_enabled: pr.auto_merge_enabled,
            repoFullName: entry.repository.full_name,
            repoOwner: entry.repository.owner.login,
            repoName: entry.repository.name,
            reviewDecision: computeReviewDecision(reviewSignals),
            reviewSignals,
          });
        }
      }

      return {
        partialFailures: installationFailures,
        pullRequests: installationPullRequests,
      };
    }),
  );

  const allPullRequests = installationResults.flatMap((result) => result.pullRequests);
  const partialFailures = installationResults.flatMap((result) => result.partialFailures);

  const { sections: classifiedSections, unclassifiedCount } = classifyPullRequests(
    ghLogin,
    allPullRequests,
    {
      recentlyMergedSince: recentCutoff,
    },
  );
  const sections = classifiedSections.map((section) => ({
    id: section.id,
    label: section.label,
    items: section.items.map(
      (pr): InboxPullRequestRow => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged: pr.merged,
        additions: pr.additions,
        deletions: pr.deletions,
        updated_at: pr.updated_at,
        user: {
          avatar_url: pr.user.avatar_url,
          login: pr.user.login,
        },
        head: {
          sha: pr.head.sha,
        },
        repoFullName: pr.repoFullName,
        repoOwner: pr.repoOwner,
        repoName: pr.repoName,
        reviewDecision: pr.reviewDecision,
      }),
    ),
  }));

  const classifiedCount = sections.reduce((sum, s) => sum + s.items.length, 0);

  for (const section of sections) {
    if (section.items.length > 0) {
      log.info("inbox", `Section "${section.label}": ${section.items.length} PRs`);
    }
  }

  log.info(
    "inbox",
    `Complete: ${allPullRequests.length} PRs fetched, ${classifiedCount} classified, ${unclassifiedCount} unclassified`,
  );

  if (partialFailures.length > 0) {
    log.info("inbox", `Partial failures: ${partialFailures.join("; ")}`);
  }

  return {
    sections,
    diagnostics: {
      fetchedCount: allPullRequests.length,
      classifiedCount,
      unclassifiedCount,
      partialFailures,
      syncedRepoCount: syncedCatalog.totalSynced,
      accessibleRepoCount: syncedCatalog.totalAccessible,
    },
  };
});

export async function getInboxData(): Promise<InboxData | null> {
  return loadInboxData();
}

export async function getInboxSectionMeta(): Promise<InboxSectionMeta | null> {
  const data = await loadInboxData();
  if (!data) {
    return null;
  }

  return {
    diagnostics: data.diagnostics,
    sections: data.sections.map((section) => ({
      id: section.id,
      label: section.label,
      count: section.items.length,
      hasItems: section.items.length > 0,
    })),
  };
}

export async function getInboxSectionCounts(): Promise<InboxSectionCount[]> {
  const data = await getInboxData();
  if (!data) return [];
  return data.sections.map((s) => ({
    id: s.id,
    label: s.label,
    count: s.items.length,
  }));
}
