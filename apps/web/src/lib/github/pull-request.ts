import "server-only";
import {
  createPullRequest,
  findPullRequestByHead,
  getPullRequest,
  getPullRequestDiff,
  listIssueComments,
  listPullRequestFilesPaginated,
  listPullRequestReviewComments,
  listPullRequestReviews,
  listRepositoryBranches,
  listRepositoryPullRequests,
  markPullRequestReadyForReview,
  mergePullRequest,
  updatePullRequest,
  type PaginatedFiles,
  type GitHubPullRequest,
  type GitHubPullRequestReviewComment,
} from "@sachikit/github";

import { findRepoContext, requireRepoContext } from "./context";
import type {
  PullRequestDiscussionData,
  PullRequestPageData,
  PullRequestPageDetailsData,
  RepoSubmitPageData,
} from "./types";

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
  ).unwrapOr(null);

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
      (pr) => pr,
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
    (pr) => pr,
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
    (pr) => pr,
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

  return {
    repository: context.repository,
    pullRequest,
  };
}

export async function getPullRequestDiscussionData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestDiscussionData | null> {
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

export async function getPullRequestReviewCommentsData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<GitHubPullRequestReviewComment[] | null> {
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

export async function getPullRequestPageDetailsData(
  owner: string,
  repo: string,
  pullNumber: number
): Promise<PullRequestPageDetailsData | null> {
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

export async function updateRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return updatePullRequest(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    { title: input.title, body: input.body }
  ).match(
    (pr) => pr,
    (error) => {
      throw error;
    }
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

  return mergePullRequest(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber,
    {
      mergeMethod: input.mergeMethod,
      commitTitle: input.commitTitle,
      commitMessage: input.commitMessage,
    }
  ).match(
    (result) => result,
    (error) => {
      throw error;
    }
  );
}

export async function convertPullRequestToReady(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return markPullRequestReadyForReview(
    context.auth,
    input.owner,
    context.repository.name,
    input.pullNumber
  ).match(
    (pr) => pr,
    (error) => {
      throw error;
    }
  );
}
