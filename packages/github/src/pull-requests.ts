import { Effect, Layer, ServiceMap } from "effect";

import { GitHubClientService } from "./client.ts";
import { toGraphqlPullRequest, toPullRequest, toPullRequestFile } from "./pull-request-mappers.ts";
import {
  GitHubError,
  type GitHubAppInstallationAuth,
  type GitHubPullRequest,
  type GitHubPullRequestFile,
} from "./types.ts";

export type PaginatedFiles = {
  files: GitHubPullRequestFile[];
  nextPage: number | null;
};

export type BranchComparison = {
  aheadBy: number;
  behindBy: number;
  status: "ahead" | "behind" | "diverged" | "identical";
  totalCommits: number;
};

type GraphqlClient = {
  graphql: <T>(query: string, variables: Record<string, unknown>) => Promise<T>;
};

type GraphqlPullRequestsResponse = {
  repository: {
    pullRequests: {
      nodes: Array<{
        additions: number;
        autoMergeRequest: object | null;
        author: {
          __typename: string;
          avatarUrl: string;
          login: string;
          databaseId?: number | null;
        } | null;
        baseRefName: string | null;
        baseRefOid: string | null;
        body: string | null;
        changedFiles: number;
        comments: { totalCount: number } | null;
        commits: { totalCount: number } | null;
        createdAt: string;
        databaseId: number | null;
        deletions: number;
        headRefName: string | null;
        headRefOid: string | null;
        isDraft: boolean;
        mergedAt: string | null;
        number: number;
        state: "OPEN" | "CLOSED" | "MERGED";
        title: string;
        updatedAt: string;
        url: string;
      } | null>;
    };
  } | null;
};

type GitHubPullRequestsShape = {
  compareBranches: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    base: string,
    head: string,
  ) => Effect.Effect<BranchComparison, GitHubError>;
  createPullRequest: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    input: {
      title: string;
      body: string;
      head: string;
      base: string;
      draft: boolean;
    },
  ) => Effect.Effect<GitHubPullRequest, GitHubError>;
  findPullRequestByHead: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    head: string,
    options?: {
      headOwner?: string;
      state?: "open" | "closed" | "all";
      base?: string;
    },
  ) => Effect.Effect<GitHubPullRequest | null, GitHubError>;
  getPullRequest: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<GitHubPullRequest, GitHubError>;
  getPullRequestDiff: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<string, GitHubError>;
  listPullRequestFiles: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<GitHubPullRequestFile[], GitHubError>;
  listPullRequestFilesPaginated: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
    page?: number,
    perPage?: number,
  ) => Effect.Effect<PaginatedFiles, GitHubError>;
  listRecentPullRequests: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    options?: { perPage?: number },
  ) => Effect.Effect<GitHubPullRequest[], GitHubError>;
  listMergingPullRequestsGraphql: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    options?: { perPage?: number },
  ) => Effect.Effect<GitHubPullRequest[], GitHubError>;
  listRepositoryPullRequests: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    state?: "open" | "closed" | "all",
  ) => Effect.Effect<GitHubPullRequest[], GitHubError>;
  markPullRequestReadyForReview: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
  ) => Effect.Effect<GitHubPullRequest, GitHubError>;
  mergePullRequest: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
    input?: {
      mergeMethod?: "merge" | "squash" | "rebase";
      commitTitle?: string;
      commitMessage?: string;
    },
  ) => Effect.Effect<{ sha: string; merged: boolean }, GitHubError>;
  mergeUpstream: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    branch: string,
    upstreamBranch: string,
  ) => Effect.Effect<{ sha: string }, GitHubError>;
  updatePullRequest: (
    auth: GitHubAppInstallationAuth,
    owner: string,
    repo: string,
    pullNumber: number,
    input: {
      title?: string;
      body?: string;
      base?: string;
    },
  ) => Effect.Effect<GitHubPullRequest, GitHubError>;
};

export class GitHubPullRequestsService extends ServiceMap.Service<
  GitHubPullRequestsService,
  GitHubPullRequestsShape
