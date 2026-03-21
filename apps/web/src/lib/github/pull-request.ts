import "server-only";
import {
  buildPullRequestReviewSignals,
  computeReviewDecision,
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
  type ReviewDecision,
  updatePullRequest,
  type PaginatedFiles,
  type GitHubPullRequest,
  type GitHubPullRequestReviewComment,
} from "@sachikit/github";

import { findRepoContext, requireRepoContext } from "./context";
import { runGitHubEffect, runGitHubEffectOrNotFound } from "./effect";
import { GitHubClosedPullRequestExistsError } from "./errors";
import type {
  PullRequestDiscussionData,
  PullRequestPageData,
  PullRequestPageDetailsData,
  RepoSubmitPageData,
} from "./types";

export async function getRepoSubmitPageData(
  owner: string,
  repo: string,
  branch: string | null,
): Promise<RepoSubmitPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const branches = await runGitHubEffect(listRepositoryBranches(context.auth, owner, context.repository.name));

  const selectableBranches = branches.filter(
    (candidate) => candidate.name !== context.repository.default_branch,
  );
  const selectedBranch =
    branch && selectableBranches.some((candidate) => candidate.name === branch)
      ? branch
      : (selectableBranches[0]?.name ?? null);

  const [existingPullRequest, openPullRequests] = await Promise.all([
    selectedBranch
      ? runGitHubEffectOrNotFound(findPullRequestByHead(context.auth, owner, context.repository.name, selectedBranch, {
        base: context.repository.default_branch,
        headOwner: context.repository.owner.login,
        state: "all",
      }))
      : Promise.resolve(null),
    runGitHubEffect(listRepositoryPullRequests(context.auth, owner, context.repository.name, "open")),
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

  const existing = await runGitHubEffectOrNotFound(findPullRequestByHead(context.auth, input.owner, context.repository.name, input.head, {
    base: context.repository.default_branch,
    headOwner: context.repository.owner.login,
    state: "all",
  }));

  if (!existing) {
    return runGitHubEffect(
      createPullRequest(context.auth, input.owner, context.repository.name, {
        base: context.repository.default_branch,
        body: input.body,
        draft: input.draft,
        head: input.head,
        title: input.title,
      }),
    );
  }

  if (existing.state === "closed" || existing.merged) {
    throw new GitHubClosedPullRequestExistsError({
      code: "closed_pull_request_exists",
      message: "This branch already has a closed pull request.",
      metadata: {
        head: input.head,
        owner: input.owner,
        repo: input.repo,
      },
      operation: "github.pullRequest.saveBranchPullRequest",
      status: 409,
    });
  }

  const updated = await runGitHubEffect(
    updatePullRequest(context.auth, input.owner, context.repository.name, existing.number, {
      body: input.body,
      title: input.title,
    }),
  );

  if (input.draft || !updated.draft) {
    return updated;
  }

  return runGitHubEffect(
    markPullRequestReadyForReview(
      context.auth,
      input.owner,
      context.repository.name,
      updated.number,
    ),
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

  const pullRequest = await runGitHubEffectOrNotFound(getPullRequest(context.auth, owner, context.repository.name, pullNumber));
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
  pullNumber: number,
): Promise<PullRequestDiscussionData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const [issueComments, reviews] = await Promise.all([
    runGitHubEffect(listIssueComments(context.auth, owner, context.repository.name, pullNumber)),
    runGitHubEffect(listPullRequestReviews(context.auth, owner, context.repository.name, pullNumber)),
  ]);

  return {
    issueComments,
    reviews,
  };
}

export async function getPullRequestReviewCommentsData(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubPullRequestReviewComment[] | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  return runGitHubEffect(listPullRequestReviewComments(context.auth, owner, context.repository.name, pullNumber));
}

export async function getPullRequestPageDetailsData(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestPageDetailsData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const [diff, discussion, reviewComments] = await Promise.all([
    runGitHubEffect(getPullRequestDiff(context.auth, owner, context.repository.name, pullNumber)),
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
  perPage = 30,
): Promise<PaginatedFiles | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return runGitHubEffectOrNotFound(listPullRequestFilesPaginated(
    context.auth,
    owner,
    context.repository.name,
    pullNumber,
    page,
    perPage,
  ));
}

export async function updateRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    updatePullRequest(context.auth, input.owner, context.repository.name, input.pullNumber, {
      title: input.title,
      body: input.body,
    }),
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

  return runGitHubEffect(
    mergePullRequest(context.auth, input.owner, context.repository.name, input.pullNumber, {
      mergeMethod: input.mergeMethod,
      commitTitle: input.commitTitle,
      commitMessage: input.commitMessage,
    }),
  );
}

export async function convertPullRequestToReady(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    markPullRequestReadyForReview(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
    ),
  );
}

export async function getRepositoryPullRequestsPageData(
  owner: string,
  repo: string,
): Promise<{
  repository: PullRequestPageData["repository"];
  pullRequests: Array<
    GitHubPullRequest & {
      repoFullName: string;
      repoName: string;
      repoOwner: string;
      reviewDecision: ReviewDecision;
    }
  >;
} | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const rawPulls = await runGitHubEffect(
    listRepositoryPullRequests(context.auth, owner, context.repository.name, "open"),
  );

  const pullRequests = await Promise.all(
    rawPulls.map(async (pr) => {
      const [detail, reviews] = await Promise.all([
        runGitHubEffectOrNotFound(getPullRequest(context.auth, owner, context.repository.name, pr.number)),
        runGitHubEffect(listPullRequestReviews(context.auth, owner, context.repository.name, pr.number)),
      ]);

      const effectivePullRequest = detail ?? pr;
      const reviewDecision: ReviewDecision = computeReviewDecision(
        buildPullRequestReviewSignals(effectivePullRequest, reviews),
      );

      return {
        ...effectivePullRequest,
        repoFullName: context.repository.full_name,
        repoName: repo,
        repoOwner: owner,
        reviewDecision,
      };
    }),
  );

  return {
    repository: context.repository,
    pullRequests,
  };
}
