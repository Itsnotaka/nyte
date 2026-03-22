import "server-only";
import {
  DEFAULT_INBOX_SECTION_RULES,
  buildPullRequestReviewSignals,
  classifyPullRequests,
  computeReviewDecision,
  deriveInboxClassificationFacts,
  getPullRequest,
  listMergingPullRequestsGraphql,
  listPullRequestReviews,
  listRecentPullRequests,
  matchesInboxCondition,
  type ClassifiedInboxPullRequest,
  type GitHubPullRequest,
  type GitHubPullRequestReview,
  type PullRequestReviewSignals,
} from "@sachikit/github";
import { subDays } from "date-fns";
import { Cause, Exit } from "effect";
import { cache } from "react";

import { log } from "../evlog";
import { getGitHubInstallationAuth, getGitHubUserLogin } from "./auth";
import { getOnboardingState, getSyncedRepoCatalog } from "./catalog";
import { runGitHubEffectExit, type GitHubRuntimeEffect } from "./effect";
import type {
  InboxData,
  InboxProbeData,
  InboxProbeMode,
  InboxPullRequestRow,
  RepoCatalogEntry,
} from "./types";

type RepoPRResult =
  | { ok: true; prs: GitHubPullRequest[]; entry: RepoCatalogEntry }
  | { ok: false; prs: GitHubPullRequest[]; entry: RepoCatalogEntry };

type PRStats = { additions: number | null; deletions: number | null };

const EMPTY_SIGNALS = {
  activeReviewerLogins: [],
  approverLogins: [],
  hasActiveReview: false,
  hasApprovals: false,
  hasUnaddressedChangesRequested: false,
  isFullyApproved: false,
  requestedReviewerLogins: [],
  rerequestedReviewerLogins: [],
} satisfies PullRequestReviewSignals;

const MERGING_RULE = (() => {
  const rule = DEFAULT_INBOX_SECTION_RULES.find((item) => item.id === "merging");
  if (!rule) {
    throw new Error("Missing inbox rule for merging section");
  }
  return rule;
})();

function toInboxPullRequestRow(
  pr: Pick<
    ClassifiedInboxPullRequest,
    | "additions"
    | "base"
    | "deletions"
    | "id"
    | "merged"
    | "number"
    | "repoFullName"
    | "repoName"
    | "repoOwner"
    | "reviewDecision"
    | "state"
    | "title"
    | "updated_at"
    | "user"
    | "head"
  >,
): InboxPullRequestRow {
  return {
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
    base: {
      sha: pr.base.sha,
    },
    repoFullName: pr.repoFullName,
    repoOwner: pr.repoOwner,
    repoName: pr.repoName,
    reviewDecision: pr.reviewDecision,
  };
}

function toProbePullRequest(pr: GitHubPullRequest, entry: RepoCatalogEntry): ClassifiedInboxPullRequest {
  return {
    ...pr,
    repoFullName: entry.repository.full_name,
    repoOwner: entry.repository.owner.login,
    repoName: entry.repository.name,
    reviewDecision: "none",
    reviewSignals: EMPTY_SIGNALS,
  };
}

function matchesMergingRule(
  login: string,
  pr: ClassifiedInboxPullRequest,
  recentCutoff: string,
): boolean {
  return matchesInboxCondition(
    MERGING_RULE.condition,
    deriveInboxClassificationFacts(login, pr, {
      recentlyMergedSince: recentCutoff,
    }),
  );
}

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