>()("GitHubPullRequestsService", {
  make: Effect.gen(function* () {
    const clients = yield* GitHubClientService;
    return {
      compareBranches: (auth, owner, repo, base, head) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.compareBranches",
          async (client) => {
            const response = await client.rest.repos.compareCommitsWithBasehead({
              owner,
              repo,
              basehead: `${base}...${head}`,
            });
            const status = response.data.status;
            const validStatus: BranchComparison["status"] =
              status === "ahead" ||
              status === "behind" ||
              status === "diverged" ||
              status === "identical"
                ? status
                : "identical";

            return {
              aheadBy: response.data.ahead_by,
              behindBy: response.data.behind_by,
              status: validStatus,
              totalCommits: response.data.total_commits,
            };
          },
          { base, head, owner, repo },
        ),
      createPullRequest: (auth, owner, repo, input) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.createPullRequest",
          async (client) => {
            const response = await client.rest.pulls.create({
              owner,
              repo,
              title: input.title,
              body: input.body,
              head: input.head,
              base: input.base,
              draft: input.draft,
            });
            return toPullRequest(response.data);
          },
          { base: input.base, head: input.head, owner, repo },
        ),
      findPullRequestByHead: (auth, owner, repo, head, options) => {
        const headOwner = options?.headOwner ?? owner;
        const state = options?.state ?? "open";

        return clients.withInstallationClient(
          auth,
          "github.pullRequests.findPullRequestByHead",
          async (client) => {
            const pulls = await client.paginate(client.rest.pulls.list, {
              owner,
              repo,
              head: `${headOwner}:${head}`,
              state,
              per_page: 100,
            });

            const match =
              options?.base == null
                ? pulls[0]
                : pulls.find((pull) => pull.base.ref === options.base);

            return match == null ? null : toPullRequest(match);
          },
          { base: options?.base, head, owner, repo },
        );
      },
      getPullRequest: (auth, owner, repo, pullNumber) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.getPullRequest",
          async (client) => {
            const response = await client.rest.pulls.get({
              owner,
              repo,
              pull_number: pullNumber,
            });
            return toPullRequest(response.data);
          },
          { owner, pullNumber, repo },
        ),
      getPullRequestDiff: (auth, owner, repo, pullNumber) =>
        Effect.flatMap(
          clients.withInstallationClient(
            auth,
            "github.pullRequests.getPullRequestDiff",
            async (client) => {
              const response = await client.rest.pulls.get({
                owner,
                repo,
                pull_number: pullNumber,
                mediaType: { format: "diff" },
              });
              return response.data;
            },
            { owner, pullNumber, repo },
          ),
          (data) =>
            typeof data === "string"
              ? Effect.succeed(data)
              : Effect.fail(
                  new GitHubError(
                    "GitHub pull request diff response was not a string",
                    0,
                    "unknown",
                    "github.pullRequests.getPullRequestDiff",
                    { owner, pullNumber, repo },
                  ),
                ),
        ),
      listPullRequestFiles: (auth, owner, repo, pullNumber) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.listPullRequestFiles",
          async (client) => {
            const files = await client.paginate(client.rest.pulls.listFiles, {
              owner,
              repo,
              pull_number: pullNumber,
              per_page: 100,
            });
            return files.map(toPullRequestFile);
          },
          { owner, pullNumber, repo },
        ),
      listPullRequestFilesPaginated: (auth, owner, repo, pullNumber, page = 1, perPage = 30) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.listPullRequestFilesPaginated",
          async (client) => {
            const response = await client.rest.pulls.listFiles({
              owner,
              repo,
              pull_number: pullNumber,
              per_page: perPage,
              page,
            });
            const nextMatch = response.headers.link?.match(/[?&]page=(\d+)[^>]*>; rel="next"/);
            return {
              files: response.data.map(toPullRequestFile),
              nextPage: nextMatch ? Number(nextMatch[1]) : null,
            };
          },
          { owner, pullNumber, repo },
        ),
      listRecentPullRequests: (auth, owner, repo, options) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.listRecentPullRequests",
          async (client) => {
            const response = await client.rest.pulls.list({
              owner,
              repo,
              state: "all",
              sort: "updated",
              direction: "desc",
              per_page: options?.perPage ?? 100,
            });
            return response.data.map(toPullRequest);
          },
          { owner, repo },
        ),
      listMergingPullRequestsGraphql: (auth, owner, repo, options) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.listMergingPullRequestsGraphql",
          async (client) => {
            const response = await (client as typeof client & GraphqlClient).graphql<GraphqlPullRequestsResponse>(
              `query InboxMergingPullRequests($owner: String!, $repo: String!, $first: Int!) {
                repository(owner: $owner, name: $repo) {
                  pullRequests(
                    first: $first
                    states: [OPEN, MERGED]
                    orderBy: { field: UPDATED_AT, direction: DESC }
                  ) {
                    nodes {
                      databaseId
                      number
                      url
                      title
                      body
                      state
                      isDraft
                      mergedAt
                      autoMergeRequest {
                        enabledAt
                      }
                      additions
                      deletions
                      changedFiles
                      createdAt
                      updatedAt
                      comments {
                        totalCount
                      }
                      commits {
                        totalCount
                      }
                      author {
                        __typename
                        login
                        avatarUrl
                        ... on User {
                          databaseId
                        }
                        ... on Organization {
                          databaseId
                        }
                        ... on Bot {
                          databaseId
                        }
                      }
                      headRefName
                      headRefOid
                      baseRefName
                      baseRefOid
                    }
                  }
                }
              }`,
              {
                first: options?.perPage ?? 100,
                owner,
                repo,
              },
            );

            if (!response.repository) {
              throw new GitHubError(
                "GitHub repository not found",
                404,
                "not_found",
                "github.pullRequests.listMergingPullRequestsGraphql",
                { owner, repo },
              );
            }

            return response.repository.pullRequests.nodes.flatMap((node) =>
              node ? [toGraphqlPullRequest(node)] : [],
            );
          },
          { owner, repo },
        ),
      listRepositoryPullRequests: (auth, owner, repo, state = "open") =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.listRepositoryPullRequests",
          async (client) => {
            const pulls = await client.paginate(client.rest.pulls.list, {
              owner,
              repo,
              state,
              per_page: 100,
            });
            return pulls.map(toPullRequest);
          },
          { owner, repo },
        ),
      markPullRequestReadyForReview: (auth, owner, repo, pullNumber) =>
        Effect.flatMap(
          clients.withInstallationClient(
            auth,
            "github.pullRequests.markPullRequestReadyForReview",
            async (client) => {
              await client.request(
                "POST /repos/{owner}/{repo}/pulls/{pull_number}/ready_for_review",
                {
                  owner,
                  repo,
                  pull_number: pullNumber,
                },
              );
            },
            { owner, pullNumber, repo },
          ),
          () =>
            clients.withInstallationClient(
              auth,
              "github.pullRequests.getPullRequest",
              async (client) => {
                const response = await client.rest.pulls.get({
                  owner,
                  repo,
                  pull_number: pullNumber,
                });
                return toPullRequest(response.data);
              },
              { owner, pullNumber, repo },
            ),
        ),
      mergePullRequest: (auth, owner, repo, pullNumber, input) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.mergePullRequest",
          async (client) => {
            const response = await client.rest.pulls.merge({
              owner,
              repo,
              pull_number: pullNumber,
              merge_method: input?.mergeMethod ?? "squash",
              commit_title: input?.commitTitle,
              commit_message: input?.commitMessage,
            });
            return { sha: response.data.sha, merged: response.data.merged };
          },
          { owner, pullNumber, repo },
        ),
      mergeUpstream: (auth, owner, repo, branch, upstreamBranch) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.mergeUpstream",
          async (client) => {
            const response = await client.rest.repos.merge({
              owner,
              repo,
              base: branch,
              head: upstreamBranch,
              commit_message: `Merge ${upstreamBranch} into ${branch}`,
            });
            return { sha: response.data.sha };
          },
          { branch, head: upstreamBranch, owner, repo },
        ),
      updatePullRequest: (auth, owner, repo, pullNumber, input) =>
        clients.withInstallationClient(
          auth,
          "github.pullRequests.updatePullRequest",
          async (client) => {
            const response = await client.rest.pulls.update({
              owner,
              repo,
              pull_number: pullNumber,
              ...(input.title !== undefined ? { title: input.title } : {}),
              ...(input.body !== undefined ? { body: input.body } : {}),
              ...(input.base !== undefined ? { base: input.base } : {}),
            });
            return toPullRequest(response.data);
          },
          { owner, pullNumber, repo },
        ),
    };
  }),
}) {
  static readonly layer = Layer.effect(this)(this.make).pipe(
    Layer.provide(GitHubClientService.layer),
  );
}

