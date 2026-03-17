import "server-only";
import { db, syncedReposSchema } from "@sachikit/db";
import {
  addLabels,
  createIssueComment,
  createPullRequest,
  buildPullRequestReviewSignals,
  classifyPullRequests,
  computeReviewDecision,
  findPullRequestByHead,
  getCheckSummaryForRef,
  getFileContent,
  getInstallUrl,
  getPullRequest,
  getPullRequestDiff,
  getRepositoryTree,
  listCheckRunsForRef,
  listCommits,
  listInstallationRepos,
  listIssueComments,
  listPullRequestFilesPaginated,
  listPullRequestReviewComments,
  listPullRequestReviews,
  listRecentPullRequests,
  listRepoLabels,
  listRepositoryBranches,
  listRepositoryPullRequests,
  listUserInstallations,
  markPullRequestReadyForReview,
  mergePullRequest,
  removeLabel,
  removeReviewers,
  requestReviewers,
  submitPullRequestReview,
  updatePullRequest,
  withGitHubClient,
  type GitHubAppInstallationAuth,
  type GitHubBranch,
  type GitHubCheckRun,
  type GitHubCheckSummary,
  type GitHubCommitSummary,
  type GitHubFileContent,
  type GitHubInstallation,
  type GitHubIssueComment,
  type GitHubLabel,
  type GitHubPullRequest,
  type GitHubPullRequestReview,
  type GitHubPullRequestReviewComment,
  type GitHubRepository,
  type GitHubReviewCommentDraft,
  type GitHubReviewEvent,
  type GitHubTree,
  type ClassifiedInboxPullRequest,
  type InboxPullRequest,
  type InboxSection,
  type PaginatedFiles,
} from "@sachikit/github";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "../auth";
import { getSession } from "../auth/server";
import { log } from "../evlog";
import { env } from "../server/env";

type SetupRedirectInput = {
  installationId: number | null;
  setupAction: string | null;
};

export type OnboardingState =
  | { step: "no_session" }
  | { step: "no_github_token" }
  | { step: "no_installation" }
  | {
      step: "has_installations";
      installations: GitHubInstallation[];
    };

type RepoContext = {
  installation: GitHubInstallation;
  repository: GitHubRepository;
  auth: GitHubAppInstallationAuth;
};

export type PullRequestPageData = {
  repository: GitHubRepository;
  pullRequest: GitHubPullRequest;
  diff: string;
  issueComments: GitHubIssueComment[];
  reviews: GitHubPullRequestReview[];
  reviewComments: GitHubPullRequestReviewComment[];
};

export type RepoSubmitPageData = {
  repository: GitHubRepository;
  branches: GitHubBranch[];
  selectedBranch: string | null;
  existingPullRequest: GitHubPullRequest | null;
  openPullRequests: GitHubPullRequest[];
};

type TokenError = "token_unavailable";

async function getGitHubAccessToken(): Promise<Result<string, TokenError>> {
  const h = await headers();
  return ResultAsync.fromPromise(
    auth.api.getAccessToken({ body: { providerId: "github" }, headers: h }),
    (): TokenError => "token_unavailable"
  ).andThen((result) =>
    result?.accessToken
      ? ok(result.accessToken)
      : err<string, TokenError>("token_unavailable")
  );
}

function unwrapGitHubResult<T>(result: Result<T, unknown>): T {
  return result.match(
    (value) => value,
    (error) => {
      throw error;
    }
  );
}

function getGitHubAppAuth(installationId: number): GitHubAppInstallationAuth {
  const appId = Number(env.GITHUB_APP_ID);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error("Invalid GitHub app configuration.");
  }

  return {
    appId,
    installationId,
    privateKey: env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
}

export function getGitHubAppInstallUrl(): string {
  return getInstallUrl(env.GITHUB_APP_SLUG);
}

export function resolveGitHubAppSetupRedirect({
  installationId,
  setupAction,
}: SetupRedirectInput): { redirectTo: "/setup" | "/setup/repos" } {
  if (setupAction === "install" && installationId) {
    return { redirectTo: "/setup/repos" };
  }

  return { redirectTo: "/setup" };
}

async function requireRepoContext(
  owner: string,
  repo: string
): Promise<RepoContext> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    throw new Error("Repository not found.");
  }

  return context;
}

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getSession();
  if (!session) return { step: "no_session" };

  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return { step: "no_github_token" };

  return listUserInstallations(tokenResult.value).match(
    (installations): OnboardingState => {
      const appInstallations = installations.filter(
        (installation) => installation.app_slug === env.GITHUB_APP_SLUG
      );
      return appInstallations.length === 0
        ? { step: "no_installation" }
        : { step: "has_installations", installations: appInstallations };
    },
    (): OnboardingState => ({ step: "no_github_token" })
  );
});

