import "server-only";
import {
  compareBranches,
  getPullRequest,
  listRepositoryPullRequests,
  mergeUpstream,
  updatePullRequest,
  type GitHubPullRequest,
} from "@sachikit/github";

import { findRepoContext, requireRepoContext } from "./context";
import { runGitHubEffect, runGitHubEffectOrNotFound } from "./effect";
import type { StackEntry, StackHealthEntry } from "./types";

export async function getPullRequestStack(
  owner: string,
  repo: string,
  currentPrNumber: number,
): Promise<StackEntry[]> {
  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  const allPRs = await runGitHubEffect(listRepositoryPullRequests(context.auth, owner, context.repository.name, "all"));

  const currentPR = allPRs.find((pr) => pr.number === currentPrNumber);
  if (!currentPR) return [];

  const byHead = new Map<string, GitHubPullRequest>();
  const byBase = new Map<string, GitHubPullRequest>();
  for (const pr of allPRs) {
    byHead.set(pr.head.ref, pr);
    if (pr.state === "open" && !pr.merged) {
      byBase.set(pr.base.ref, pr);
    }
  }

  const chain: GitHubPullRequest[] = [currentPR];

  let walk: GitHubPullRequest | undefined = currentPR;
  while (walk) {
    const parent = byHead.get(walk.base.ref);
    if (!parent || parent.number === walk.number) break;
    if (chain.some((p) => p.number === parent.number)) break;
    chain.unshift(parent);
    walk = parent;
  }

  walk = currentPR;
  while (walk) {
    const child = byBase.get(walk.head.ref);
    if (!child || child.number === walk.number) break;
    if (chain.some((p) => p.number === child.number)) break;
    chain.push(child);
    walk = child;
  }

  if (chain.length <= 1) return [];

  return chain.map((pr) => ({
    number: pr.number,
    title: pr.title,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    state: pr.merged ? "merged" : pr.state,
    isCurrent: pr.number === currentPrNumber,
  }));
}

export async function getStackHealth(
  owner: string,
  repo: string,
  currentPrNumber: number,
): Promise<StackHealthEntry[]> {
  const stack = await getPullRequestStack(owner, repo, currentPrNumber);
  if (stack.length === 0) return [];

  const context = await findRepoContext(owner, repo);
  if (!context) return [];

  const results: StackHealthEntry[] = [];

  for (const entry of stack) {
    if (entry.state !== "open") {
      results.push({
        ...entry,
        needsRestack: false,
        behindBy: 0,
        comparison: null,
      });
      continue;
    }

    const comparison = await runGitHubEffectOrNotFound(compareBranches(context.auth, owner, context.repository.name, entry.headRef, entry.baseRef));

    results.push({
      ...entry,
      needsRestack: comparison !== null && comparison.behindBy > 0,
      behindBy: comparison?.behindBy ?? 0,
      comparison,
    });
  }

  return results;
}

export async function restackPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  newBase: string,
): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(owner, repo);

  return runGitHubEffect(
    updatePullRequest(context.auth, owner, context.repository.name, pullNumber, { base: newBase }),
  );
}

export async function updateStackedBranch(
  owner: string,
  repo: string,
  branch: string,
  upstreamBranch: string,
): Promise<{ sha: string }> {
  const context = await requireRepoContext(owner, repo);

  return runGitHubEffect(
    mergeUpstream(context.auth, owner, context.repository.name, branch, upstreamBranch),
  );
}

export async function restackAfterMerge(
  owner: string,
  repo: string,
  mergedPrNumber: number,
): Promise<{ restacked: number[] }> {
  const context = await requireRepoContext(owner, repo);

  const mergedPR = await runGitHubEffectOrNotFound(getPullRequest(context.auth, owner, context.repository.name, mergedPrNumber));

  if (!mergedPR || !mergedPR.merged) {
    return { restacked: [] };
  }

  const allPRs = await runGitHubEffect(listRepositoryPullRequests(context.auth, owner, context.repository.name, "open"));

  const children = allPRs.filter((pr) => pr.base.ref === mergedPR.head.ref);

  const restacked: number[] = [];

  for (const child of children) {
    const updated = await runGitHubEffectOrNotFound(updatePullRequest(context.auth, owner, context.repository.name, child.number, {
      base: mergedPR.base.ref,
    }));

    if (updated) {
      restacked.push(child.number);
    }
  }

  return { restacked };
}