export function listRepositoryPullRequests(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  state: "open" | "closed" | "all" = "open",
): Effect.Effect<GitHubPullRequest[], GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.listRepositoryPullRequests(auth, owner, repo, state),
  );
}

export function listRecentPullRequests(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  options?: { perPage?: number },
): Effect.Effect<GitHubPullRequest[], GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.listRecentPullRequests(auth, owner, repo, options),
  );
}

export function listMergingPullRequestsGraphql(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  options?: { perPage?: number },
): Effect.Effect<GitHubPullRequest[], GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.listMergingPullRequestsGraphql(auth, owner, repo, options),
  );
}

export function findPullRequestByHead(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  head: string,
  options?: {
    headOwner?: string;
    state?: "open" | "closed" | "all";
    base?: string;
  },
): Effect.Effect<GitHubPullRequest | null, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.findPullRequestByHead(auth, owner, repo, head, options),
  );
}

export function getPullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
): Effect.Effect<GitHubPullRequest, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.getPullRequest(auth, owner, repo, pullNumber),
  );
}

export function createPullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  input: {
    title: string;
    body: string;
    head: string;
    base: string;
    draft: boolean;
  },
): Effect.Effect<GitHubPullRequest, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.createPullRequest(auth, owner, repo, input),
  );
}

export function updatePullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  input: {
    title?: string;
    body?: string;
    base?: string;
  },
): Effect.Effect<GitHubPullRequest, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.updatePullRequest(auth, owner, repo, pullNumber, input),
  );
}