export async function getInstallationRepos(
  installationId: number
): Promise<GitHubRepository[]> {
  const session = await getSession();
  if (!session) return [];

  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return [];

  return listInstallationRepos(tokenResult.value, installationId).unwrapOr([]);
}

export type RepoCatalogEntry = {
  installation: GitHubInstallation;
  repository: GitHubRepository;
};

export type RepoCatalog = {
  installations: GitHubInstallation[];
  entries: RepoCatalogEntry[];
  repos: GitHubRepository[];
};

export const getRepoCatalog = cache(async (): Promise<RepoCatalog> => {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") {
    return { installations: [], entries: [], repos: [] };
  }

  const entries: RepoCatalogEntry[] = [];
  for (const installation of state.installations) {
    const repos = await getInstallationRepos(installation.id);
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

export type SyncedRepoCatalog = RepoCatalog & {
  syncedRepoIds: Set<number>;
  syncedEntries: RepoCatalogEntry[];
  syncedRepos: GitHubRepository[];
  totalAccessible: number;
  totalSynced: number;
};

export async function getSyncedRepoCatalog(): Promise<SyncedRepoCatalog> {
  const session = await getSession();
  const catalog = await getRepoCatalog();

  let syncedRepoIds: Set<number>;
  if (!session) {
    syncedRepoIds = new Set<number>();
  } else {
    const rows = await db
      .select({ githubRepoId: syncedReposSchema.syncedRepo.githubRepoId })
      .from(syncedReposSchema.syncedRepo)
      .where(eq(syncedReposSchema.syncedRepo.userId, session.user.id));
    syncedRepoIds = new Set(rows.map((r) => r.githubRepoId));
  }

  const syncedEntries = catalog.entries.filter((e) =>
    syncedRepoIds.has(e.repository.id)
  );

  return {
    ...catalog,
    syncedRepoIds,
    syncedEntries,
    syncedRepos: syncedEntries.map((e) => e.repository),
    totalAccessible: catalog.entries.length,
    totalSynced: syncedRepoIds.size,
  };
}

export const findRepoContext = cache(
  async (owner: string, repo: string): Promise<RepoContext | null> => {
    const state = await getOnboardingState();
    if (state.step !== "has_installations") {
      return null;
    }

    const syncedCatalog = await getSyncedRepoCatalog();

    for (const installation of state.installations) {
      const repos = await getInstallationRepos(installation.id);
      const repository = repos.find(
        (candidate) =>
          candidate.owner.login.toLowerCase() === owner.toLowerCase() &&
          candidate.name.toLowerCase() === repo.toLowerCase()
      );

      if (repository) {
        const isSynced = syncedCatalog.syncedRepoIds.has(repository.id);
        if (!isSynced) {
          return null;
        }
        return {
          installation,
          repository,
          auth: getGitHubAppAuth(installation.id),
        };
      }
    }

    return null;
  }
);

export async function getRepoSubmitPageData(
  owner: string,
  repo: string,
  branch: string | null
): Promise<RepoSubmitPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const branches = await listRepositoryBranches(
    context.auth,
    owner,
    context.repository.name
  ).unwrapOr([]);

  const selectableBranches = branches.filter(
    (candidate) => candidate.name !== context.repository.default_branch
  );
  const selectedBranch =
    branch && selectableBranches.some((candidate) => candidate.name === branch)
      ? branch
      : (selectableBranches[0]?.name ?? null);

  const [existingPullRequest, openPullRequests] = await Promise.all([
    selectedBranch
      ? findPullRequestByHead(
          context.auth,
          owner,
          context.repository.name,
          selectedBranch,
          {
            base: context.repository.default_branch,
            headOwner: context.repository.owner.login,
            state: "all",
          }
        ).unwrapOr(null)
      : Promise.resolve(null),
    listRepositoryPullRequests(
      context.auth,
      owner,
      context.repository.name,
      "open"
    ).unwrapOr([]),
  ]);

  return {
    repository: context.repository,
    branches,
    selectedBranch,
    existingPullRequest,
    openPullRequests,
  };
}

export async function saveBranchPullRequest(input: {
  owner: string;
  repo: string;
  head: string;
  title: string;
  body: string;
  draft: boolean;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  const existing = unwrapGitHubResult(
    await findPullRequestByHead(
      context.auth,
      input.owner,
      context.repository.name,
      input.head,
      {
        base: context.repository.default_branch,
        headOwner: context.repository.owner.login,
        state: "all",
      }
    )
  );

  if (!existing) {
    return unwrapGitHubResult(
      await createPullRequest(
        context.auth,
        input.owner,
        context.repository.name,
        {
          base: context.repository.default_branch,
          body: input.body,
          draft: input.draft,
          head: input.head,
          title: input.title,
        }
      )
    );
  }

  if (existing.state === "closed" || existing.merged) {
    throw new Error("This branch already has a closed pull request.");
  }

  const updated = unwrapGitHubResult(
    await updatePullRequest(
      context.auth,
      input.owner,
      context.repository.name,
      existing.number,
      {
        body: input.body,
        title: input.title,
      }
    )
  );

  if (input.draft || !updated.draft) {
    return updated;
  }

  return unwrapGitHubResult(
    await markPullRequestReadyForReview(
      context.auth,
      input.owner,
      context.repository.name,
      updated.number
    )
  );
}

export async function getPullRequestPageData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const pullRequest = await getPullRequest(
    context.auth,
    owner,
    context.repository.name,
    pullNumber
  ).unwrapOr(null);
  if (!pullRequest) {
    return null;
  }

  const [diff, issueComments, reviews, reviewComments] = await Promise.all([
    getPullRequestDiff(
      context.auth,
      owner,
      context.repository.name,
      pullNumber
    ).unwrapOr(""),
    listIssueComments(
      context.auth,
      owner,
      context.repository.name,
      pullNumber
    ).unwrapOr([]),
    listPullRequestReviews(
      context.auth,
      owner,
      context.repository.name,
      pullNumber
    ).unwrapOr([]),
    listPullRequestReviewComments(
      context.auth,
      owner,
      context.repository.name,
      pullNumber
    ).unwrapOr([]),
  ]);

  return {
    repository: context.repository,
    pullRequest,
    diff,
    issueComments,
    reviews,
    reviewComments,
  };
}

export async function addPullRequestComment(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
}): Promise<GitHubIssueComment> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await createIssueComment(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      input.body
    )
  );
}

