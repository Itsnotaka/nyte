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
  id: string;
  name: string;
  nameWithOwner: string;
  url: string;
  isPrivate: boolean;
  defaultBranchRef: { name: string } | null;
  owner: { login: string };
};

export type GitHubErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "unknown";

export class GitHubError extends Error {
  readonly status: number;
  readonly code: GitHubErrorCode;

  constructor(message: string, status: number, code: GitHubErrorCode) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.code = code;
  }
}