export function markPullRequestReadyForReview(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
): Effect.Effect<GitHubPullRequest, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.markPullRequestReadyForReview(auth, owner, repo, pullNumber),
  );
}

export function listPullRequestFiles(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
): Effect.Effect<GitHubPullRequestFile[], GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.listPullRequestFiles(auth, owner, repo, pullNumber),
  );
}

export function getPullRequestDiff(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
): Effect.Effect<string, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.getPullRequestDiff(auth, owner, repo, pullNumber),
  );
}

export function mergePullRequest(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  input?: {
    mergeMethod?: "merge" | "squash" | "rebase";
    commitTitle?: string;
    commitMessage?: string;
  },
): Effect.Effect<{ sha: string; merged: boolean }, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.mergePullRequest(auth, owner, repo, pullNumber, input),
  );
}

export function listPullRequestFilesPaginated(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  pullNumber: number,
  page = 1,
  perPage = 30,
): Effect.Effect<PaginatedFiles, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.listPullRequestFilesPaginated(auth, owner, repo, pullNumber, page, perPage),
  );
}

export function compareBranches(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  base: string,
  head: string,
): Effect.Effect<BranchComparison, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.compareBranches(auth, owner, repo, base, head),
  );
}

export function mergeUpstream(
  auth: GitHubAppInstallationAuth,
  owner: string,
  repo: string,
  branch: string,
  upstreamBranch: string,
): Effect.Effect<{ sha: string }, GitHubError, GitHubPullRequestsService> {
  return GitHubPullRequestsService.use((service) =>
    service.mergeUpstream(auth, owner, repo, branch, upstreamBranch),
  );
}
