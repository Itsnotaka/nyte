import { Data } from "effect";

export class GitHubRepoContextNotFoundError extends Data.TaggedError(
  "GitHubRepoContextNotFoundError",
)<{
  readonly message: string;
  readonly owner: string;
  readonly repo: string;
}> {}

export class GitHubAppConfigurationError extends Data.TaggedError("GitHubAppConfigurationError")<{
  readonly message: string;
}> {}

export class GitHubClosedPullRequestExistsError extends Data.TaggedError(
  "GitHubClosedPullRequestExistsError",
)<{
  readonly message: string;
  readonly owner: string;
  readonly repo: string;
  readonly head: string;
}> {}

export function isGitHubRepoContextNotFoundError(
  error: unknown,
): error is GitHubRepoContextNotFoundError {
  return error instanceof GitHubRepoContextNotFoundError;
}

export function isGitHubAppConfigurationError(
  error: unknown,
): error is GitHubAppConfigurationError {
  return error instanceof GitHubAppConfigurationError;
}

export function isGitHubClosedPullRequestExistsError(
  error: unknown,
): error is GitHubClosedPullRequestExistsError {
  return error instanceof GitHubClosedPullRequestExistsError;
}
