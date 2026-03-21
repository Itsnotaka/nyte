import "server-only";
import {
  addLabels,
  createIssueComment,
  getPullRequest,
  listRepoLabels,
  removeLabel,
  removeReviewers,
  requestReviewers,
  submitPullRequestReview,
  type GitHubIssueComment,
  type GitHubLabel,
  type GitHubPullRequestReview,
  type GitHubReviewCommentDraft,
  type GitHubPullRequest,
  type GitHubReviewEvent,
} from "@sachikit/github";

import { findRepoContext, requireRepoContext } from "./context";
import { runGitHubEffect } from "./effect";

export async function addPullRequestComment(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
}): Promise<GitHubIssueComment> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    createIssueComment(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      input.body,
    ),
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

  const pullRequest = await runGitHubEffect(
    getPullRequest(context.auth, input.owner, context.repository.name, input.pullNumber),
  );

  return runGitHubEffect(
    submitPullRequestReview(context.auth, input.owner, context.repository.name, input.pullNumber, {
      body: input.body,
      comments: input.comments,
      commitId: pullRequest.head.sha,
      event: input.event,
    }),
  );
}

export async function requestPullRequestReviewers(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewers: string[];
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    requestReviewers(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
      input.reviewers,
    ),
  );
}

export async function removePullRequestReviewer(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  reviewer: string;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    removeReviewers(context.auth, input.owner, context.repository.name, input.pullNumber, [
      input.reviewer,
    ]),
  );
}

export async function getRepoLabels(owner: string, repo: string): Promise<GitHubLabel[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return runGitHubEffect(listRepoLabels(context.auth, owner, context.repository.name));
}

export async function addPullRequestLabels(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  labels: string[];
}): Promise<GitHubLabel[]> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    addLabels(context.auth, input.owner, context.repository.name, input.pullNumber, input.labels),
  );
}

export async function removePullRequestLabel(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  label: string;
}): Promise<void> {
  const context = await requireRepoContext(input.owner, input.repo);

  await runGitHubEffect(
    removeLabel(context.auth, input.owner, context.repository.name, input.pullNumber, input.label),
  );
}
