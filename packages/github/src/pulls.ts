import { Result, err, ok } from "neverthrow";
import type { ResultAsync } from "neverthrow";
import type { Octokit } from "octokit";

import { toGitHubAccount, withGitHubInstallationClient } from "./client.ts";
import {
  type GitHubAppInstallationAuth,
  type GitHubIssueComment,
  GitHubError,
  type GitHubPullRequest,
  type GitHubPullRequestFile,
  type GitHubPullRequestReview,
  type GitHubPullRequestReviewComment,
  type GitHubReviewCommentDraft,
  type GitHubReviewEvent,
} from "./types.ts";

type PullRequestSummaryResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["list"]>
>["data"][number];
type PullRequestDetailResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["get"]>
>["data"];
type PullRequestResponse =
  | PullRequestSummaryResponse
  | PullRequestDetailResponse;
type PullRequestFileResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["listFiles"]>
>["data"][number];
type IssueCommentResponse = Awaited<
  ReturnType<Octokit["rest"]["issues"]["listComments"]>
>["data"][number];
type ReviewResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["listReviews"]>
>["data"][number];
type ReviewCommentResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["listReviewComments"]>
>["data"][number];

function pullRequestStateFromResponse(
  state: string
): Result<GitHubPullRequest["state"], GitHubError> {
  if (state === "open" || state === "closed") {
    return ok(state);
  }

  return err(
    new GitHubError(
      `GitHub pull request has unsupported state: ${state}`,
      0,
      "unknown"
    )
  );
}

function reviewCommentSideFromResponse(
  side: string | null | undefined,
  fieldLabel: "side" | "start side"
): Result<GitHubPullRequestReviewComment["side"], GitHubError> {
  if (side == null || side === "LEFT" || side === "RIGHT") {
    return ok(side ?? null);
  }

  return err(
    new GitHubError(
      `GitHub review comment has unsupported ${fieldLabel}: ${side}`,
      0,
      "unknown"
    )
  );
}

function isDetailedPullRequest(
  pull: PullRequestResponse
): pull is PullRequestDetailResponse {
  return (
    "comments" in pull &&
    "review_comments" in pull &&
    "commits" in pull &&
    "additions" in pull &&
    "deletions" in pull &&
    "changed_files" in pull
  );
}

function toGitHubPullRequest(
  pull: PullRequestResponse
): Result<GitHubPullRequest, GitHubError> {
  const counts = isDetailedPullRequest(pull)
    ? {
        additions: pull.additions,
        changed_files: pull.changed_files,
        comments: pull.comments,
        commits: pull.commits,
        deletions: pull.deletions,
        review_comments: pull.review_comments,
      }
    : {
        additions: 0,
        changed_files: 0,
        comments: 0,
        commits: 0,
        deletions: 0,
        review_comments: 0,
      };

  return toGitHubAccount(pull.user, "pull request author").andThen((user) =>
    pullRequestStateFromResponse(pull.state).map((state) => ({
      id: pull.id,
      number: pull.number,
      html_url: pull.html_url,
      title: pull.title,
      body: pull.body,
      state,
      draft: pull.draft === true,
      merged: pull.merged_at !== null,
      comments: counts.comments,
      review_comments: counts.review_comments,
      commits: counts.commits,
      additions: counts.additions,
      deletions: counts.deletions,
      changed_files: counts.changed_files,
      created_at: pull.created_at,
      updated_at: pull.updated_at,
      user,
      head: {
        ref: pull.head.ref,
        sha: pull.head.sha,
      },
      base: {
        ref: pull.base.ref,
        sha: pull.base.sha,
      },
    }))
  );
}

function toGitHubPullRequestFile(
  file: PullRequestFileResponse
): Result<GitHubPullRequestFile, GitHubError> {
  if (typeof file.sha !== "string" || file.sha.length === 0) {
    return err(
      new GitHubError("GitHub pull request file is missing a sha", 0, "unknown")
    );
  }

  return ok({
    sha: file.sha,
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    blob_url: file.blob_url,
    raw_url: file.raw_url,
    patch: file.patch ?? null,
    previous_filename: file.previous_filename ?? null,
  });
}

function toGitHubIssueComment(
  comment: IssueCommentResponse
): Result<GitHubIssueComment, GitHubError> {
  return toGitHubAccount(comment.user, "issue comment author").map((user) => ({
    id: comment.id,
    html_url: comment.html_url,
    body: comment.body ?? "",
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    user,
  }));
}

function toGitHubPullRequestReview(
  review: ReviewResponse
): Result<GitHubPullRequestReview, GitHubError> {
  return toGitHubAccount(review.user, "pull request review author").map(
    (user) => ({
      id: review.id,
      html_url: review.html_url,
      body: review.body ?? null,
      state: review.state,
      submitted_at: review.submitted_at ?? null,
      commit_id: review.commit_id ?? null,
      user,
    })
  );
}

