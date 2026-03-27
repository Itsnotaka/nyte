import { createAppAuth } from "@octokit/auth-app";
import { Effect, Layer, ServiceMap } from "effect";
import { Octokit } from "octokit";

import {
  GitHubError,
  type GitHubAccount,
  type GitHubAppInstallationAuth,
  type GitHubErrorCode,
  type GitHubOperationMetadata,
} from "./types.ts";

const USER_AGENT = "@sachikit/github";
type GitHubAuthKind = "user" | "installation";

type GitHubRequestFailure = {
  status?: unknown;
  response?: {
    data?: unknown;
  };
  message?: unknown;
};

export type GitHubAccountResponse = {
  id: number;
  avatar_url: string;
  login?: string;
  slug?: string;
  type?: string;
} | null;

export type GitHubTelemetryEvent = GitHubOperationMetadata & {
  authKind: GitHubAuthKind;
  durationMs: number;
  operation: string;
};

type GitHubTelemetryShape = {
  onFailure: (event: GitHubTelemetryEvent, error: GitHubError) => Effect.Effect<void>;
  onSuccess: (event: GitHubTelemetryEvent) => Effect.Effect<void>;
};

type GitHubClientShape = {
  withInstallationClient: <T>(
    auth: GitHubAppInstallationAuth,
    operation: string,
    run: (client: Octokit) => Promise<T>,
    metadata?: GitHubOperationMetadata,
  ) => Effect.Effect<T, GitHubError>;
  /** GitHub App user-to-server OAuth access token (e.g. from Better Auth), not a PAT. */
  withUserClient: <T>(
    token: string,
    operation: string,
    run: (client: Octokit) => Promise<T>,
    metadata?: GitHubOperationMetadata,
  ) => Effect.Effect<T, GitHubError>;
};

export class GitHubTelemetry extends ServiceMap.Service<GitHubTelemetry, GitHubTelemetryShape>()(
  "GitHubTelemetry",
) {}

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

  const message = (data as Record<string, unknown>).message;
  return typeof message === "string" && message.trim().length > 0 ? message : null;
}

function errorMessageFromFailure(error: GitHubRequestFailure, status: number): string {
  const responseMessage = messageFromResponseData(error.response?.data);
  if (responseMessage) {
    return responseMessage;
  }

  if (typeof error.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }

  return status > 0 ? `GitHub API error: ${status}` : "GitHub API request failed";
}

export function accountFromResponse(account: GitHubAccountResponse, label: string): GitHubAccount {
  if (!account) {
    throw new GitHubError(`GitHub ${label} is missing account details`, 0, "unknown");
  }

  const login = account.login ?? account.slug;
  if (!login) {
    throw new GitHubError(`GitHub ${label} is missing a login`, 0, "unknown");
  }

  const type: GitHubAccount["type"] = account.type === "Organization" ? "Organization" : "User";

  return { login, id: account.id, avatar_url: account.avatar_url, type };
}

export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: USER_AGENT,
  });
}

export function createGitHubInstallationClient(auth: GitHubAppInstallationAuth): Octokit {
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

export function normalizeGitHubError(
  error: unknown,
  operation = "github.request",
  metadata: GitHubOperationMetadata = {},
): GitHubError {
  if (error instanceof GitHubError) {
    return error;
  }

  const status =
    isGitHubRequestFailure(error) && typeof error.status === "number" ? error.status : 0;

  const message = isGitHubRequestFailure(error)
    ? errorMessageFromFailure(error, status)
    : error instanceof Error && error.message.trim().length > 0
      ? error.message
      : status > 0
        ? `GitHub API error: ${status}`
        : "GitHub API request failed";

  return new GitHubError(message, status, errorCodeFromStatus(status), operation, metadata);
}

function runGitHubRequest<T>(
  telemetry: GitHubTelemetryShape,
  authKind: GitHubAuthKind,
  operation: string,
  metadata: GitHubOperationMetadata,
  createClient: () => Octokit,
  run: (client: Octokit) => Promise<T>,
): Effect.Effect<T, GitHubError> {
  const startedAt = Date.now();
  const event = (): GitHubTelemetryEvent => ({
    ...metadata,
    authKind,
    durationMs: Date.now() - startedAt,
    operation,
  });

  return Effect.tryPromise({
    try: () => run(createClient()),
    catch: (error) => normalizeGitHubError(error, operation, metadata),
  }).pipe(
    Effect.tap(() => telemetry.onSuccess(event())),
    Effect.tapError((error) => telemetry.onFailure(event(), error)),
  );
}

export class GitHubClientService extends ServiceMap.Service<
  GitHubClientService,
  GitHubClientShape
>()("GitHubClientService", {
  make: Effect.gen(function* () {
    const telemetry = yield* GitHubTelemetry;
    return {
      withInstallationClient: (auth, operation, run, metadata = {}) =>
        runGitHubRequest(
          telemetry,
          "installation",
          operation,
          {
            ...metadata,
            installationId: metadata.installationId ?? auth.installationId,
          },
          () => createGitHubInstallationClient(auth),
          run,
        ),
      withUserClient: (token, operation, run, metadata = {}) =>
        runGitHubRequest(
          telemetry,
          "user",
          operation,
          metadata,
          () => createGitHubClient(token),
          run,
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make);
}

export function withGitHubClient<T>(
  token: string,
  run: (client: Octokit) => Promise<T>,
  options?: {
    metadata?: GitHubOperationMetadata;
    operation?: string;
  },
): Effect.Effect<T, GitHubError, GitHubClientService> {
  return GitHubClientService.use((service) =>
    service.withUserClient(
      token,
      options?.operation ?? "github.user.request",
      run,
      options?.metadata,
    ),
  );
}

export function withGitHubInstallationClient<T>(
  auth: GitHubAppInstallationAuth,
  run: (client: Octokit) => Promise<T>,
  options?: {
    metadata?: GitHubOperationMetadata;
    operation?: string;
  },
): Effect.Effect<T, GitHubError, GitHubClientService> {
  return GitHubClientService.use((service) =>
    service.withInstallationClient(
      auth,
      options?.operation ?? "github.installation.request",
      run,
      options?.metadata,
    ),
  );
}
