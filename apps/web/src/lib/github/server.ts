import "server-only";
import {
  addLabels,
  createIssueComment,
  createPullRequest,
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
  type PaginatedFiles,
} from "@sachikit/github";
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

type TokenError = "token_unavailable";

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

async function getGitHubAccessToken(): Promise<Result<string, TokenError>> {
  const h = await headers();
  return ResultAsync.fromPromise(
    auth.api.getAccessToken({ body: { providerId: "github" }, headers: h }),
    (): TokenError => "token_unavailable",
  ).andThen((result) =>
    result?.accessToken ? ok(result.accessToken) : err<string, TokenError>("token_unavailable"),
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

export const getOnboardingState = cache(async (): Promise<OnboardingState> => {
  const session = await getSession();
  if (!session) return { step: "no_session" };

  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return { step: "no_github_token" };

  return listUserInstallations(tokenResult.value).match(
    (installations): OnboardingState => {
      const appInstallations = installations.filter(
        (installation) => installation.app_slug === env.GITHUB_APP_SLUG,
      );
      return appInstallations.length === 0
        ? { step: "no_installation" }
        : { step: "has_installations", installations: appInstallations };
    },
    (): OnboardingState => ({ step: "no_github_token" }),
  );
});

export async function getInstallationRepos(installationId: number): Promise<GitHubRepository[]> {
  const session = await getSession();
  if (!session) return [];

  const tokenResult = await getGitHubAccessToken();
  if (tokenResult.isErr()) return [];

  return listInstallationRepos(tokenResult.value, installationId).unwrapOr([]);
}

export const findRepoContext = cache(
  async (owner: string, repo: string): Promise<RepoContext | null> => {
    const state = await getOnboardingState();
    if (state.step !== "has_installations") {
      return null;
    }

    for (const installation of state.installations) {
      const repos = await getInstallationRepos(installation.id);
      const repository = repos.find(
        (candidate) =>
          candidate.owner.login.toLowerCase() === owner.toLowerCase() &&
          candidate.name.toLowerCase() === repo.toLowerCase(),
      );

      if (repository) {
        return {
          installation,
          repository,
          auth: getGitHubAppAuth(installation.id),
        };
      }
    }

    return null;
  },
);

export async function getRepoSubmitPageData(
  owner: string,
  repo: string,
  branch: string | null,
): Promise<RepoSubmitPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const branches = await listRepositoryBranches(
    context.auth,
    owner,
    context.repository.name,
  ).unwrapOr([]);

  const selectableBranches = branches.filter(
    (candidate) => candidate.name !== context.repository.default_branch,
  );
  const selectedBranch =
    branch && selectableBranches.some((candidate) => candidate.name === branch)
      ? branch
      : (selectableBranches[0]?.name ?? null);

  const [existingPullRequest, openPullRequests] = await Promise.all([
    selectedBranch
      ? findPullRequestByHead(context.auth, owner, context.repository.name, selectedBranch, {
          base: context.repository.default_branch,
          headOwner: context.repository.owner.login,
          state: "all",
        }).unwrapOr(null)
      : Promise.resolve(null),
    listRepositoryPullRequests(context.auth, owner, context.repository.name, "open").unwrapOr([]),
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
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) {
    throw new Error("Repository not found.");
  }

  const existing = await findPullRequestByHead(
    context.auth,
    input.owner,
    context.repository.name,
    input.head,
    {
      base: context.repository.default_branch,
      headOwner: context.repository.owner.login,
      state: "all",
    },
  ).match(
    (pullRequest) => pullRequest,
    (error) => {
      throw error;
    },
  );

  if (!existing) {
    return createPullRequest(context.auth, input.owner, context.repository.name, {
      base: context.repository.default_branch,
      body: input.body,
      draft: input.draft,
      head: input.head,
      title: input.title,
    }).match(
      (pullRequest) => pullRequest,
      (error) => {
        throw error;
      },
    );
  }

  if (existing.state === "closed" || existing.merged) {
    throw new Error("This branch already has a closed pull request.");
  }

  const updated = await updatePullRequest(
    context.auth,
    input.owner,
    context.repository.name,
    existing.number,
    {
      body: input.body,
      title: input.title,
    },
  ).match(
    (pullRequest) => pullRequest,
    (error) => {
      throw error;
    },
  );

  if (input.draft || !updated.draft) {
    return updated;
  }

  return markPullRequestReadyForReview(
    context.auth,
    input.owner,
    context.repository.name,
    updated.number,
  ).match(
    (pullRequest) => pullRequest,
    (error) => {
      throw error;
    },
  );
}

export async function getPullRequestPageData(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const pullRequest = await getPullRequest(
    context.auth,
    owner,
    context.repository.name,
    pullNumber,
  ).unwrapOr(null);
  if (!pullRequest) {
    return null;
  }

  const [diff, issueComments, reviews, reviewComments] = await Promise.all([
    getPullRequestDiff(context.auth, owner, context.repository.name, pullNumber).unwrapOr(""),
    listIssueComments(context.auth, owner, context.repository.name, pullNumber).unwrapOr([]),
    listPullRequestReviews(context.auth, owner, context.repository.name, pullNumber).unwrapOr([]),
    listPullRequestReviewComments(
      context.auth,
      owner,
      context.repository.name,
      pullNumber,
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
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) {
    throw new Error("Repository not found.");
  }

  return createIssueComment(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    input.body,
  ).match(
    (comment) => comment,
    (error) => {
      throw error;
    },
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
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) {
    throw new Error("Repository not found.");
  }

  const pullRequest = await getPullRequest(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
  ).match(
    (result) => result,
    (error) => {
      throw error;
    },
  );

  return submitPullRequestReview(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    {
      body: input.body,
      comments: input.comments,
      commitId: pullRequest.head.sha,
      event: input.event,
    },
  ).match(
    (review) => review,
    (error) => {
      throw error;
    },
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
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) {
    throw new Error("Repository not found.");
  }

  return mergePullRequest(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    {
      mergeMethod: input.mergeMethod,
      commitTitle: input.commitTitle,
      commitMessage: input.commitMessage,
    },
  ).match(
    (result) => result,
    (error) => {
      throw error;
    },
  );
}

// --- Phase 1: Paginated files ---

export async function getPullRequestFileList(
  owner: string,
  repo: string,
  pullNumber: number,
  page = 1,
  perPage = 30,
): Promise<PaginatedFiles | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return listPullRequestFilesPaginated(
    context.auth,
    owner,
    context.repository.name,
    pullNumber,
    page,
    perPage,
  ).unwrapOr(null);
}

// --- Phase 2: Check runs ---

export async function getCheckRunsForPR(
  owner: string,
  repo: string,
  ref: string,
): Promise<GitHubCheckRun[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listCheckRunsForRef(context.auth, owner, context.repository.name, ref).unwrapOr([]);
}

export async function getCheckSummaryForPR(
  owner: string,
  repo: string,
  ref: string,
): Promise<GitHubCheckSummary | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return getCheckSummaryForRef(context.auth, owner, context.repository.name, ref).unwrapOr(null);
}

// --- Phase 4: PR lifecycle management ---

export async function updateRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
}): Promise<GitHubPullRequest> {
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) throw new Error("Repository not found.");

  return updatePullRequest(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    { title: input.title, body: input.body },
  ).match(
    (pr) => pr,
    (error) => { throw error; },
  );
}

