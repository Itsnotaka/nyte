import { Effect, Layer, ServiceMap } from "effect";

import { GitHubClientService, accountFromResponse } from "./client.ts";
import {
  GitHubError,
  type GitHubAppInstallationAuth,
  type GitHubCommitSummary,
  type GitHubFileContent,
  type GitHubRepository,
  type GitHubTree,
} from "./types.ts";

type GitHubRepositoriesShape = {
  getFileContent: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ) => Effect.Effect<GitHubFileContent, GitHubError>;
  getRepositoryTree: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    treeSha: string,
    recursive?: boolean,
  ) => Effect.Effect<GitHubTree, GitHubError>;
  listCommits: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    options?: { path?: string; sha?: string; perPage?: number },
  ) => Effect.Effect<GitHubCommitSummary[], GitHubError>;
  listInstallationRepos: (
    userAccessToken: string,
    installationId: number,
  ) => Effect.Effect<GitHubRepository[], GitHubError>;
};

export class GitHubRepositoriesService extends ServiceMap.Service<
  GitHubRepositoriesService,
  GitHubRepositoriesShape
>()("GitHubRepositoriesService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      getFileContent: (auth, owner, repo, path, ref) =>
        clients.withInstallationClient(
          auth,
          "github.repositories.getFileContent",
          async (client) => {
            const response = await client.rest.repos.getContent({
              owner,
              repo,
              path,
              ref,
            });
            const data = response.data;
            if (Array.isArray(data) || !("content" in data)) {
              throw new GitHubError(
                "Path is a directory, not a file",
                0,
                "unknown",
                "github.repositories.getFileContent",
                { owner, path, ref, repo },
              );
            }
            return {
              name: data.name,
              path: data.path,
              sha: data.sha,
              size: data.size,
              content: data.content ?? "",
              encoding: data.encoding ?? "base64",
              html_url: data.html_url ?? "",
            };
          },
          { owner, path, ref, repo },
        ),
      getRepositoryTree: (auth, owner, repo, treeSha, recursive = false) =>
        clients.withInstallationClient(
          auth,
          "github.repositories.getRepositoryTree",
          async (client) => {
            const response = await client.rest.git.getTree({
              owner,
              repo,
              tree_sha: treeSha,
              recursive: recursive ? "1" : undefined,
            });
            return {
              sha: response.data.sha,
              tree: response.data.tree.map((entry) => ({
                path: entry.path ?? "",
                mode: entry.mode ?? "",
                type: entry.type === "tree" ? "tree" : "blob",
                sha: entry.sha ?? "",
                size: entry.size ?? null,
              })),
              truncated: response.data.truncated,
            };
          },
          { owner, ref: treeSha, repo },
        ),
      listCommits: (auth, owner, repo, options) =>
        clients.withInstallationClient(
          auth,
          "github.repositories.listCommits",
          async (client) => {
            const response = await client.rest.repos.listCommits({
              owner,
              repo,
              path: options?.path,
              sha: options?.sha,
              per_page: options?.perPage ?? 30,
            });
            return response.data.map((commit) => ({
              sha: commit.sha,
              message: commit.commit.message,
              author: {
                name: commit.commit.author?.name ?? "Unknown",
                date: commit.commit.author?.date ?? "",
              },
              html_url: commit.html_url,
            }));
          },
          { owner, path: options?.path, ref: options?.sha, repo },
        ),
      listInstallationRepos: (userAccessToken, installationId) =>
        clients.withUserClient(
          userAccessToken,
          "github.repositories.listInstallationRepos",
          async (client) => {
            const repositories = await client.paginate(
              client.rest.apps.listInstallationReposForAuthenticatedUser,
              {
                installation_id: installationId,
                per_page: 100,
              },
            );
            return repositories.map((repository) => {
              if (!repository.updated_at) {
                throw new GitHubError(
                  "GitHub repository is missing an updated_at timestamp",
                  0,
                  "unknown",
                  "github.repositories.listInstallationRepos",
                  { installationId },
                );
              }

              return {
                id: repository.id,
                name: repository.name,
                full_name: repository.full_name,
                private: repository.private,
                owner: accountFromResponse(repository.owner, "repository owner"),
                description: repository.description,
                default_branch: repository.default_branch,
                language: repository.language,
                stargazers_count: repository.stargazers_count,
                updated_at: repository.updated_at,
              };
            });
          },
          { installationId },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listInstallationRepos(
  userAccessToken: string,
  installationId: number,
): Effect.Effect<GitHubRepository[], GitHubError, GitHubRepositoriesService> {
  return GitHubRepositoriesService.use((service) =>
    service.listInstallationRepos(userAccessToken, installationId),
  );
}

export function getRepositoryTree(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  treeSha: string,
  recursive = false,
): Effect.Effect<GitHubTree, GitHubError, GitHubRepositoriesService> {
  return GitHubRepositoriesService.use((service) =>
    service.getRepositoryTree(auth, owner, repo, treeSha, recursive),
  );
}

export function getFileContent(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Effect.Effect<GitHubFileContent, GitHubError, GitHubRepositoriesService> {
  return GitHubRepositoriesService.use((service) =>
    service.getFileContent(auth, owner, repo, path, ref),
  );
}

export function listCommits(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string; perPage?: number },
): Effect.Effect<GitHubCommitSummary[], GitHubError, GitHubRepositoriesService> {
  return GitHubRepositoriesService.use((service) =>
    service.listCommits(auth, owner, repo, options),
  );
}
