import { Effect, Layer, ServiceMap } from "effect";

import { GitHubClientService } from "./client.ts";
import {
  type GitHubAppInstallationAuth,
  type GitHubCheckRun,
  type GitHubCheckSummary,
  type GitHubError,
} from "./types.ts";

type GitHubChecksShape = {
  getCheckSummaryForRef: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    ref: string,
  ) => Effect.Effect<GitHubCheckSummary, GitHubError>;
  listCheckRunsForRef: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    ref: string,
  ) => Effect.Effect<GitHubCheckRun[], GitHubError>;
};

export function summarizeCheckRuns(runs: GitHubCheckRun[]): GitHubCheckSummary {
  const total = runs.length;
  const passing = runs.filter((r) => r.status === "completed" && r.conclusion === "success").length;
  const failing = runs.filter(
    (r) =>
      r.status === "completed" &&
      ["failure", "timed_out", "action_required"].includes(r.conclusion ?? ""),
  ).length;
  const pending = total - passing - failing;

  const conclusion =
    total === 0 ? "neutral" : failing > 0 ? "failure" : pending > 0 ? "pending" : "success";

  return { total, passing, failing, pending, conclusion };
}

function toCheckRunStatus(status: string): GitHubCheckRun["status"] {
  if (status === "queued" || status === "in_progress" || status === "completed") {
    return status;
  }
  return "queued";
}

export class GitHubChecksService extends ServiceMap.Service<
  GitHubChecksService,
  GitHubChecksShape
>()("GitHubChecksService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      getCheckSummaryForRef: (auth, owner, repo, ref) =>
        Effect.map(
          clients.withInstallationClient(
            auth,
            "github.checks.getCheckSummaryForRef",
            async (client) => {
              const response = await client.rest.checks.listForRef({
                owner,
                repo,
                ref,
                per_page: 100,
              });
              return response.data.check_runs.map((run) => ({
                id: run.id,
                name: run.name,
                status: toCheckRunStatus(run.status),
                conclusion: typeof run.conclusion === "string" ? run.conclusion : null,
                started_at: run.started_at ?? null,
                completed_at: run.completed_at ?? null,
                html_url: run.html_url ?? "",
                app: run.app ? { name: run.app.name ?? "", slug: run.app.slug ?? "" } : null,
              }));
            },
            { owner, ref, repo },
          ),
          summarizeCheckRuns,
        ),
      listCheckRunsForRef: (auth, owner, repo, ref) =>
        clients.withInstallationClient(
          auth,
          "github.checks.listCheckRunsForRef",
          async (client) => {
            const response = await client.rest.checks.listForRef({
              owner,
              repo,
              ref,
              per_page: 100,
            });
            return response.data.check_runs.map((run) => ({
              id: run.id,
              name: run.name,
              status: toCheckRunStatus(run.status),
              conclusion: typeof run.conclusion === "string" ? run.conclusion : null,
              started_at: run.started_at ?? null,
              completed_at: run.completed_at ?? null,
              html_url: run.html_url ?? "",
              app: run.app ? { name: run.app.name ?? "", slug: run.app.slug ?? "" } : null,
            }));
          },
          { owner, ref, repo },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listCheckRunsForRef(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  ref: string,
): Effect.Effect<GitHubCheckRun[], GitHubError, GitHubChecksService> {
  return GitHubChecksService.use((service) => service.listCheckRunsForRef(auth, owner, repo, ref));
}

export function getCheckSummaryForRef(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  ref: string,
): Effect.Effect<GitHubCheckSummary, GitHubError, GitHubChecksService> {
  return GitHubChecksService.use((service) =>
    service.getCheckSummaryForRef(auth, owner, repo, ref),
  );
}