async function loadInboxProbe(mode: InboxProbeMode): Promise<InboxProbeData | null> {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    log.info({
      area: "github.inbox_probe",
      message: "Skipping inbox probe",
      mode,
      reason: "no_installations",
    });
    return null;
  }

  const ghLogin = await getGitHubUserLogin();
  if (!ghLogin) {
    log.info({
      area: "github.inbox_probe",
      message: "Skipping inbox probe",
      mode,
      reason: "no_login",
    });
    return null;
  }

  const syncedCatalog = await getSyncedRepoCatalog();
  const targetEntries = syncedCatalog.syncedEntries;
  const recentCutoff = subDays(new Date(), 7).toISOString();
  const startedAt = Date.now();

  log.info({
    area: "github.inbox_probe",
    message: "Starting inbox probe",
    mode,
    accessibleRepoCount: syncedCatalog.totalAccessible,
    startedAt: new Date(startedAt).toISOString(),
    syncedRepoCount: syncedCatalog.totalSynced,
  });

  const byInstallation = new Map<number, RepoCatalogEntry[]>();
  for (const entry of targetEntries) {
    const items = byInstallation.get(entry.installation.id) ?? [];
    items.push(entry);
    byInstallation.set(entry.installation.id, items);
  }

  const installationResults = await Promise.all(
    Array.from(byInstallation.entries()).map(async ([installationId, entries]) => {
      const auth = getGitHubInstallationAuth(installationId);
      const partialFailures: string[] = [];

      const results = await Promise.all(
        entries.map(async (entry) => {
          const prsResult = await attemptGitHubEffect(
            mode === "graphql"
              ? listMergingPullRequestsGraphql(auth, entry.repository.owner.login, entry.repository.name)
              : listRecentPullRequests(auth, entry.repository.owner.login, entry.repository.name),
          );

          if (!prsResult.ok) {
            partialFailures.push(
              `Failed to list ${mode} PRs for ${entry.repository.full_name}: ${prsResult.error.message}`,
            );
            return { fetchedCount: 0, items: [] as InboxPullRequestRow[], repos: 0 };
          }

          const prs = prsResult.value;
          const picks = prs
            .map((pr) => toProbePullRequest(pr, entry))
            .filter((pr) => matchesMergingRule(ghLogin, pr, recentCutoff));

          if (mode === "graphql") {
            return {
              fetchedCount: prs.length,
              items: picks.map(toInboxPullRequestRow),
              repos: 1,
            };
          }

          const items = await Promise.all(
            picks.map(async (pr) => {
              const detailResult = await attemptGitHubEffect(
                getPullRequest(auth, entry.repository.owner.login, entry.repository.name, pr.number),
              );

              if (!detailResult.ok) {
                partialFailures.push(
                  `Failed to get PR details for ${entry.repository.full_name}#${pr.number}: ${detailResult.error.message}`,
                );
                return toInboxPullRequestRow(pr);
              }

              return toInboxPullRequestRow(toProbePullRequest(detailResult.value, entry));
            }),
          );

          return {
            fetchedCount: prs.length,
            items,
            repos: 1,
          };
        }),
      );

      return {
        fetchedCount: results.reduce((sum, result) => sum + result.fetchedCount, 0),
        items: results.flatMap((result) => result.items),
        partialFailures,
        repos: results.reduce((sum, result) => sum + result.repos, 0),
      };
    }),
  );

  const items = installationResults
    .flatMap((result) => result.items)
    .sort((a, b) => (a.updated_at > b.updated_at ? -1 : a.updated_at < b.updated_at ? 1 : 0));
  const fetchedCount = installationResults.reduce((sum, result) => sum + result.fetchedCount, 0);
  const partialFailures = installationResults.flatMap((result) => result.partialFailures);
  const repos = installationResults.reduce((sum, result) => sum + result.repos, 0);
  const endedAt = Date.now();
  const serverMs = endedAt - startedAt;

  log.info({
    area: "github.inbox_probe",
    message: "Completed inbox probe",
    mode,
    accessibleRepoCount: syncedCatalog.totalAccessible,
    endedAt: new Date(endedAt).toISOString(),
    fetchedCount,
    itemCount: items.length,
    partialFailureCount: partialFailures.length,
    fetchedRepoCount: repos,
    startedAt: new Date(startedAt).toISOString(),
    syncedRepoCount: syncedCatalog.totalSynced,
    durationMs: serverMs,
    ...(partialFailures.length > 0 ? { partialFailures } : {}),
  });

  return {
    diagnostics: {
      accessibleRepoCount: syncedCatalog.totalAccessible,
      fetchedCount,
      itemCount: items.length,
      partialFailures,
      serverMs,
      source: mode,
      syncedRepoCount: syncedCatalog.totalSynced,
    },
    id: `merging_probe_${mode}`,
    items,
    label: `Merging and recently merged (${mode === "graphql" ? "GraphQL" : "REST"})`,
  };
}

const loadInboxData = cache(async (): Promise<InboxData | null> => {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    log.info("inbox", "No installations, skipping inbox fetch");
    return null;
  }

  const ghLogin = await getGitHubUserLogin();
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
      const installationAuth = getGitHubInstallationAuth(installationId);
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
    items: section.items.map((pr) => toInboxPullRequestRow(pr)),
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

export async function getMergingProbeRestData(): Promise<InboxProbeData | null> {
  return loadInboxProbe("rest");
}

export async function getMergingProbeGraphqlData(): Promise<InboxProbeData | null> {
  return loadInboxProbe("graphql");
}
