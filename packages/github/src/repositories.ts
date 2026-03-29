import type { Octokit } from "octokit";

import type { GitHubRepository } from "./types.ts";

const QUERY = `query ($cursor: String) {
  viewer {
    repositories(first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        id
        name
        nameWithOwner
        url
        isPrivate
        defaultBranchRef { name }
        owner { login }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;

type Response = {
  viewer: { repositories: { nodes: GitHubRepository[] } };
};

export async function listRepositories(client: Octokit): Promise<GitHubRepository[]> {
  const repos: GitHubRepository[] = [];
  for await (const page of client.graphql.paginate.iterator<Response>(QUERY)) {
    repos.push(...page.viewer.repositories.nodes);
  }
  return repos;
}
