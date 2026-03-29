import "server-only";

import { GitHubError } from "@sachikit/github";

export function isUnauthorized(error: unknown): error is GitHubError {
  return error instanceof GitHubError && error.code === "unauthorized";
}
