import type { Octokit } from "octokit";

import { accountFromResponse } from "./client.ts";
import {
  GitHubError,
  type GitHubIssueComment,
  type GitHubLabel,
  type GitHubPullRequest,
  type GitHubPullRequestFile,
  type GitHubPullRequestReview,
  type GitHubPullRequestReviewComment,
} from "./types.ts";

export type PullRequestSummaryResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["list"]>
>["data"][number];

export type PullRequestDetailResponse = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["get"]>
>["data"];

type PullRequestResponse = PullRequestSummaryResponse | PullRequestDetailResponse;

export function toPullRequest(pull: PullRequestResponse): GitHubPullRequest {
  const user = accountFromResponse(pull.user, "pull request author");
  const state = pull.state === "open" ? "open" : "closed";
  const detailed =
    "comments" in pull &&
    "review_comments" in pull &&
    "commits" in pull &&
    "additions" in pull &&
    "deletions" in pull &&
    "changed_files" in pull;

  const requestedReviewers = !Array.isArray(pull.requested_reviewers)
    ? []
    : pull.requested_reviewers.flatMap((reviewer) => {
        if (typeof reviewer !== "object" || reviewer === null) return [];
        const r = reviewer as Record<string, unknown>;
        const login =
          typeof r.login === "string" ? r.login : typeof r.slug === "string" ? r.slug : undefined;
        if (
          typeof r.id !== "number" ||
          typeof r.avatar_url !== "string" ||
          !login ||
          login.length === 0
        ) {
          return [];
        }
        return [
          accountFromResponse(
            {
              id: r.id,
              avatar_url: r.avatar_url,
              login,
              type: r.type as string | undefined,
            },
            "requested reviewer",
          ),
        ];
      });

  return {
    id: pull.id,
    number: pull.number,
    html_url: pull.html_url,
    title: pull.title,
    body: pull.body,
    state,
    draft: pull.draft === true,
    merged: pull.merged_at !== null,
    auto_merge_enabled:
      "auto_merge" in pull && typeof pull.auto_merge === "object" && pull.auto_merge !== null,
    comments: detailed ? pull.comments : null,
    review_comments: detailed ? pull.review_comments : null,
    commits: detailed ? pull.commits : null,
    additions: detailed ? pull.additions : null,
    deletions: detailed ? pull.deletions : null,
    changed_files: detailed ? pull.changed_files : null,
    created_at: pull.created_at,
    updated_at: pull.updated_at,
    user,
    requested_reviewers: requestedReviewers,
    head: { ref: pull.head.ref, sha: pull.head.sha },
    base: { ref: pull.base.ref, sha: pull.base.sha },
  };
}

export function toPullRequestFile(
  file: Awaited<ReturnType<Octokit["rest"]["pulls"]["listFiles"]>>["data"][number],
): GitHubPullRequestFile {
  if (typeof file.sha !== "string" || file.sha.length === 0) {
    throw new GitHubError(
      "GitHub pull request file is missing a sha",
      0,
      "unknown",
      "github.pullRequests.listPullRequestFiles",
    );
  }

  return {
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
  };
}

export function toIssueComment(
  comment: Awaited<ReturnType<Octokit["rest"]["issues"]["listComments"]>>["data"][number],
): GitHubIssueComment {
  return {
    id: comment.id,
    html_url: comment.html_url,
    body: comment.body ?? "",
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    user: accountFromResponse(comment.user, "issue comment author"),
  };
}

export function toReview(
  review: Awaited<ReturnType<Octokit["rest"]["pulls"]["listReviews"]>>["data"][number],
): GitHubPullRequestReview {
  return {
    id: review.id,
    html_url: review.html_url,
    body: review.body ?? null,
    state: review.state,
    submitted_at: review.submitted_at ?? null,
    commit_id: review.commit_id ?? null,
    user: accountFromResponse(review.user, "review author"),
  };
}

function parseSide(side: string | null | undefined): GitHubPullRequestReviewComment["side"] {
  if (side === "LEFT" || side === "RIGHT") return side;
  return null;
}

export function toReviewComment(
  comment: Awaited<ReturnType<Octokit["rest"]["pulls"]["listReviewComments"]>>["data"][number],
): GitHubPullRequestReviewComment {
  return {
    id: comment.id,
    html_url: comment.html_url,
    body: comment.body,
    path: comment.path,
    line: comment.line ?? null,
    side: parseSide(comment.side),
    start_line: comment.start_line ?? null,
    start_side: parseSide(comment.start_side),
    commit_id: comment.commit_id ?? null,
    pull_request_review_id: comment.pull_request_review_id ?? null,
    in_reply_to_id: comment.in_reply_to_id ?? null,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    user: accountFromResponse(comment.user, "review comment author"),
  };
}

export function toLabel(
  label: Awaited<ReturnType<Octokit["rest"]["issues"]["listLabelsForRepo"]>>["data"][number],
): GitHubLabel {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    description: label.description ?? null,
  };
}
