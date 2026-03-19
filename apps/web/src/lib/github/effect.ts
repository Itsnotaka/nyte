import "server-only";
import {
  GitHubError,
  GitHubServiceLayer,
  GitHubTelemetry,
  type GitHubTelemetryEvent,
} from "@sachikit/github";
import { Cause, Effect, Exit, Layer } from "effect";

import { log } from "../evlog";

const gitHubTelemetryLayer = Layer.succeed(GitHubTelemetry)({
  onFailure: (event: GitHubTelemetryEvent, error: GitHubError) =>
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
  onSuccess: (event: GitHubTelemetryEvent) =>
    Effect.sync(() => {
      log.info({
        area: "github.effect",
        message: "GitHub request completed",
        ...event,
      });
    }),
});

const gitHubRuntimeLayer = GitHubServiceLayer.pipe(Layer.provideMerge(gitHubTelemetryLayer));

type GitHubRuntimeServices = Layer.Success<typeof gitHubRuntimeLayer>;

export type GitHubRuntimeEffect<A> = Effect.Effect<A, GitHubError, GitHubRuntimeServices>;

export async function runGitHubEffectExit<A>(
  effect: GitHubRuntimeEffect<A>,
): Promise<Exit.Exit<A, GitHubError>> {
  return Effect.runPromiseExit(effect.pipe(Effect.provide(gitHubRuntimeLayer)));
}

export async function runGitHubEffect<A>(effect: GitHubRuntimeEffect<A>): Promise<A> {
  const exit = await runGitHubEffectExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  throw Cause.squash(exit.cause);
}

export async function runGitHubEffectOrNull<A>(effect: GitHubRuntimeEffect<A>): Promise<A | null> {
  return runGitHubEffect(
    effect.pipe(Effect.catchTag("GitHubError", () => Effect.succeed<A | null>(null))),
  );
}

export async function runGitHubEffectOrEmptyArray<A>(
  effect: GitHubRuntimeEffect<ReadonlyArray<A>>,
): Promise<A[]> {
  const items: ReadonlyArray<A> = await runGitHubEffect(
    effect.pipe(Effect.catchTag("GitHubError", () => Effect.succeed<ReadonlyArray<A>>([]))),
  );
  return Array.from(items);
}
