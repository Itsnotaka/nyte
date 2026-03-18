import "server-only";
import { db, syncedReposSchema } from "@sachikit/db";
import {
  addLabels,
  compareBranches,
  createIssueComment,
  createPullRequest,
  buildPullRequestReviewSignals,
  classifyPullRequests,
  computeReviewDecision,
  findPullRequestByHead,
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
  mergeUpstream,
  removeLabel,
  removeReviewers,
  requestReviewers,
  submitPullRequestReview,
  updatePullRequest,
  withGitHubClient,
  type BranchComparison,
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
  type InboxPullRequest as GitHubInboxPullRequest,
  type InboxSection as GitHubInboxSection,
  type InboxSectionId,
  type PaginatedFiles,
  summarizeCheckRuns,
  type ReviewDecision,
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
};

export type PullRequestPageDetailsData = {
  diff: string;
  issueComments: GitHubIssueComment[];
  reviews: GitHubPullRequestReview[];
  reviewComments: GitHubPullRequestReviewComment[];
};

export type PullRequestDiscussionData = {
  issueComments: GitHubIssueComment[];
  reviews: GitHubPullRequestReview[];
};

export type RepoSubmitPageData = {
  repository: GitHubRepository;
  branches: GitHubBranch[];
  selectedBranch: string | null;
  existingPullRequest: GitHubPullRequest | null;
  openPullRequests: GitHubPullRequest[];
};

export type SyncedRepoSummary = {
  totalSynced: number;
};

export type InboxPullRequestRow = {
  id: number;
  number: number;
  title: string;
  state: GitHubPullRequest["state"];
  merged: boolean;
  additions: number | null;
  deletions: number | null;
  updated_at: string;
  user: {
    avatar_url: string;
    login: string;
  };
  head: {
    sha: string;
  };
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  reviewDecision: ReviewDecision;
};

export type InboxSectionData = {
  id: InboxSectionId;
  label: string;
  items: InboxPullRequestRow[];
};

type TokenError = "token_unavailable";

type SyncedRepoLookupRow = {
  githubRepoId: number;
  installationId: number;
  ownerLogin: string;
  repoName: string;
};

function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };

    if ("status" in error && typeof error.status === "number") {
      details.status = error.status;
    }

    if ("code" in error && typeof error.code === "string") {
      details.code = error.code;
    }

    return details;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return { message: error };
  }

  return { message: "Unknown non-Error throw" };
}

