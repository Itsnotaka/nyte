import { Effect, Layer, ServiceMap } from "effect";

import { GitHubClientService } from "./client.ts";
import { type GitHubAppInstallationAuth, type GitHubBranch, GitHubError } from "./types.ts";

type GitHubBranchesShape = {
  listRepositoryBranches: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
  ) => Effect.Effect<GitHubBranch[], GitHubError>;
};

export class GitHubBranchesService extends ServiceMap.Service<
  GitHubBranchesService,
  GitHubBranchesShape
>()("GitHubBranchesService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      listRepositoryBranches: (auth, owner, repo) =>
        clients.withInstallationClient(
          auth,
          "github.branches.listRepositoryBranches",
          async (client) => {
            const branches = await client.paginate(client.rest.repos.listBranches, {
              owner,
              repo,
              per_page: 100,
            });
            return branches.map((branch) => {
              const sha = branch.commit?.sha;
              if (typeof sha !== "string" || sha.length === 0) {
                throw new GitHubError(
                  "GitHub branch is missing a commit sha",
                  0,
                  "unknown",
                  "github.branches.listRepositoryBranches",
                  { owner, repo },
                );
              }
              return {
                name: branch.name,
                protected: branch.protected,
                commit: { sha },
              };
            });
          },
          { owner, repo },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listRepositoryBranches(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
): Effect.Effect<GitHubBranch[], GitHubError, GitHubBranchesService> {
  return GitHubBranchesService.use((service) => service.listRepositoryBranches(auth, owner, repo));
}
