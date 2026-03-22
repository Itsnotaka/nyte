import { Cause, Effect, Exit, Layer } from "effect";

import { GitHubBranchesService } from "./branches.ts";
import { GitHubChecksService } from "./checks.ts";
import { GitHubTelemetry, type GitHubTelemetryEvent } from "./client.ts";
import { GitHubClientService } from "./client.ts";
import { GitHubInstallationsService } from "./installations.ts";
import { GitHubLabelsService } from "./labels.ts";
import { GitHubPullRequestsService } from "./pull-requests.ts";
import { GitHubRepositoriesService } from "./repositories.ts";
import { GitHubReviewsService } from "./reviews.ts";
import { GitHubError } from "./types.ts";

export const GitHubServiceLayer = Layer.mergeAll(
  GitHubClientService.layer,
  GitHubInstallationsService.layer,
  GitHubRepositoriesService.layer,
  GitHubBranchesService.layer,
  GitHubChecksService.layer,
  GitHubPullRequestsService.layer,
  GitHubReviewsService.layer,
  GitHubLabelsService.layer,
);

export type GitHubRuntimeEffect<A> = Effect.Effect<
  A,
  GitHubError,
  Layer.Success<typeof GitHubServiceLayer>
>;

type GitHubRuntime = {
  runExit: <A>(effect: GitHubRuntimeEffect<A>) => Promise<Exit.Exit<A, GitHubError>>;
  run: <A>(effect: GitHubRuntimeEffect<A>) => Promise<A>;
  runNotFoundOrNull: <A>(effect: GitHubRuntimeEffect<A>) => Promise<A | null>;
};

export function createGitHubRuntime(telemetry: {
  onFailure: (event: GitHubTelemetryEvent, error: GitHubError) => Effect.Effect<void>;
  onSuccess: (event: GitHubTelemetryEvent) => Effect.Effect<void>;
}): GitHubRuntime {
  const gitHubTelemetryLayer = Layer.succeed(GitHubTelemetry)(telemetry);
  const gitHubRuntimeLayer = GitHubServiceLayer.pipe(Layer.provideMerge(gitHubTelemetryLayer));

  const runExit = <A>(effect: GitHubRuntimeEffect<A>): Promise<Exit.Exit<A, GitHubError>> =>
    Effect.runPromiseExit(effect.pipe(Effect.provide(gitHubRuntimeLayer)));

  const run = async <A>(effect: GitHubRuntimeEffect<A>): Promise<A> => {
    const exit = await runExit(effect);
    if (Exit.isSuccess(exit)) {
      return exit.value;
    }

    throw Cause.squash(exit.cause);
  };

  // Only coerce an explicit GitHub not_found into null. Everything else keeps its code.
  const runNotFoundOrNull = async <A>(effect: GitHubRuntimeEffect<A>): Promise<A | null> =>
    run(
      effect.pipe(
        Effect.catchTag("GitHubError", (err) =>
          err.code === "not_found" ? Effect.succeed<A | null>(null) : Effect.fail(err),
        ),
      ),
    );

  return {
    runExit,
    run,
    runNotFoundOrNull,
  };
}
