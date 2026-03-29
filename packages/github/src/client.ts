import { Octokit } from "octokit";

import { GitHubError, type GitHubAccount, type GitHubErrorCode } from "./types.ts";

export function createClient(token: string): Octokit {
  return new Octokit({ auth: token, userAgent: "@sachikit/github" });
}

function codeFromStatus(status: number): GitHubErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}

function message(error: Record<string, unknown>, status: number): string {
  const resp = error.response as Record<string, unknown> | undefined;
  const data = resp?.data as Record<string, unknown> | string | undefined;

  if (typeof data === "string" && data.trim()) return data;
  if (typeof data === "object" && data && typeof data.message === "string" && (data.message as string).trim()) {
    return data.message as string;
  }
  if (typeof error.message === "string" && (error.message as string).trim()) return error.message as string;
  return status > 0 ? `GitHub API error: ${status}` : "GitHub API request failed";
}

export function normalize(error: unknown): GitHubError {
  if (error instanceof GitHubError) return error;
  if (!error || typeof error !== "object") return new GitHubError("GitHub API request failed", 0, "unknown");

  const record = error as Record<string, unknown>;
  const status = typeof record.status === "number" ? record.status : 0;
  return new GitHubError(message(record, status), status, codeFromStatus(status));
}

type AccountResponse = {
  id: number;
  avatar_url: string;
  login?: string;
  slug?: string;
  type?: string;
} | null;

export function account(raw: AccountResponse, label: string): GitHubAccount {
  if (!raw) throw new GitHubError(`GitHub ${label} is missing account details`, 0, "unknown");
  const login = raw.login ?? raw.slug;
  if (!login) throw new GitHubError(`GitHub ${label} is missing a login`, 0, "unknown");
  return {
    login,
    id: raw.id,
    avatar_url: raw.avatar_url,
    type: raw.type === "Organization" ? "Organization" : "User",
  };
}
