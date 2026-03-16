import "server-only";
import {
  createIssueComment,
  createPullRequest,
  findPullRequestByHead,
  getInstallUrl,
  getPullRequest,
  getPullRequestDiff,
  listInstallationRepos,
  listIssueComments,
  listPullRequestReviewComments,
  listPullRequestReviews,
  listRepositoryBranches,
  listRepositoryPullRequests,
  listUserInstallations,
  markPullRequestReadyForReview,
  submitPullRequestReview,
  type GitHubAppInstallationAuth,
  type GitHubBranch,
  type GitHubInstallation,
  type GitHubIssueComment,
  type GitHubPullRequest,
  type GitHubPullRequestReview,
  type GitHubPullRequestReviewComment,
  type GitHubRepository,
  type GitHubReviewCommentDraft,
  type GitHubReviewEvent,
  updatePullRequest,
} from "@sachikit/github";
import { err, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "../auth";
import { getSession } from "../auth/server";
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
          candidate.name.toLowerCase() === repo.toLowerCase()
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
  }
);

export async function getRepoBranches(
  owner: string,
  repo: string
): Promise<{ repository: GitHubRepository; branches: GitHubBranch[] } | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const branches = await listRepositoryBranches(
    context.auth,
    owner,
    context.repository.name
  ).unwrapOr([]);

  return {
    repository: context.repository,
    branches,
  };
}

export async function getRepoPullRequests(
  owner: string,
  repo: string
): Promise<{ repository: GitHubRepository; pullRequests: GitHubPullRequest[] } | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const pullRequests = await listRepositoryPullRequests(
    context.auth,
    owner,
    context.repository.name,
    "open"
  ).unwrapOr([]);

  return {
    repository: context.repository,
    pullRequests,
  };
}

export async function getBranchPullRequest(
  owner: string,
  repo: string,
  branch: string
): Promise<{ repository: GitHubRepository; pullRequest: GitHubPullRequest | null } | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const pullRequest = await findPullRequestByHead(
    context.auth,
    owner,
    context.repository.name,
    branch,
    {
      base: context.repository.default_branch,
      headOwner: context.repository.owner.login,
      state: "all",
    }
  ).unwrapOr(null);

  return {
    repository: context.repository,
    pullRequest,
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
    }
  ).match(
    (pullRequest) => pullRequest,
    (error) => {
      throw error;
    }
  );

  if (!existing) {
    return createPullRequest(
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
    ).match(
      (pullRequest) => pullRequest,
      (error) => {
        throw error;
      }
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
    }
  ).match(
    (pullRequest) => pullRequest,
    (error) => {
      throw error;
    }
  );

  if (input.draft || !updated.draft) {
    return updated;
  }

  return markPullRequestReadyForReview(
    context.auth,
    input.owner,
    context.repository.name,
    updated.number
  ).match(
    (pullRequest) => pullRequest,
    (error) => {
      throw error;
    }
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
  const context = await findRepoContext(input.owner, input.repo);
  if (!context) {
    throw new Error("Repository not found.");
  }

  return createIssueComment(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    input.body
  ).match(
    (comment) => comment,
    (error) => {
      throw error;
    }
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
    input.pullNumber
  ).match(
    (result) => result,
    (error) => {
      throw error;
    }
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
    }
  ).match(
    (review) => review,
    (error) => {
      throw error;
    }
  );
}