export async function requestPullRequestReviewers(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewers: string[];
}): Promise<GitHubPullRequest> {
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) throw new Error("Repository not found.");

  return requestReviewers(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    input.reviewers,
  ).match(
    (pr) => pr,
    (error) => { throw error; },
  );
}

export async function removePullRequestReviewer(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewer: string;
}): Promise<GitHubPullRequest> {
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) throw new Error("Repository not found.");

  return removeReviewers(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    [input.reviewer],
  ).match(
    (pr) => pr,
    (error) => { throw error; },
  );
}

export async function getRepoLabels(
  owner: string,
  repo: string,
): Promise<GitHubLabel[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listRepoLabels(context.auth, owner, context.repository.name).unwrapOr([]);
}

export async function addPullRequestLabels(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  labels: string[];
}): Promise<GitHubLabel[]> {
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) throw new Error("Repository not found.");

  return addLabels(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    input.labels,
  ).match(
    (labels) => labels,
    (error) => { throw error; },
  );
}

export async function removePullRequestLabel(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  label: string;
}): Promise<void> {
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) throw new Error("Repository not found.");

  return removeLabel(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    input.label,
  ).match(
    () => {},
    (error) => { throw error; },
  );
}

export async function convertPullRequestToReady(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequest> {
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) throw new Error("Repository not found.");

  return markPullRequestReadyForReview(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
  ).match(
    (pr) => pr,
    (error) => { throw error; },
  );
}

// --- Phase 5: Repository browser ---

export async function getRepoTree(
  owner: string,
  repo: string,
  ref: string,
  path?: string,
): Promise<GitHubTree | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const treeSha = path ? `${ref}:${path}` : ref;
  return getRepositoryTree(
    context.auth,
    owner,
    context.repository.name,
    treeSha,
  ).unwrapOr(null);
}

export async function getRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GitHubFileContent | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return getFileContent(
    context.auth,
    owner,
    context.repository.name,
    path,
    ref,
  ).unwrapOr(null);
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string },
): Promise<GitHubCommitSummary[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listCommits(
    context.auth,
    owner,
    context.repository.name,
    options,
  ).unwrapOr([]);
}

export async function getRepoBranches(
  owner: string,
  repo: string,
): Promise<GitHubBranch[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listRepositoryBranches(
    context.auth,
    owner,
    context.repository.name,
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

export type InboxPullRequest = GitHubPullRequest & {
  repoFullName: string;
  repoOwner: string;
  repoName: string;
};

export type InboxData = {
  login: string;
  pullRequests: InboxPullRequest[];
};

export async function getInboxData(): Promise<InboxData | null> {
  const state = await getOnboardingState();
  if (state.step !== "has_installations") return null;

  const ghLogin = await getAuthenticatedGitHubLogin();
  if (!ghLogin) return null;

  const allPullRequests: InboxPullRequest[] = [];

  for (const installation of state.installations) {
    const installationAuth = getGitHubAppAuth(installation.id);
    const repos = await getInstallationRepos(installation.id);

    const repoPRResults = await Promise.all(
      repos.map((repo) =>
        listRepositoryPullRequests(installationAuth, repo.owner.login, repo.name, "open").unwrapOr(
          [],
        ),
      ),
    );

    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i]!;
      const prs = repoPRResults[i]!;
      for (const pr of prs) {
        allPullRequests.push({
          ...pr,
          repoFullName: repo.full_name,
          repoOwner: repo.owner.login,
          repoName: repo.name,
        });
      }
    }
  }

  log.info("inbox", `Fetched ${String(allPullRequests.length)} open PRs for ${ghLogin}`);

  return { login: ghLogin, pullRequests: allPullRequests };
}
