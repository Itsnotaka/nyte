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
  type InboxPullRequest,
  type InboxSection as GitHubInboxSection,
} from "@sachikit/github";
import { subDays } from "date-fns";

import { log } from "../evlog";
import { getAuthenticatedGitHubLogin, getGitHubAppAuth } from "./auth";
import { getOnboardingState, getSyncedRepoCatalog } from "./catalog";
import type {
  InboxData,
  InboxPullRequestRow,
  InboxSectionCount,
  InboxSectionData,
  RepoCatalogEntry,
} from "./types";

function mapInboxPullRequest(pr: InboxPullRequest): InboxPullRequestRow {
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
    repoFullName: pr.repoFullName,
    repoOwner: pr.repoOwner,
    repoName: pr.repoName,
    reviewDecision: pr.reviewDecision,
  };
}

function mapInboxSection(section: GitHubInboxSection): InboxSectionData {
  return {
    id: section.id,
    label: section.label,
    items: section.items.map((item) => mapInboxPullRequest(item)),
  };
}

export async function getInboxData(): Promise<InboxData | null> {
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
    `Fetching inbox for ${ghLogin}: ${targetEntries.length} synced repos, ${syncedCatalog.totalAccessible} accessible`
  );

  const recentCutoff = subDays(new Date(), 7).toISOString();

  const byInstallation = new Map<number, RepoCatalogEntry[]>();
  for (const entry of targetEntries) {
    const existing = byInstallation.get(entry.installation.id) ?? [];
    existing.push(entry);
    byInstallation.set(entry.installation.id, existing);
  }

  const installationResults = await Promise.all(
    Array.from(byInstallation.entries()).map(
      async ([installationId, entries]) => {
        const installationAuth = getGitHubAppAuth(installationId);
        const installationPullRequests: ClassifiedInboxPullRequest[] = [];
        const installationFailures: string[] = [];

        const repoPRResults = await Promise.all(
          entries.map((entry) =>
            listRecentPullRequests(
              installationAuth,
              entry.repository.owner.login,
              entry.repository.name
            ).match(
              (prs) => {
                log.info(
                  "inbox",
                  `Fetched ${prs.length} PRs from ${entry.repository.full_name}`
                );
                return { ok: true as const, prs, entry };
              },
              (error) => {
                const message =
                  error instanceof Error
                    ? error.message
                    : JSON.stringify(error);
                log.info(
                  "inbox",
                  `Failed to fetch PRs from ${entry.repository.full_name}: ${message}`
                );
                installationFailures.push(
                  `Failed to list PRs for ${entry.repository.full_name}: ${message}`
                );
                return {
                  ok: false as const,
                  prs: [] as GitHubPullRequest[],
                  entry,
                };
              }
            )
          )
        );

        for (const result of repoPRResults) {
          const { entry, prs } = result;

          const relevantPRs = prs.filter(
            (pr) => pr.state === "open" || pr.updated_at >= recentCutoff
          );

          const openPRs = relevantPRs.filter(
            (pr) => pr.state === "open" && !pr.merged
          );
          const closedPRs = relevantPRs.filter(
            (pr) => pr.state !== "open" || pr.merged
          );

          const [reviewResults, statEntries] = await Promise.all([
            Promise.all(
              openPRs.map((pr) =>
                listPullRequestReviews(
                  installationAuth,
                  entry.repository.owner.login,
                  entry.repository.name,
                  pr.number
                ).match(
                  (reviews) => [pr.number, reviews] as const,
                  (reviewErr) => {
                    log.info(
                      "inbox",
                      `Failed to get reviews for ${entry.repository.full_name}#${pr.number}: ${reviewErr.message}`
                    );
                    return [
                      pr.number,
                      [] as GitHubPullRequestReview[],
                    ] as const;
                  }
                )
              )
            ),
            Promise.all(
              relevantPRs.map((pr) =>
                getPullRequest(
                  installationAuth,
                  entry.repository.owner.login,
                  entry.repository.name,
                  pr.number
                ).match(
                  (full) =>
                    [
                      pr.number,
                      {
                        additions: full.additions,
                        deletions: full.deletions,
                      },
                    ] as const,
                  () =>
                    [
                      pr.number,
                      {
                        additions: null as number | null,
                        deletions: null as number | null,
                      },
                    ] as const
                )
              )
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
      }
    )
  );

  const allPullRequests = installationResults.flatMap(
    (result) => result.pullRequests
  );
  const partialFailures = installationResults.flatMap(
    (result) => result.partialFailures
  );

  const { sections: classifiedSections, unclassifiedCount } =
    classifyPullRequests(ghLogin, allPullRequests, {
      recentlyMergedSince: recentCutoff,
    });
  const sections = classifiedSections.map((section) =>
    mapInboxSection(section)
  );
  const classifiedCount = sections.reduce((sum, s) => sum + s.items.length, 0);

  for (const section of sections) {
    if (section.items.length > 0) {
      log.info(
        "inbox",
        `Section "${section.label}": ${section.items.length} PRs`
      );
    }
  }

  log.info(
    "inbox",
    `Complete: ${allPullRequests.length} PRs fetched, ${classifiedCount} classified, ${unclassifiedCount} unclassified`
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
