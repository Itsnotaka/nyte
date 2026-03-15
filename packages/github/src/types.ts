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
