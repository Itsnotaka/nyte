import { z } from "zod";

import {
  addPullRequestComment,
  addPullRequestLabels,
  addPullRequestReview,
  convertPullRequestToReady,
  getCheckRunsForPR,
  getCheckSummaryForPR,
  getGitHubAppInstallUrl,
  getPullRequestFileList,
  getPullRequestPageData,
  getRepoBranches,
  getRepoCommits,
  getRepoFileContent,
  getRepoLabels,
  getRepoSubmitPageData,
  getRepoTree,
  mergeRepoPullRequest,
  removePullRequestLabel,
  removePullRequestReviewer,
  requestPullRequestReviewers,
  resolveGitHubAppSetupRedirect,
  saveBranchPullRequest,
  updateRepoPullRequest,
} from "../../github/server";
import { log } from "../../evlog";
import { createTRPCRouter, protectedProcedure } from "../server";

const FAILURES = {
  addComment: "Failed to add pull request comment.",
  addLabels: "Failed to add labels.",
  checkRuns: "Failed to fetch check runs.",
  convertToReady: "Failed to mark PR as ready for review.",
  fileContent: "File content not found.",
  getPullRequestPage: "Pull request page data not found.",
  getRepoSubmitPage: "Repository submit page data not found.",
  merge: "Failed to merge pull request.",
  removeLabel: "Failed to remove label.",
  removeReviewer: "Failed to remove reviewer.",
  requestReviewers: "Failed to request reviewers.",
  review: "Failed to submit pull request review.",
  savePullRequest: "Failed to save pull request.",
  updatePullRequest: "Failed to update pull request.",
} as const;

function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };

    if ("status" in error && typeof error.status === "number") {
      details.status = error.status;
    }

    if ("code" in error && typeof error.code === "string") {
      details.code = error.code;
    }

    return details;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return { message: error };
  }

  return { message: "Unknown non-Error throw" };
}

function logGitHubMutationFailure(
  mutation: string,
  input: Record<string, unknown>,
  error: unknown,
) {
  log.error({
    area: "trpc.github",
    message: "GitHub tRPC mutation failed",
    mutation,
    input,
    failure: getErrorDetails(error),
  });
}

function throwMutationFailure(message: string, error: unknown): never {
  if (error instanceof Error) {
    throw new Error(message, { cause: error });
  }

  throw new Error(message);
}

