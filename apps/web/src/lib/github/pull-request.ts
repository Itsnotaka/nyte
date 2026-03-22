import "server-only";
import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs";
import {
  buildPullRequestReviewSignals,
  computeReviewDecision,
  createPullRequest,
  findPullRequestByHead,
  getPullRequest,
  getPullRequestDiff,
  listIssueComments,
  listPullRequestFilesPaginated,
  listPullRequestReviewComments,
  listPullRequestReviews,
  listRepositoryBranches,
  listRepositoryPullRequests,
  markPullRequestReadyForReview,
  mergePullRequest,
  type GitHubPullRequest,
  type GitHubPullRequestReviewComment,
  type PaginatedFiles,
  type ReviewDecision,
  updatePullRequest,
} from "@sachikit/github";

import { findRepoContext, requireRepoContext } from "./context";
import { runGitHubEffect, runGitHubEffectOrNotFound } from "./effect";
import { GitHubClosedPullRequestExistsError } from "./errors";
import type {
  PullRequestDiffFileData,
  PullRequestDiffRef,
  PullRequestDiffSummaryData,
} from "./pull-request-diff";
import type { PullRequestDiscussionData, PullRequestPageData, RepoSubmitPageData } from "./types";
export async function getRepoSubmitPageData(
  owner: string,
  repo: string,
  branch: string | null,
): Promise<RepoSubmitPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  const branches = await runGitHubEffect(
    listRepositoryBranches(context.auth, owner, context.repository.name),
  );

  const selectableBranches = branches.filter(
    (candidate) => candidate.name !== context.repository.default_branch,
  );
  const selectedBranch =
    branch && selectableBranches.some((candidate) => candidate.name === branch)
      ? branch
      : (selectableBranches[0]?.name ?? null);

  const [existingPullRequest, openPullRequests] = await Promise.all([
    selectedBranch
      ? runGitHubEffectOrNotFound(
          findPullRequestByHead(context.auth, owner, context.repository.name, selectedBranch, {
            base: context.repository.default_branch,
            headOwner: context.repository.owner.login,
            state: "all",
          }),
        )
      : Promise.resolve(null),
    runGitHubEffect(
      listRepositoryPullRequests(context.auth, owner, context.repository.name, "open"),
    ),
  ]);

  return {
    repository: context.repository,
    branches,
    selectedBranch,
    existingPullRequest,
    openPullRequests,
  };
}

export async function saveBranchPullRequest(input: {
  owner: string;
  repo: string;
  head: string;
  title: string;
  body: string;
  draft: boolean;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  const existing = await runGitHubEffectOrNotFound(
    findPullRequestByHead(context.auth, input.owner, context.repository.name, input.head, {
      base: context.repository.default_branch,
      headOwner: context.repository.owner.login,
      state: "all",
    }),
  );

  if (!existing) {
    return runGitHubEffect(
      createPullRequest(context.auth, input.owner, context.repository.name, {
        base: context.repository.default_branch,
        body: input.body,
        draft: input.draft,
        head: input.head,
        title: input.title,
      }),
    );
  }

  if (existing.state === "closed" || existing.merged) {
    throw new GitHubClosedPullRequestExistsError({
      code: "closed_pull_request_exists",
      message: "This branch already has a closed pull request.",
      metadata: {
        head: input.head,
        owner: input.owner,
        repo: input.repo,
      },
      operation: "github.pullRequest.saveBranchPullRequest",
      status: 409,
    });
  }

  const updated = await runGitHubEffect(
    updatePullRequest(context.auth, input.owner, context.repository.name, existing.number, {
      body: input.body,
      title: input.title,
    }),
  );

  if (input.draft || !updated.draft) {
    return updated;
  }

  return runGitHubEffect(
    markPullRequestReadyForReview(
      context.auth,
      input.owner,
      context.repository.name,
      updated.number,
    ),
  );
}

export async function getPullRequestPageData(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestPageData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const pullRequest = await runGitHubEffectOrNotFound(
    getPullRequest(context.auth, owner, context.repository.name, pullNumber),
  );
  if (!pullRequest) {
    return null;
  }

  return {
    repository: context.repository,
    pullRequest,
  };
}

export async function getPullRequestDiscussionData(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestDiscussionData | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const [issueComments, reviews] = await Promise.all([
    runGitHubEffect(listIssueComments(context.auth, owner, context.repository.name, pullNumber)),
    runGitHubEffect(
      listPullRequestReviews(context.auth, owner, context.repository.name, pullNumber),
    ),
  ]);

  return {
    issueComments,
    reviews,
  };
}

export async function getPullRequestReviewCommentsData(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<GitHubPullRequestReviewComment[] | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  return runGitHubEffect(
    listPullRequestReviewComments(context.auth, owner, context.repository.name, pullNumber),
  );
}

type DiffData = { files: FileDiffMetadata[] };

const diffCache = new Map<string, DiffData>();
const diffLoad = new Map<string, Promise<DiffData | null>>();
const diffLimit = 32;

function saveDiff(key: string, data: DiffData) {
  if (!diffCache.has(key) && diffCache.size >= diffLimit) {
    const oldest = diffCache.keys().next().value;
    if (oldest) diffCache.delete(oldest);
  }
  diffCache.set(key, data);
}

function key({ owner, repo, baseSha, headSha }: PullRequestDiffRef): string {
  return `${owner}/${repo}/${baseSha}/${headSha}`;
}

function count(file: FileDiffMetadata, kind: "additions" | "deletions"): number {
  let total = 0;
  for (const hunk of file.hunks) {
    for (const part of hunk.hunkContent) {
      if (part.type !== "change") continue;
      total += kind === "additions" ? part.additions : part.deletions;
    }
  }
  return total;
}

function summary(file: FileDiffMetadata): PullRequestDiffSummaryData["files"][number] {
  return {
    name: file.name,
    prevName: file.prevName ?? null,
    type: file.type,
    additions: count(file, "additions"),
    deletions: count(file, "deletions"),
  };
}

async function loadDiff(ref: PullRequestDiffRef): Promise<DiffData | null> {
  const k = key(ref);
  const cached = diffCache.get(k);
  if (cached) {
    return cached;
  }

  const pending = diffLoad.get(k);
  if (pending) {
    return pending;
  }

  const task = (async () => {
    const context = await findRepoContext(ref.owner, ref.repo);
    if (!context) {
      return null;
    }

    const pull = await runGitHubEffectOrNotFound(
      getPullRequest(context.auth, ref.owner, context.repository.name, Number(ref.pullNumber)),
    );
    if (!pull) {
      return null;
    }

    if (pull.base.sha !== ref.baseSha || pull.head.sha !== ref.headSha) {
      return null;
    }

    const raw = await runGitHubEffect(
      getPullRequestDiff(context.auth, ref.owner, context.repository.name, ref.pullNumber),
    );
    const files = parsePatchFiles(raw).flatMap((patch) => patch.files);
    const data = { files };
    saveDiff(k, data);
    return data;
  })();

  diffLoad.set(k, task);
  try {
    return await task;
  } finally {
    diffLoad.delete(k);
  }
}

export async function getPullRequestDiffSummaryData(
  owner: string,
  repo: string,
  pullNumber: number,
  baseSha: string,
  headSha: string,
): Promise<PullRequestDiffSummaryData | null> {
  const data = await loadDiff({ owner, repo, pullNumber, baseSha, headSha });
  if (!data) {
    return null;
  }

  return {
    files: data.files.map(summary),
  };
}

export async function getPullRequestDiffFileData(
  owner: string,
  repo: string,
  pullNumber: number,
  baseSha: string,
  headSha: string,
  path: string,
): Promise<PullRequestDiffFileData | null> {
  const data = await loadDiff({ owner, repo, pullNumber, baseSha, headSha });
  if (!data) {
    return null;
  }

  let file = data.files.find((candidate) => candidate.name === path) ?? null;
  if (!file) {
    file = data.files.find((candidate) => candidate.prevName === path) ?? null;
  }
  if (!file) {
    return null;
  }

  return { file };
}

export async function getPullRequestFileList(
  owner: string,
  repo: string,
  pullNumber: number,
  page = 1,
  perPage = 30,
): Promise<PaginatedFiles | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) return null;

  return runGitHubEffectOrNotFound(
    listPullRequestFilesPaginated(
      context.auth,
      owner,
      context.repository.name,
      pullNumber,
      page,
      perPage,
    ),
  );
}

