import "server-only";

import { createGitHubRuntime, GitHubError } from "@sachikit/github";
import { Effect } from "effect";

import { log } from "../evlog";

const gitHubRuntime = createGitHubRuntime({
  onFailure: (event, error) =>
    Effect.sync(() => {
      log.error({
        area: "github.effect",
        message: "GitHub request failed",
        ...event,
        failure: {
          code: error.code,
          message: error.message,
          metadata: error.metadata,
          operation: error.operation,
          status: error.status,
        },
      });
    }),
  onSuccess: (event) =>
    Effect.sync(() => {
      log.info({
        area: "github.effect",
        message: "GitHub request completed",
        ...event,
      });
    }),
});

export type { GitHubRuntimeEffect } from "@sachikit/github";
export function isUnauthorized(error: unknown): error is GitHubError {
  return error instanceof GitHubError && error.code === "unauthorized";
}
export const runGitHubEffectExit = gitHubRuntime.runExit;
export const runGitHubEffect = gitHubRuntime.run;
export const runGitHubEffectOrNotFound = gitHubRuntime.runNotFoundOrNull;