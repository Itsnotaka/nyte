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
  comments: number | null;
  review_comments: number | null;
  commits: number | null;
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
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

// --- Check Runs (Phase 2) ---

export type GitHubCheckRun = {
  id: number;
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  app: { name: string; slug: string } | null;
};

export type GitHubCheckSummary = {
  total: number;
  passing: number;
  failing: number;
  pending: number;
  conclusion: "success" | "failure" | "pending" | "neutral";
};

// --- Labels (Phase 4) ---

export type GitHubLabel = {
  id: number;
  name: string;
  color: string;
  description: string | null;
};

// --- Repository Content (Phase 5) ---

export type GitHubTreeEntry = {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size: number | null;
};

export type GitHubTree = {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
};

export type GitHubCommitSummary = {
  sha: string;
  message: string;
  author: { name: string; date: string };
  html_url: string;
};

export type GitHubFileContent = {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  html_url: string;
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