export async function addPullRequestReview(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  event: GitHubReviewEvent;
  body?: string;
  comments?: GitHubReviewCommentDraft[];
}): Promise<GitHubPullRequestReview> {
  const context = await requireRepoContext(input.owner, input.repo);

  const pullRequest = unwrapGitHubResult(
    await getPullRequest(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber
    )
  );

  return unwrapGitHubResult(
    await submitPullRequestReview(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      {
        body: input.body,
        comments: input.comments,
        commitId: pullRequest.head.sha,
        event: input.event,
      }
    )
  );
}

export async function mergeRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  mergeMethod?: "merge" | "squash" | "rebase";
  commitTitle?: string;
  commitMessage?: string;
}): Promise<{ sha: string; merged: boolean }> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await mergePullRequest(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      {
        mergeMethod: input.mergeMethod,
        commitTitle: input.commitTitle,
        commitMessage: input.commitMessage,
      }
    )
  );
}

export async function getPullRequestFileList(
  owner: string,
  repo: string,
  pullNumber: number,
  page = 1,
  perPage = 30
): Promise<PaginatedFiles | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return listPullRequestFilesPaginated(
    context.auth,
    owner,
    context.repository.name,
    pullNumber,
    page,
    perPage
  ).unwrapOr(null);
}

export async function getCheckRunsForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckRun[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listCheckRunsForRef(
    context.auth,
    owner,
    context.repository.name,
    ref
  ).unwrapOr([]);
}

export async function getCheckSummaryForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckSummary | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return getCheckSummaryForRef(
    context.auth,
    owner,
    context.repository.name,
    ref
  ).unwrapOr(null);
}

export async function updateRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await updatePullRequest(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      { title: input.title, body: input.body }
    )
  );
}

export async function requestPullRequestReviewers(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewers: string[];
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await requestReviewers(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      input.reviewers
    )
  );
}

export async function removePullRequestReviewer(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewer: string;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await removeReviewers(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      [input.reviewer]
    )
  );
}

export async function getRepoLabels(
  owner: string,
  repo: string
): Promise<GitHubLabel[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listRepoLabels(context.auth, owner, context.repository.name).unwrapOr(
    []
  );
}

export async function addPullRequestLabels(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  labels: string[];
}): Promise<GitHubLabel[]> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await addLabels(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      input.labels
    )
  );
}

export async function removePullRequestLabel(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  label: string;
}): Promise<void> {
  const context = await requireRepoContext(input.owner, input.repo);

  unwrapGitHubResult(
    await removeLabel(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      input.label
    )
  );
}

export async function convertPullRequestToReady(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return unwrapGitHubResult(
    await markPullRequestReadyForReview(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber
    )
  );
}

