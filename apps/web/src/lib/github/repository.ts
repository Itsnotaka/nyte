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
import { runGitHubEffect, runGitHubEffectOrNotFound } from "./effect";

export async function getRepoTree(
  owner: string,
  repo: string,
  ref: string,
  path?: string,
): Promise<GitHubTree | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const treeSha = path ? `${ref}:${path}` : ref;
  return runGitHubEffectOrNotFound(
    getRepositoryTree(context.auth, owner, context.repository.name, treeSha),
  );
}

export async function getRepoFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<GitHubFileContent | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return runGitHubEffectOrNotFound(
    getFileContent(context.auth, owner, context.repository.name, path, ref),
  );
}

export async function getRepoCommits(
  owner: string,
  repo: string,
  options?: { path?: string; sha?: string },
): Promise<GitHubCommitSummary[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return runGitHubEffect(listCommits(context.auth, owner, context.repository.name, options));
}

export async function getRepoBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  return runGitHubEffect(listRepositoryBranches(context.auth, owner, context.repository.name));
}
