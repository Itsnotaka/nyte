import "server-only";
import {
  getFileContent,
  getRepositoryTree,
  listCommits,
  listRepositoryBranches,
  type GitHubBranch,
  type GitHubCommitSummary,
  type GitHubFileContent,
  type GitHubTree,
} from "@sachikit/github";

import { findRepoContext } from "./context";

export async function getRepoTree(
  owner: string,
  repo: string,
  ref: string,
  path?: string
): Promise<GitHubTree | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const treeSha = path ? `${ref}:${path}` : ref;
  return getRepositoryTree(
    context.auth,
    owner,
    context.repository.name,
    treeSha
  ).unwrapOr(null);
}

export async function getRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubFileContent | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return getFileContent(
    context.auth,
    owner,
    context.repository.name,
    path,
    ref
  ).unwrapOr(null);
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string }
): Promise<GitHubCommitSummary[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listCommits(
    context.auth,
    owner,
    context.repository.name,
    options
  ).unwrapOr([]);
}

export async function getRepoBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return listRepositoryBranches(
    context.auth,
    owner,
    context.repository.name
  ).unwrapOr([]);
}