export async function getRepoTree(
  owner: string,
  repo: string,
  ref: string,
  path?: string
): Promise<GitHubTree | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const treeSha = path ? `${ref}:${path}` : ref;
  return getRepositoryTree(
    context.auth,
    owner,
    context.repository.name,
    treeSha
  ).unwrapOr(null);
}

export async function getRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubFileContent | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return getFileContent(
    context.auth,
    owner,
    context.repository.name,
    path,
    ref
  ).unwrapOr(null);
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string }
): Promise<GitHubCommitSummary[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listCommits(
    context.auth,
    owner,
    context.repository.name,
    options
  ).unwrapOr([]);
}

export async function getRepoBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listRepositoryBranches(
    context.auth,
    owner,
    context.repository.name
  ).unwrapOr([]);
}

const getAuthenticatedGitHubLogin = cache(async (): Promise<string | null> => {
  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return null;

  return withGitHubClient(tokenResult.value, async (client) => {
    const { data } = await client.rest.users.getAuthenticated();
    return data.login;
  }).unwrapOr(null);
});

export type {
  InboxPullRequest,
  InboxSection,
  InboxSectionId,
  ReviewDecision,
} from "@sachikit/github";

export type InboxData = {
  login: string;
  pullRequests: InboxPullRequest[];
  sections: InboxSection[];
  diagnostics: InboxDiagnostics;
};

export type InboxDiagnostics = {
  fetchedCount: number;
  classifiedCount: number;
  unclassifiedCount: number;
  partialFailures: string[];
  syncedRepoCount: number;
  accessibleRepoCount: number;
};

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

  const allPullRequests: ClassifiedInboxPullRequest[] = [];
  const partialFailures: string[] = [];
  const recentCutoff = subDays(new Date(), 7).toISOString();

  const byInstallation = new Map<number, RepoCatalogEntry[]>();
  for (const entry of targetEntries) {
    const existing = byInstallation.get(entry.installation.id) ?? [];
    existing.push(entry);
    byInstallation.set(entry.installation.id, existing);
  }

  for (const [installationId, entries] of byInstallation) {
    const installationAuth = getGitHubAppAuth(installationId);

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
              error instanceof Error ? error.message : JSON.stringify(error);
            log.info(
              "inbox",
              `Failed to fetch PRs from ${entry.repository.full_name}: ${message}`
            );
            partialFailures.push(
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

      // Keep all open PRs; for closed/merged, only keep recently updated ones
      const relevantPRs = prs.filter(
        (pr) => pr.state === "open" || pr.updated_at >= recentCutoff
      );

      const openPRs = relevantPRs.filter(
        (pr) => pr.state === "open" && !pr.merged
      );
      const closedPRs = relevantPRs.filter(
        (pr) => pr.state !== "open" || pr.merged
      );

      const reviewResults = await Promise.all(
        openPRs.map((pr) =>
          listPullRequestReviews(
            installationAuth,
            entry.repository.owner.login,
            entry.repository.name,
            pr.number
          ).match(
            (r) => r,
            (reviewErr) => {
              log.info(
                "inbox",
                `Failed to get reviews for ${entry.repository.full_name}#${pr.number}: ${reviewErr.message}`
              );
              return [] as GitHubPullRequestReview[];
            }
          )
        )
      );

      for (let i = 0; i < openPRs.length; i++) {
        const pr = openPRs[i]!;
        const reviews = reviewResults[i]!;
        const reviewSignals = buildPullRequestReviewSignals(pr, reviews);
        const reviewDecision = computeReviewDecision(reviewSignals);
        allPullRequests.push({
          ...pr,
          auto_merge_enabled: pr.auto_merge_enabled,
          repoFullName: entry.repository.full_name,
          repoOwner: entry.repository.owner.login,
          repoName: entry.repository.name,
          reviewDecision,
          reviewSignals,
        });
      }

      for (const pr of closedPRs) {
        const reviewSignals = buildPullRequestReviewSignals(pr, []);
        allPullRequests.push({
          ...pr,
          auto_merge_enabled: pr.auto_merge_enabled,
          repoFullName: entry.repository.full_name,
          repoOwner: entry.repository.owner.login,
          repoName: entry.repository.name,
          reviewDecision: computeReviewDecision(reviewSignals),
          reviewSignals,
        });
      }
    }
  }

  const { sections, unclassifiedCount } = classifyPullRequests(
    ghLogin,
    allPullRequests,
    { recentlyMergedSince: recentCutoff }
  );
  const classifiedCount = sections.reduce((sum, s) => sum + s.items.length, 0);

  // Log section breakdown
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
    login: ghLogin,
    pullRequests: allPullRequests,
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