export async function updateRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    updatePullRequest(context.auth, input.owner, context.repository.name, input.pullNumber, {
      title: input.title,
      body: input.body,
    }),
  );
}

export async function mergeRepoPullRequest(input: {
  owner: string;
  repo: string;
  pullNumber: number;
  mergeMethod?: "merge" | "squash" | "rebase";
  commitTitle?: string;
  commitMessage?: string;
}): Promise<{ sha: string; merged: boolean }> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    mergePullRequest(context.auth, input.owner, context.repository.name, input.pullNumber, {
      mergeMethod: input.mergeMethod,
      commitTitle: input.commitTitle,
      commitMessage: input.commitMessage,
    }),
  );
}

export async function convertPullRequestToReady(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<GitHubPullRequest> {
  const context = await requireRepoContext(input.owner, input.repo);

  return runGitHubEffect(
    markPullRequestReadyForReview(
      context.auth,
      input.owner,
      context.repository.name,
      input.pullNumber,
    ),
  );
}

export async function getRepositoryPullRequestsPageData(
  owner: string,
  repo: string,
): Promise<{
  repository: PullRequestPageData["repository"];
  pullRequests: Array<
    GitHubPullRequest & {
      repoFullName: string;
      repoName: string;
      repoOwner: string;
      reviewDecision: ReviewDecision;
    }
  >;
} | null> {
  const context = await findRepoContext(owner, repo);
  if (!context) {
    return null;
  }

  const rawPulls = await runGitHubEffect(
    listRepositoryPullRequests(context.auth, owner, context.repository.name, "open"),
  );

  const pullRequests = await Promise.all(
    rawPulls.map(async (pr) => {
      const [detail, reviews] = await Promise.all([
        runGitHubEffectOrNotFound(
          getPullRequest(context.auth, owner, context.repository.name, pr.number),
        ),
        runGitHubEffect(
          listPullRequestReviews(context.auth, owner, context.repository.name, pr.number),
        ),
      ]);

      const effectivePullRequest = detail ?? pr;
      const reviewDecision: ReviewDecision = computeReviewDecision(
        buildPullRequestReviewSignals(effectivePullRequest, reviews),
      );

      return {
        ...effectivePullRequest,
        repoFullName: context.repository.full_name,
        repoName: repo,
        repoOwner: owner,
        reviewDecision,
      };
    }),
  );

  return {
    repository: context.repository,
    pullRequests,
  };
}
