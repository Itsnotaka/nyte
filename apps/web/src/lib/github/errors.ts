import type { GitHubOperationMetadata } from "@sachikit/github";
import { Data } from "effect";

export type GitHubAppErrorCode =
  | "app_configuration_invalid"
  | "closed_pull_request_exists"
  | "repo_context_not_found";

export type GitHubAppErrorMetadata = GitHubOperationMetadata & {
  field?: "GITHUB_APP_ID";
};

type GitHubAppErrorShape<C extends GitHubAppErrorCode> = {
  readonly message: string;
  readonly status: number;
  readonly code: C;
  readonly operation: string;
  readonly metadata: GitHubAppErrorMetadata;
};

export class GitHubRepoContextNotFoundError extends Data.TaggedError(
  "GitHubRepoContextNotFoundError",
)<GitHubAppErrorShape<"repo_context_not_found">> {}

export class GitHubAppConfigurationError extends Data.TaggedError(
  "GitHubAppConfigurationError",
)<GitHubAppErrorShape<"app_configuration_invalid">> {}

export class GitHubClosedPullRequestExistsError extends Data.TaggedError(
  "GitHubClosedPullRequestExistsError",
)<GitHubAppErrorShape<"closed_pull_request_exists">> {}
