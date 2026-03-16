import { createAppAuth } from "@octokit/auth-app";
import { err, ok, ResultAsync } from "neverthrow";
import type { Result } from "neverthrow";
import { Octokit } from "octokit";

import {
  GitHubError,
  type GitHubAccount,
  type GitHubAppInstallationAuth,
  type GitHubErrorCode,
} from "./types.ts";

const USER_AGENT = "@nyte/github";

type GitHubRequestFailure = {
  status?: unknown;
  response?: {
    data?: unknown;
  };
  message?: unknown;
};

/**
 * Shared subset of nested GitHub account objects returned by installation,
 * repository, pull request, and comment REST responses.
 */
type GitHubAccountResponse = {
  id: number;
  avatar_url: string;
  login?: string;
  slug?: string;
  type?: string;
};

function errorCodeFromStatus(status: number): GitHubErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}

function isGitHubRequestFailure(error: unknown): error is GitHubRequestFailure {
  return typeof error === "object" && error !== null;
}

function messageFromResponseData(data: unknown): string | null {
  if (typeof data === "string" && data.trim().length > 0) {
    return data;
  }

  if (typeof data !== "object" || data === null) {
    return null;
  }

  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim().length > 0
    ? message
    : null;
}

function errorMessageFromFailure(
  error: GitHubRequestFailure,
  status: number
): string {
  const responseMessage = messageFromResponseData(error.response?.data);
  if (responseMessage) {
    return responseMessage;
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return status > 0
    ? `GitHub API error: ${status}`
    : "GitHub API request failed";
}

function accountTypeFromResponse(
  type: string,
  accountLabel: string
): Result<GitHubAccount["type"], GitHubError> {
  if (type === "User" || type === "Organization") {
    return ok(type);
  }

  return err(
    new GitHubError(
      `GitHub ${accountLabel} has unsupported account type: ${type}`,
      0,
      "unknown"
    )
  );
}

export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: USER_AGENT,
  });
}

export function createGitHubInstallationClient(
  auth: GitHubAppInstallationAuth
): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: auth.appId,
      privateKey: auth.privateKey,
      installationId: auth.installationId,
    },
    userAgent: USER_AGENT,
  });
}

export function normalizeGitHubError(error: unknown): GitHubError {
  if (error instanceof GitHubError) {
    return error;
  }

  const status =
    isGitHubRequestFailure(error) && typeof error.status === "number"
      ? error.status
      : 0;

  const message = isGitHubRequestFailure(error)
    ? errorMessageFromFailure(error, status)
    : error instanceof Error && error.message.trim().length > 0
      ? error.message
      : status > 0
        ? `GitHub API error: ${status}`
        : "GitHub API request failed";

  return new GitHubError(message, status, errorCodeFromStatus(status));
}

export function toGitHubAccount(
  account: GitHubAccountResponse | null,
  accountLabel: string
): Result<GitHubAccount, GitHubError> {
  if (!account) {
    return err(
      new GitHubError(
        `GitHub ${accountLabel} is missing account details`,
        0,
        "unknown"
      )
    );
  }

  const login = account.login;
  if (typeof login === "string" && typeof account.type === "string") {
    return accountTypeFromResponse(account.type, accountLabel).map((type) => ({
      login,
      id: account.id,
      avatar_url: account.avatar_url,
      type,
    }));
  }

  if (typeof account.slug === "string" && account.slug.length > 0) {
    return ok({
      login: account.slug,
      id: account.id,
      avatar_url: account.avatar_url,
      type: "Organization",
    });
  }

  return err(
    new GitHubError(
      `GitHub ${accountLabel} is missing a canonical login`,
      0,
      "unknown"
    )
  );
}

export function withGitHubClient<T>(
  token: string,
  run: (client: Octokit) => Promise<T>
): ResultAsync<T, GitHubError> {
  const client = createGitHubClient(token);
  return ResultAsync.fromPromise(run(client), normalizeGitHubError);
}

export function withGitHubInstallationClient<T>(
  auth: GitHubAppInstallationAuth,
  run: (client: Octokit) => Promise<T>
): ResultAsync<T, GitHubError> {
  const client = createGitHubInstallationClient(auth);
  return ResultAsync.fromPromise(run(client), normalizeGitHubError);
}
