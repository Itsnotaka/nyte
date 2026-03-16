import type { ResultAsync } from "neverthrow";
import { ok, err } from "neverthrow";
import type { Octokit } from "octokit";

import {
  accountFromResponse,
  type GitHubAccountResponse,
  withGitHubInstallationClient,
} from "./client.ts";
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

function filterRequestedReviewers(
  pull: PullRequestResponse
): GitHubPullRequest["requested_reviewers"] {
  if (!Array.isArray(pull.requested_reviewers)) return [];

  return pull.requested_reviewers.flatMap((reviewer) => {
    if (!reviewer || !("login" in reviewer)) return [];
    try {
      return [
        accountFromResponse(
          reviewer as GitHubAccountResponse,
          "requested reviewer"
        ),
      ];
    } catch {
      return [];
    }
  });
}

function mapPullRequest(pull: PullRequestResponse): GitHubPullRequest {
  const user = accountFromResponse(pull.user, "pull request author");
  const state = pull.state as GitHubPullRequest["state"];
  const detailed = isDetailedPullRequest(pull);

  return {
    id: pull.id,
    number: pull.number,
    html_url: pull.html_url,
    title: pull.title,
    body: pull.body,
    state,
    draft: pull.draft === true,
    merged: pull.merged_at !== null,
    comments: detailed ? pull.comments : 0,
    review_comments: detailed ? pull.review_comments : 0,
    commits: detailed ? pull.commits : 0,
    additions: detailed ? pull.additions : 0,
    deletions: detailed ? pull.deletions : 0,
    changed_files: detailed ? pull.changed_files : 0,
    created_at: pull.created_at,
    updated_at: pull.updated_at,
    user,
    requested_reviewers: filterRequestedReviewers(pull),
    head: { ref: pull.head.ref, sha: pull.head.sha },
    base: { ref: pull.base.ref, sha: pull.base.sha },
  };
}

function mapPullRequestFile(
  file: Awaited<
    ReturnType<Octokit["rest"]["pulls"]["listFiles"]>
  >["data"][number]
): GitHubPullRequestFile {
  if (typeof file.sha !== "string" || file.sha.length === 0) {
    throw new GitHubError(
      "GitHub pull request file is missing a sha",
      0,
      "unknown"
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

function mapIssueComment(
  comment: Awaited<
    ReturnType<Octokit["rest"]["issues"]["listComments"]>
  >["data"][number]
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

function mapReview(
  review: Awaited<
    ReturnType<Octokit["rest"]["pulls"]["listReviews"]>
  >["data"][number]
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

function parseSide(
  side: string | null | undefined
): GitHubPullRequestReviewComment["side"] {
  if (side === "LEFT" || side === "RIGHT") return side;
  return null;
}

function mapReviewComment(
  comment: Awaited<
    ReturnType<Octokit["rest"]["pulls"]["listReviewComments"]>
  >["data"][number]
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

export function listRepositoryPullRequests(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open"
): ResultAsync<GitHubPullRequest[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const pulls = await client.paginate(client.rest.pulls.list, {
      owner,
      repo,
      state,
      per_page: 100,
    });
    return pulls.map(mapPullRequest);
  });
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
    const pulls = await client.paginate(client.rest.pulls.list, {
      owner,
      repo,
      head: `${headOwner}:${head}`,
      state,
      per_page: 100,
    });

    const match =
      options?.base == null
        ? pulls[0]
        : pulls.find((pull) => pull.base.ref === options.base);

    return match == null ? null : mapPullRequest(match);
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
    return mapPullRequest(response.data);
  });
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
    return mapPullRequest(response.data);
  });
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
    return mapPullRequest(response.data);
  });
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
    return mapPullRequest(response.data as PullRequestDetailResponse);
  });
}

export function listPullRequestFiles(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequestFile[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const files = await client.paginate(client.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return files.map(mapPullRequestFile);
  });
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
      mediaType: { format: "diff" },
    });
    return response.data;
  }).andThen((data) => {
    if (typeof data === "string") return ok(data);
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
    const comments = await client.paginate(client.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });
    return comments.map(mapIssueComment);
  });
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
    return mapIssueComment(response.data);
  });
}

export function listPullRequestReviews(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequestReview[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const reviews = await client.paginate(client.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    return reviews.map(mapReview);
  });
}

export function listPullRequestReviewComments(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number
): ResultAsync<GitHubPullRequestReviewComment[], GitHubError> {
  return withGitHubInstallationClient(auth, async (client) => {
    const comments = await client.paginate(
      client.rest.pulls.listReviewComments,
      {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
      }
    );
    return comments.map(mapReviewComment);
  });
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
    return mapReview(response.data);
  });
}