function toGitHubPullRequestReviewComment(
  comment: ReviewCommentResponse
): Result<GitHubPullRequestReviewComment, GitHubError> {
  return toGitHubAccount(comment.user, "review comment author").andThen(
    (user) =>
      reviewCommentSideFromResponse(comment.side ?? null, "side").andThen(
        (side) =>
          reviewCommentSideFromResponse(
            comment.start_side ?? null,
            "start side"
          ).map((startSide) => ({
            id: comment.id,
            html_url: comment.html_url,
            body: comment.body,
            path: comment.path,
            line: comment.line ?? null,
            side,
            start_line: comment.start_line ?? null,
            start_side: startSide,
            commit_id: comment.commit_id ?? null,
            pull_request_review_id: comment.pull_request_review_id ?? null,
            in_reply_to_id: comment.in_reply_to_id ?? null,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            user,
          }))
      )
  );
}

export function listRepositoryPullRequests(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open"
): ResultAsync<GitHubPullRequest[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.pulls.list, {
      owner,
      repo,
      state,
      per_page: 100,
    });
  }).andThen((pulls) => Result.combine(pulls.map(toGitHubPullRequest)));
}

export function findPullRequestByHead(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  head: string,
  options?: {
    headOwner?: string;
    state?: "open" | "closed" | "all";
    base?: string;
  }
): ResultAsync<GitHubPullRequest | null, GitHubError> {
  const headOwner = options?.headOwner ?? owner;
  const state = options?.state ?? "open";

  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.pulls.list, {
      owner,
      repo,
      head: `${headOwner}:${head}`,
      state,
      per_page: 100,
    });
  }).andThen((pulls) => {
    const match =
      options?.base == null
        ? pulls[0]
        : pulls.find((pull) => pull.base.ref === options.base);

    return match == null ? ok(null) : toGitHubPullRequest(match);
  });
}

export function getPullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequest, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });
    return response.data;
  }).andThen((pull) => toGitHubPullRequest(pull));
}

export function createPullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  input: {
    title: string;
    body: string;
    head: string;
    base: string;
    draft: boolean;
  }
): ResultAsync<GitHubPullRequest, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.pulls.create({
      owner,
      repo,
      title: input.title,
      body: input.body,
      head: input.head,
      base: input.base,
      draft: input.draft,
    });
    return response.data;
  }).andThen((pull) => toGitHubPullRequest(pull));
}

export function updatePullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  input: {
    title: string;
    body: string;
  }
): ResultAsync<GitHubPullRequest, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      title: input.title,
      body: input.body,
    });
    return response.data;
  }).andThen((pull) => toGitHubPullRequest(pull));
}

export function markPullRequestReadyForReview(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequest, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.request(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/ready_for_review",
      {
        owner,
        repo,
        pull_number: pullNumber,
      }
    );
    return response.data as PullRequestDetailResponse;
  }).andThen((pull) => toGitHubPullRequest(pull));
}

export function listPullRequestFiles(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequestFile[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
  }).andThen((files) => Result.combine(files.map(toGitHubPullRequestFile)));
}

export function getPullRequestDiff(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<string, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      mediaType: {
        format: "diff",
      },
    });
    return response.data;
  }).andThen((data) => {
    if (typeof data === "string") {
      return ok(data);
    }

    return err(
      new GitHubError(
        "GitHub pull request diff response was not a string",
        0,
        "unknown"
      )
    );
  });
}

export function listIssueComments(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  issueNumber: number
): ResultAsync<GitHubIssueComment[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });
  }).andThen((comments) => Result.combine(comments.map(toGitHubIssueComment)));
}

export function createIssueComment(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): ResultAsync<GitHubIssueComment, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return response.data;
  }).andThen((comment) => toGitHubIssueComment(comment));
}

export function listPullRequestReviews(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequestReview[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
  }).andThen((reviews) =>
    Result.combine(reviews.map(toGitHubPullRequestReview))
  );
}

export function listPullRequestReviewComments(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequestReviewComment[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    return client.paginate(client.rest.pulls.listReviewComments, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
  }).andThen((comments) =>
    Result.combine(comments.map(toGitHubPullRequestReviewComment))
  );
}

export function submitPullRequestReview(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  input: {
    event: GitHubReviewEvent;
    body?: string;
    commitId?: string;
    comments?: GitHubReviewCommentDraft[];
  }
): ResultAsync<GitHubPullRequestReview, GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const response = await client.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      event: input.event,
      body: input.body,
      commit_id: input.commitId,
      comments: input.comments?.map((comment) => ({
        path: comment.path,
        body: comment.body,
        line: comment.line,
        side: comment.side,
      })),
    });
    return response.data;
  }).andThen((review) => toGitHubPullRequestReview(review));
}
