export type GitHubAccount = {
  login: string;
  id: number;
  avatar_url: string;
  type: "User" | "Organization";
};

export type GitHubInstallation = {
  id: number;
  account: GitHubAccount;
  app_slug: string;
  target_type: "User" | "Organization";
  permissions: Record<string, string>;
  repository_selection: "all" | "selected";
  created_at: string;
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubAccount;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
};

export type GitHubBranch = {
  name: string;
  protected: boolean;
  commit: {
    sha: string;
  };
};

export type GitHubPullRequest = {
  id: number;
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  user: GitHubAccount;
  requested_reviewers: GitHubAccount[];
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
};

export type GitHubPullRequestFile = {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string | null;
  raw_url: string | null;
  patch: string | null;
  previous_filename: string | null;
};

export type GitHubIssueComment = {
  id: number;
  html_url: string;
  body: string;
  created_at: string;
  updated_at: string;
  user: GitHubAccount;
};

export type GitHubPullRequestReview = {
  id: number;
  html_url: string;
  body: string | null;
  state: string;
  submitted_at: string | null;
  commit_id: string | null;
  user: GitHubAccount;
};

export type GitHubPullRequestReviewComment = {
  id: number;
  html_url: string;
  body: string;
  path: string;
  line: number | null;
  side: "LEFT" | "RIGHT" | null;
  start_line: number | null;
  start_side: "LEFT" | "RIGHT" | null;
  commit_id: string | null;
  pull_request_review_id: number | null;
  in_reply_to_id: number | null;
  created_at: string;
  updated_at: string;
  user: GitHubAccount;
};

export type GitHubReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type GitHubReviewCommentDraft = {
  path: string;
  body: string;
  line: number;
  side: "LEFT" | "RIGHT";
};

export type GitHubAppInstallationAuth = {
  appId: number;
  privateKey: string;
  installationId: number;
};

export type GitHubErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "unknown";

export class GitHubError extends Error {
  status: number;
  code: GitHubErrorCode;

  constructor(message: string, status: number, code: GitHubErrorCode) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.code = code;
  }
}
