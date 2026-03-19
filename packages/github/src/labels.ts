import { Effect, Layer, ServiceMap } from "effect";

import { GitHubClientService } from "./client.ts";
import { toLabel } from "./pull-request-mappers.ts";
import type { GitHubAppInstallationAuth, GitHubError, GitHubLabel } from "./types.ts";

type GitHubLabelsShape = {
  addLabels: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
  ) => Effect.Effect<GitHubLabel[], GitHubError>;
  listRepoLabels: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
  ) => Effect.Effect<GitHubLabel[], GitHubError>;
  removeLabel: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    issueNumber: number,
    name: string,
  ) => Effect.Effect<void, GitHubError>;
};

export class GitHubLabelsService extends ServiceMap.Service<
  GitHubLabelsService,
  GitHubLabelsShape
>()("GitHubLabelsService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      addLabels: (auth, owner, repo, issueNumber, labels) =>
        clients.withInstallationClient(
          auth,
          "github.labels.addLabels",
          async (client) => {
            const response = await client.rest.issues.addLabels({
              owner,
              repo,
              issue_number: issueNumber,
              labels,
            });
            return response.data.map(toLabel);
          },
          { issueNumber, owner, repo },
        ),
      listRepoLabels: (auth, owner, repo) =>
        clients.withInstallationClient(
          auth,
          "github.labels.listRepoLabels",
          async (client) => {
            const labels = await client.paginate(client.rest.issues.listLabelsForRepo, {
              owner,
              repo,
              per_page: 100,
            });
            return labels.map(toLabel);
          },
          { owner, repo },
        ),
      removeLabel: (auth, owner, repo, issueNumber, name) =>
        clients.withInstallationClient(
          auth,
          "github.labels.removeLabel",
          async (client) => {
            await client.rest.issues.removeLabel({
              owner,
              repo,
              issue_number: issueNumber,
              name,
            });
          },
          { issueNumber, owner, repo },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listRepoLabels(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
): Effect.Effect<GitHubLabel[], GitHubError, GitHubLabelsService> {
  return GitHubLabelsService.use((service) => service.listRepoLabels(auth, owner, repo));
}

export function addLabels(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Effect.Effect<GitHubLabel[], GitHubError, GitHubLabelsService> {
  return GitHubLabelsService.use((service) =>
    service.addLabels(auth, owner, repo, issueNumber, labels),
  );
}

export function removeLabel(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string,
): Effect.Effect<void, GitHubError, GitHubLabelsService> {
  return GitHubLabelsService.use((service) =>
    service.removeLabel(auth, owner, repo, issueNumber, name),
  );
}