export const githubRouter = createTRPCRouter({
  // --- Existing routes ---

  startInstall: protectedProcedure.mutation(() => {
    return { url: getGitHubAppInstallUrl() };
  }),
  resolveSetupRedirect: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int().positive().nullable(),
        setupAction: z.string().nullable(),
      }),
    )
    .mutation(({ input }) => {
      return resolveGitHubAppSetupRedirect(input);
    }),
  getPullRequestPage: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const data = await getPullRequestPageData(input.owner, input.repo, input.pullNumber);
      if (!data) {
        throw new Error(FAILURES.getPullRequestPage);
      }

      return data;
    }),
  getRepoSubmitPage: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1).nullable(),
      }),
    )
    .query(async ({ input }) => {
      const data = await getRepoSubmitPageData(input.owner, input.repo, input.branch);
      if (!data) {
        throw new Error(FAILURES.getRepoSubmitPage);
      }

      return data;
    }),
  savePullRequest: protectedProcedure
    .input(
      z.object({
        body: z.string(),
        draft: z.boolean(),
        head: z.string().min(1),
        owner: z.string().min(1),
        repo: z.string().min(1),
        title: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await saveBranchPullRequest({
          body: input.body,
          draft: input.draft,
          head: input.head,
          owner: input.owner,
          repo: input.repo,
          title: input.title,
        });
      } catch (error) {
        logGitHubMutationFailure(
          "savePullRequest",
          {
            bodyLength: input.body.length,
            draft: input.draft,
            head: input.head,
            owner: input.owner,
            repo: input.repo,
            titleLength: input.title.length,
          },
          error,
        );
        throwMutationFailure(FAILURES.savePullRequest, error);
      }
    }),
  addPullRequestComment: protectedProcedure
    .input(
      z.object({
        body: z.string().trim().min(1),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await addPullRequestComment({
          body: input.body,
          owner: input.owner,
          pullNumber: input.pullNumber,
          repo: input.repo,
        });
      } catch (error) {
        logGitHubMutationFailure(
          "addPullRequestComment",
          {
            bodyLength: input.body.length,
            owner: input.owner,
            pullNumber: input.pullNumber,
            repo: input.repo,
          },
          error,
        );
        throwMutationFailure(FAILURES.addComment, error);
      }
    }),
  mergePullRequest: protectedProcedure
    .input(
      z.object({
        commitMessage: z.string().optional(),
        commitTitle: z.string().optional(),
        mergeMethod: z.enum(["merge", "squash", "rebase"]).optional(),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await mergeRepoPullRequest({
          commitMessage: input.commitMessage,
          commitTitle: input.commitTitle,
          mergeMethod: input.mergeMethod,
          owner: input.owner,
          pullNumber: input.pullNumber,
          repo: input.repo,
        });
      } catch (error) {
        logGitHubMutationFailure(
          "mergePullRequest",
          {
            ...(input.mergeMethod ? { mergeMethod: input.mergeMethod } : {}),
            owner: input.owner,
            pullNumber: input.pullNumber,
            repo: input.repo,
          },
          error,
        );
        throwMutationFailure(FAILURES.merge, error);
      }
    }),
  submitPullRequestReview: protectedProcedure
    .input(
      z.object({
        body: z.string().optional(),
        comments: z
          .array(
            z.object({
              body: z.string().trim().min(1),
              line: z.number().int().positive(),
              path: z.string().min(1),
              side: z.enum(["LEFT", "RIGHT"]),
            }),
          )
          .optional(),
        event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const body = input.body?.trim();
      const comments = input.comments?.map((comment) => ({
        body: comment.body,
        line: comment.line,
        path: comment.path,
        side: comment.side,
      }));

      if ((!body || body.length === 0) && (!comments || comments.length === 0)) {
        throw new Error(FAILURES.review);
      }

      try {
        return await addPullRequestReview({
          body,
          comments,
          event: input.event,
          owner: input.owner,
          pullNumber: input.pullNumber,
          repo: input.repo,
        });
      } catch (error) {
        logGitHubMutationFailure(
          "submitPullRequestReview",
          {
            bodyLength: body?.length ?? 0,
            commentCount: comments?.length ?? 0,
            event: input.event,
            owner: input.owner,
            pullNumber: input.pullNumber,
            repo: input.repo,
          },
          error,
        );
        throwMutationFailure(FAILURES.review, error);
      }
    }),

  // --- Phase 1: Paginated files ---

  getPullRequestFiles: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
        page: z.number().int().positive().optional(),
        perPage: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(async ({ input }) => {
      const data = await getPullRequestFileList(
        input.owner,
        input.repo,
        input.pullNumber,
        input.page,
        input.perPage,
      );
      return data ?? { files: [], totalCount: 0 };
    }),

  // --- Phase 2: Check runs ---

  getCheckRuns: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        ref: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getCheckRunsForPR(input.owner, input.repo, input.ref);
    }),

  getCheckSummary: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        ref: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getCheckSummaryForPR(input.owner, input.repo, input.ref);
    }),

  // --- Phase 4: PR lifecycle ---

  updatePullRequest: protectedProcedure
    .input(
      z.object({
        body: z.string(),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
        title: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await updateRepoPullRequest(input);
      } catch (error) {
        logGitHubMutationFailure("updatePullRequest", { owner: input.owner, repo: input.repo, pullNumber: input.pullNumber }, error);
        throwMutationFailure(FAILURES.updatePullRequest, error);
      }
    }),

  requestReviewers: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
        reviewers: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await requestPullRequestReviewers(input);
      } catch (error) {
        logGitHubMutationFailure("requestReviewers", { owner: input.owner, repo: input.repo, pullNumber: input.pullNumber }, error);
        throwMutationFailure(FAILURES.requestReviewers, error);
      }
    }),

  removeReviewer: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
        reviewer: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await removePullRequestReviewer(input);
      } catch (error) {
        logGitHubMutationFailure("removeReviewer", { owner: input.owner, repo: input.repo, pullNumber: input.pullNumber }, error);
        throwMutationFailure(FAILURES.removeReviewer, error);
      }
    }),

  listRepoLabels: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getRepoLabels(input.owner, input.repo);
    }),

  addLabels: protectedProcedure
    .input(
      z.object({
        labels: z.array(z.string().min(1)).min(1),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await addPullRequestLabels(input);
      } catch (error) {
        logGitHubMutationFailure("addLabels", { owner: input.owner, repo: input.repo, pullNumber: input.pullNumber }, error);
        throwMutationFailure(FAILURES.addLabels, error);
      }
    }),

  removeLabel: protectedProcedure
    .input(
      z.object({
        label: z.string().min(1),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await removePullRequestLabel(input);
      } catch (error) {
        logGitHubMutationFailure("removeLabel", { owner: input.owner, repo: input.repo, pullNumber: input.pullNumber }, error);
        throwMutationFailure(FAILURES.removeLabel, error);
      }
    }),

  convertToReady: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await convertPullRequestToReady(input);
      } catch (error) {
        logGitHubMutationFailure("convertToReady", { owner: input.owner, repo: input.repo, pullNumber: input.pullNumber }, error);
        throwMutationFailure(FAILURES.convertToReady, error);
      }
    }),

  // --- Phase 5: Repository browser ---

  getRepoTree: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        path: z.string().optional(),
        ref: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getRepoTree(input.owner, input.repo, input.ref, input.path);
    }),

  getFileContent: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        path: z.string().min(1),
        ref: z.string().optional(),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const data = await getRepoFileContent(input.owner, input.repo, input.path, input.ref);
      if (!data) {
        throw new Error(FAILURES.fileContent);
      }
      return data;
    }),

  getFileCommits: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        path: z.string().optional(),
        ref: z.string().optional(),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getRepoCommits(input.owner, input.repo, {
        path: input.path,
        sha: input.ref,
      });
    }),

  getRepoBranches: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      return getRepoBranches(input.owner, input.repo);
    }),
});