async function withTiming<T>(
  operation: string,
  details: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  return run()
    .then((result) => {
      log.info({
        area: "github.server",
        message: "GitHub server operation completed",
        operation,
        details,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return result;
    })
    .catch((error: unknown) => {
      log.error({
        area: "github.server",
        message: "GitHub server operation failed",
        operation,
        details,
        durationMs: Math.round(performance.now() - startedAt),
        failure: getErrorDetails(error),
      });
      throw error;
    });
}

function repoLookupKey(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

const getGitHubAccessToken = cache(
  async (): Promise<Result<string, TokenError>> => {
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
);

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

const getSyncedRepoLookupRows = cache(
  async (): Promise<SyncedRepoLookupRow[]> => {
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
  }
);

export const getInstallationRepos = cache(async function getInstallationRepos(
  installationId: number
): Promise<GitHubRepository[]> {
  return withTiming("getInstallationRepos", { installationId }, async () => {
    const session = await getSession();
    if (!session) return [];

    const tokenResult = await getGitHubAccessToken();
    if (tokenResult.isErr()) return [];

    return listInstallationRepos(tokenResult.value, installationId).unwrapOr(
      []
    );
  });
});

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

  return withTiming(
    "getRepoCatalog",
    { installationCount: state.installations.length },
    async () => {
      const entries: RepoCatalogEntry[] = [];
      const repoGroups = await Promise.all(
        state.installations.map(async (installation) => ({
          installation,
          repos: await getInstallationRepos(installation.id),
        }))
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
    }
  );
});

export type SyncedRepoCatalog = RepoCatalog & {
  syncedRepoIds: Set<number>;
  syncedEntries: RepoCatalogEntry[];
  syncedRepos: GitHubRepository[];
  totalAccessible: number;
  totalSynced: number;
};

export const getSyncedRepoCatalog = cache(
  async (): Promise<SyncedRepoCatalog> => {
    const [catalog, syncedRows] = await Promise.all([
      getRepoCatalog(),
      getSyncedRepoLookupRows(),
    ]);

    return withTiming(
      "getSyncedRepoCatalog",
      {
        accessibleRepoCount: catalog.entries.length,
        syncedRepoCount: syncedRows.length,
      },
      async () => {
        const syncedRepoIds = new Set(
          syncedRows.map((row) => row.githubRepoId)
        );
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
    );
  }
);

export const getSyncedRepoSummary = cache(
  async (): Promise<SyncedRepoSummary> => {
    const syncedRows = await getSyncedRepoLookupRows();
    return {
      totalSynced: new Set(syncedRows.map((row) => row.githubRepoId)).size,
    };
  }
);

export const findRepoContext = cache(
  async (owner: string, repo: string): Promise<RepoContext | null> => {
    return withTiming("findRepoContext", { owner, repo }, async () => {
      const [state, syncedRows] = await Promise.all([
        getOnboardingState(),
        getSyncedRepoLookupRows(),
      ]);
      if (state.step !== "has_installations") {
        return null;
      }

      const matchedRow = syncedRows.find(
        (row) =>
          repoLookupKey(row.ownerLogin, row.repoName) ===
          repoLookupKey(owner, repo)
      );
      if (!matchedRow) {
        return null;
      }

      const installation = state.installations.find(
        (candidate) => candidate.id === matchedRow.installationId
      );
      if (!installation) {
        return null;
      }

      const repos = await getInstallationRepos(installation.id);
      const repository =
        repos.find((candidate) => candidate.id === matchedRow.githubRepoId) ??
        repos.find(
          (candidate) =>
            repoLookupKey(candidate.owner.login, candidate.name) ===
            repoLookupKey(owner, repo)
        );

      if (!repository) {
        return null;
      }

      return {
        installation,
        repository,
        auth: getGitHubAppAuth(installation.id),
      };
    });
  }
);

export async function getRepoSubmitPageData(
  owner: string,
  repo: string,
  branch: string | null
): Promise<RepoSubmitPageData | null> {
  return withTiming(
    "getRepoSubmitPageData",
    { owner, repo, requestedBranch: branch },
    async () => {
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
        branch &&
        selectableBranches.some((candidate) => candidate.name === branch)
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
  );
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
  return withTiming(
    "getPullRequestPageData",
    { owner, repo, pullNumber },
    async () => {
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

      return {
        repository: context.repository,
        pullRequest,
      };
    }
  );
}

export async function getPullRequestDiscussionData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestDiscussionData | null> {
  return withTiming(
    "getPullRequestDiscussionData",
    { owner, repo, pullNumber },
    async () => {
      const context = await findRepoContext(owner, repo);
      if (!context) {
        return null;
      }

      const [issueComments, reviews] = await Promise.all([
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
      ]);

      return {
        issueComments,
        reviews,
      };
    }
  );
}

export async function getPullRequestReviewCommentsData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GitHubPullRequestReviewComment[] | null> {
  return withTiming(
    "getPullRequestReviewCommentsData",
    { owner, repo, pullNumber },
    async () => {
      const context = await findRepoContext(owner, repo);
      if (!context) {
        return null;
      }

      return listPullRequestReviewComments(
        context.auth,
        owner,
        context.repository.name,
        pullNumber
      ).unwrapOr([]);
    }
  );
}

export async function getPullRequestPageDetailsData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestPageDetailsData | null> {
  return withTiming(
    "getPullRequestPageDetailsData",
    { owner, repo, pullNumber },
    async () => {
      const context = await findRepoContext(owner, repo);
      if (!context) {
        return null;
      }

      const [diff, discussion, reviewComments] = await Promise.all([
        getPullRequestDiff(
          context.auth,
          owner,
          context.repository.name,
          pullNumber
        ).unwrapOr(""),
        getPullRequestDiscussionData(owner, repo, pullNumber),
        getPullRequestReviewCommentsData(owner, repo, pullNumber),
      ]);

      return {
        diff,
        issueComments: discussion?.issueComments ?? [],
        reviews: discussion?.reviews ?? [],
        reviewComments: reviewComments ?? [],
      };
    }
  );
}

export type StackEntry = {
  number: number;
  title: string;
  headRef: string;
  baseRef: string;
  state: "open" | "closed" | "merged";
  isCurrent: boolean;
};

export async function getPullRequestStack(
  owner: string,
  repo: string,
  currentPrNumber: number
): Promise<StackEntry[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  const allPRs = await listRepositoryPullRequests(
    context.auth,
    owner,
    context.repository.name,
    "all"
  ).unwrapOr([]);

  const currentPR = allPRs.find((pr) => pr.number === currentPrNumber);
  if (!currentPR) return [];

  const byHead = new Map<string, GitHubPullRequest>();
  const byBase = new Map<string, GitHubPullRequest>();
  for (const pr of allPRs) {
    byHead.set(pr.head.ref, pr);
    if (pr.state === "open" && !pr.merged) {
      byBase.set(pr.base.ref, pr);
    }
  }

  const chain: GitHubPullRequest[] = [currentPR];

  let walk: GitHubPullRequest | undefined = currentPR;
  while (walk) {
    const parent = byHead.get(walk.base.ref);
    if (!parent || parent.number === walk.number) break;
    if (chain.some((p) => p.number === parent.number)) break;
    chain.unshift(parent);
    walk = parent;
  }

  walk = currentPR;
  while (walk) {
    const child = byBase.get(walk.head.ref);
    if (!child || child.number === walk.number) break;
    if (chain.some((p) => p.number === child.number)) break;
    chain.push(child);
    walk = child;
  }

  if (chain.length <= 1) return [];

  return chain.map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    state: pr.merged ? "merged" : pr.state,
    isCurrent: pr.number === currentPrNumber,
  }));
}

export type StackHealthEntry = StackEntry & {
  needsRestack: boolean;
  behindBy: number;
  comparison: BranchComparison | null;
};

export async function getStackHealth(
  owner: string,
  repo: string,
  currentPrNumber: number
): Promise<StackHealthEntry[]> {
  const stack = await getPullRequestStack(owner, repo, currentPrNumber);
  if (stack.length === 0) return [];

  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  const results: StackHealthEntry[] = [];

  for (const entry of stack) {
    if (entry.state !== "open") {
      results.push({
        ...entry,
        needsRestack: false,
        behindBy: 0,
        comparison: null,
      });
      continue;
    }

    const comparison = await compareBranches(
      context.auth,
      owner,
      context.repository.name,
      entry.headRef,
      entry.baseRef
    ).unwrapOr(null);

    results.push({
      ...entry,
      needsRestack: comparison !== null && comparison.behindBy > 0,
      behindBy: comparison?.behindBy ?? 0,
      comparison,
    });
  }

  return results;
}

export async function restackPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  newBase: string
): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(owner, repo);

  return unwrapGitHubResult(
    await updatePullRequest(
      context.auth,
      owner,
      context.repository.name,
      pullNumber,
      { base: newBase }
    )
  );
}

export async function updateStackedBranch(
  owner: string,
  repo: string,
  branch: string,
  upstreamBranch: string
): Promise<{ sha: string }> {
  const context = await requireRepoContext(owner, repo);

  return unwrapGitHubResult(
    await mergeUpstream(
      context.auth,
      owner,
      context.repository.name,
      branch,
      upstreamBranch
    )
  );
}

export async function restackAfterMerge(
  owner: string,
  repo: string,
  mergedPrNumber: number
): Promise<{ restacked: number[] }> {
  const context = await requireRepoContext(owner, repo);

  const mergedPR = await getPullRequest(
    context.auth,
    owner,
    context.repository.name,
    mergedPrNumber
  ).unwrapOr(null);

  if (!mergedPR || !mergedPR.merged) {
    return { restacked: [] };
  }

  const allPRs = await listRepositoryPullRequests(
    context.auth,
    owner,
    context.repository.name,
    "open"
  ).unwrapOr([]);

  const children = allPRs.filter((pr) => pr.base.ref === mergedPR.head.ref);

  const restacked: number[] = [];

  for (const child of children) {
    const updated = await updatePullRequest(
      context.auth,
      owner,
      context.repository.name,
      child.number,
      { base: mergedPR.base.ref }
    ).unwrapOr(null);

    if (updated) {
      restacked.push(child.number);
    }
  }

  return { restacked };
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

export type GitHubCheckRef = {
  owner: string;
  repo: string;
  ref: string;
};

export type GitHubCheckReport = {
  runs: GitHubCheckRun[];
  summary: GitHubCheckSummary;
};

function checkRefKey(input: GitHubCheckRef): string {
  return `${repoLookupKey(input.owner, input.repo)}@${input.ref}`;
}

export async function getCheckReportForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckReport | null> {
  return withTiming("getCheckReportForPR", { owner, repo, ref }, async () => {
    const context = await findRepoContext(owner, repo);
    if (!context) return null;

    const runs = await listCheckRunsForRef(
      context.auth,
      owner,
      context.repository.name,
      ref
    ).unwrapOr([]);

    return {
      runs,
      summary: summarizeCheckRuns(runs),
    };
  });
}

export async function getCheckRunsForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckRun[]> {
  return withTiming("getCheckRunsForPR", { owner, repo, ref }, async () => {
    const report = await getCheckReportForPR(owner, repo, ref);
    return report?.runs ?? [];
  });
}

export async function getCheckSummaryForPR(
  owner: string,
  repo: string,
  ref: string
): Promise<GitHubCheckSummary | null> {
  return withTiming("getCheckSummaryForPR", { owner, repo, ref }, async () => {
    const report = await getCheckReportForPR(owner, repo, ref);
    return report?.summary ?? null;
  });
}

export async function getCheckSummariesForRefs(
  refs: GitHubCheckRef[]
): Promise<Record<string, GitHubCheckSummary | null>> {
  const uniqueRefs = Array.from(
    new Map(refs.map((ref) => [checkRefKey(ref), ref])).entries()
  );

  return withTiming(
    "getCheckSummariesForRefs",
    { requestedRefCount: refs.length, uniqueRefCount: uniqueRefs.length },
    async () => {
      const summaries = await Promise.all(
        uniqueRefs.map(
          async ([key, ref]) =>
            [
              key,
              await getCheckSummaryForPR(ref.owner, ref.repo, ref.ref),
            ] as const
        )
      );

      return Object.fromEntries(summaries);
    }
  );
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
  sections: InboxSectionData[];
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

function mapInboxPullRequest(pr: GitHubInboxPullRequest): InboxPullRequestRow {
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
  return withTiming("getInboxData", {}, async () => {
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

            for (let i = 0; i < openPRs.length; i++) {
              const pr = openPRs[i]!;
              const reviews = reviewsByNumber.get(pr.number) ?? [];
              const stats = statsByNumber.get(pr.number) ?? {
                additions: null,
                deletions: null,
              };
              const reviewSignals = buildPullRequestReviewSignals(pr, reviews);
              const reviewDecision = computeReviewDecision(reviewSignals);
              installationPullRequests.push({
                ...pr,
                additions: stats.additions,
                deletions: stats.deletions,
                auto_merge_enabled: pr.auto_merge_enabled,
                repoFullName: entry.repository.full_name,
                repoOwner: entry.repository.owner.login,
                repoName: entry.repository.name,
                reviewDecision,
                reviewSignals,
              });
            }

            for (let i = 0; i < closedPRs.length; i++) {
              const pr = closedPRs[i]!;
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
    const classifiedCount = sections.reduce(
      (sum, s) => sum + s.items.length,
      0
    );

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
  });
}

export type InboxSectionCount = {
  id: InboxSectionId;
  label: string;
  count: number;
};

export async function getInboxSectionCounts(): Promise<InboxSectionCount[]> {
  const data = await getInboxData();
  if (!data) return [];
  return data.sections.map((s) => ({
    id: s.id,
    label: s.label,
    count: s.items.length,
  }));
}
