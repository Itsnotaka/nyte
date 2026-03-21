import { GitHubError, type GitHubOperationMetadata } from "@sachikit/github";
import { TRPCError } from "@trpc/server";
import { Data } from "effect";
import { z } from "zod";

import { log } from "../../evlog";
import {
  GitHubAppConfigurationError,
  GitHubClosedPullRequestExistsError,
  GitHubRepoContextNotFoundError,
  addPullRequestComment,
  addPullRequestLabels,
  addPullRequestReview,
  convertPullRequestToReady,
  getCheckReportForPR,
  getCheckRunsForPR,
  getCheckSummariesForRefs,
  getCheckSummaryForPR,
  getGitHubAppInstallUrl,
  getPullRequestFileList,
  getPullRequestDiscussionData,
  getPullRequestPageData,
  getPullRequestPageDetailsData,
  getPullRequestReviewCommentsData,
  getPullRequestStack,
  getRepositoryPullRequestsPageData,
  getRepoBranches,
  getRepoCommits,
  getRepoFileContent,
  getRepoLabels,
  getRepoSubmitPageData,
  getRepoTree,
  getStackHealth,
  mergeRepoPullRequest,
  removePullRequestLabel,
  removePullRequestReviewer,
  requestPullRequestReviewers,
  restackAfterMerge,
  restackPullRequest,
  saveBranchPullRequest,
  updateRepoPullRequest,
  updateStackedBranch,
} from "../../github/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const FAILURES = {
  addComment: "Failed to add pull request comment.",
  addLabels: "Failed to add labels.",
  convertToReady: "Failed to mark PR as ready for review.",
  fileContent: "File content not found.",
  getPullRequestPage: "Pull request page data not found.",
  getPullRequestDiscussion: "Pull request discussion data not found.",
  getPullRequestDetails: "Pull request details not found.",
  getPullRequestReviewComments: "Pull request review comments not found.",
  getRepoPullsPage: "Pull request list not found.",
  getRepoSubmitPage: "Repository submit page data not found.",
  merge: "Failed to merge pull request.",
  removeLabel: "Failed to remove label.",
  removeReviewer: "Failed to remove reviewer.",
  requestReviewers: "Failed to request reviewers.",
  review: "Failed to submit pull request review.",
  savePullRequest: "Failed to save pull request.",
  updatePullRequest: "Failed to update pull request.",
} as const;

type GitHubAppError =
  | GitHubAppConfigurationError
  | GitHubClosedPullRequestExistsError
  | GitHubRepoContextNotFoundError;

type GitHubRouterErrorCode =
  | "request_validation"
  | "route_data_not_found"
  | "unexpected_failure";

type GitHubRouterErrorMetadata = GitHubOperationMetadata & {
  mutation?: string;
};

type GitHubRouterErrorShape<C extends GitHubRouterErrorCode> = {
  readonly message: string;
  readonly status: number;
  readonly code: C;
  readonly operation: string;
  readonly metadata: GitHubRouterErrorMetadata;
};

class GitHubRouteDataNotFoundError extends Data.TaggedError(
  "GitHubRouteDataNotFoundError",
)<GitHubRouterErrorShape<"route_data_not_found">> {}

class GitHubRequestValidationError extends Data.TaggedError(
  "GitHubRequestValidationError",
)<GitHubRouterErrorShape<"request_validation">> {}

class GitHubUnexpectedError extends Data.TaggedError(
  "GitHubUnexpectedError",
)<GitHubRouterErrorShape<"unexpected_failure">> {}

function getErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const details: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    };

    const coded =
      error instanceof GitHubError ||
      error instanceof GitHubRepoContextNotFoundError ||
      error instanceof GitHubClosedPullRequestExistsError ||
      error instanceof GitHubAppConfigurationError ||
      error instanceof GitHubRouteDataNotFoundError ||
      error instanceof GitHubRequestValidationError ||
      error instanceof GitHubUnexpectedError
        ? error
        : null;

    if (coded) {
      details.tag = coded._tag;
      details.status = coded.status;
      details.code = coded.code;
      details.operation = coded.operation;
      details.metadata = coded.metadata;
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

function settle<T>(
  mutation: string,
  message: string,
  input: Record<string, unknown>,
  task: Promise<T>,
): Promise<T> {
  return task.catch((error) => {
    logGitHubMutationFailure(mutation, input, error);
    throwMutationFailure(mutation, message, error);
  });
}

function mapGitHubErrorToTrpcCode(error: GitHubError): TRPCError["code"] {
  switch (error.code) {
    case "unauthorized":
      return "UNAUTHORIZED";
    case "forbidden":
      return "FORBIDDEN";
    case "not_found":
      return "NOT_FOUND";
    case "rate_limited":
    case "server_error":
    case "unknown":
      return error.status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR";
  }
}

function mapGitHubAppErrorToTrpcCode(
  error: GitHubAppError | GitHubRouteDataNotFoundError | GitHubRequestValidationError | GitHubUnexpectedError,
): TRPCError["code"] {
  switch (error.code) {
    case "repo_context_not_found":
    case "route_data_not_found":
      return "NOT_FOUND";
    case "closed_pull_request_exists":
      return "CONFLICT";
    case "request_validation":
      return "BAD_REQUEST";
    case "app_configuration_invalid":
    case "unexpected_failure":
      return "INTERNAL_SERVER_ERROR";
  }
}

function throwMutationFailure(mutation: string, message: string, error: unknown): never {
  if (error instanceof TRPCError) {
    throw error;
  }

  if (error instanceof GitHubError) {
    throw new TRPCError({
      cause: error,
      code: mapGitHubErrorToTrpcCode(error),
      message,
    });
  }

  const coded =
    error instanceof GitHubRepoContextNotFoundError ||
    error instanceof GitHubClosedPullRequestExistsError ||
    error instanceof GitHubAppConfigurationError ||
    error instanceof GitHubRouteDataNotFoundError ||
    error instanceof GitHubRequestValidationError ||
    error instanceof GitHubUnexpectedError
      ? error
      : null;

  if (coded) {
    throw new TRPCError({
      cause: coded,
      code: mapGitHubAppErrorToTrpcCode(coded),
      message,
    });
  }

  const cause = new GitHubUnexpectedError({
    code: "unexpected_failure",
    message: error instanceof Error && error.message.trim().length > 0 ? error.message : message,
    metadata: { mutation },
    operation: `github.trpc.${mutation}`,
    status: 500,
  });

  throw new TRPCError({
    cause,
    code: "INTERNAL_SERVER_ERROR",
    message,
  });
}

function throwRouteDataNotFound(
  message: string,
  operation: string,
  metadata: GitHubRouterErrorMetadata = {},
): never {
  const cause = new GitHubRouteDataNotFoundError({
    code: "route_data_not_found",
    message,
    metadata,
    operation,
    status: 404,
  });

  throw new TRPCError({
    cause,
    code: "NOT_FOUND",
    message,
  });
}

function throwRequestValidation(
  message: string,
  operation: string,
  metadata: GitHubRouterErrorMetadata = {},
): never {
  const cause = new GitHubRequestValidationError({
    code: "request_validation",
    message,
    metadata,
    operation,
    status: 400,
  });

  throw new TRPCError({
    cause,
    code: "BAD_REQUEST",
    message,
  });
}

export const githubRouter = createTRPCRouter({
  startInstall: protectedProcedure.mutation(() => {
    return { url: getGitHubAppInstallUrl() };
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
        throwRouteDataNotFound(FAILURES.getPullRequestPage, "github.trpc.getPullRequestPage", {
          owner: input.owner,
          repo: input.repo,
          pullNumber: input.pullNumber,
        });
      }

      return data;
    }),
  getPullRequestDiscussion: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const data = await getPullRequestDiscussionData(input.owner, input.repo, input.pullNumber);
      if (!data) {
        throwRouteDataNotFound(FAILURES.getPullRequestDiscussion, "github.trpc.getPullRequestDiscussion", {
          owner: input.owner,
          repo: input.repo,
          pullNumber: input.pullNumber,
        });
      }

      return data;
    }),
  getPullRequestReviewComments: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const data = await getPullRequestReviewCommentsData(
        input.owner,
        input.repo,
        input.pullNumber,
      );
      if (!data) {
        throwRouteDataNotFound(
          FAILURES.getPullRequestReviewComments,
          "github.trpc.getPullRequestReviewComments",
          {
            owner: input.owner,
            repo: input.repo,
            pullNumber: input.pullNumber,
          },
        );
      }

      return data;
    }),
  getPullRequestDetails: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const data = await getPullRequestPageDetailsData(input.owner, input.repo, input.pullNumber);
      if (!data) {
        throwRouteDataNotFound(FAILURES.getPullRequestDetails, "github.trpc.getPullRequestDetails", {
          owner: input.owner,
          repo: input.repo,
          pullNumber: input.pullNumber,
        });
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
        throwRouteDataNotFound(FAILURES.getRepoSubmitPage, "github.trpc.getRepoSubmitPage", {
          owner: input.owner,
          repo: input.repo,
          branch: input.branch ?? undefined,
        });
      }

      return data;
    }),
  getRepoPullsPage: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const data = await getRepositoryPullRequestsPageData(input.owner, input.repo);
      if (!data) {
        throwRouteDataNotFound(FAILURES.getRepoPullsPage, "github.trpc.getRepoPullsPage", {
          owner: input.owner,
          repo: input.repo,
        });
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
      return settle("savePullRequest", FAILURES.savePullRequest, {
        bodyLength: input.body.length,
        draft: input.draft,
        head: input.head,
        owner: input.owner,
        repo: input.repo,
        titleLength: input.title.length,
      }, saveBranchPullRequest({
        body: input.body,
        draft: input.draft,
        head: input.head,
        owner: input.owner,
        repo: input.repo,
        title: input.title,
      }));
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
      return settle("addPullRequestComment", FAILURES.addComment, {
        bodyLength: input.body.length,
        owner: input.owner,
        pullNumber: input.pullNumber,
        repo: input.repo,
      }, addPullRequestComment({
        body: input.body,
        owner: input.owner,
        pullNumber: input.pullNumber,
        repo: input.repo,
      }));
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
      return settle("mergePullRequest", FAILURES.merge, {
        ...(input.mergeMethod ? { mergeMethod: input.mergeMethod } : {}),
        owner: input.owner,
        pullNumber: input.pullNumber,
        repo: input.repo,
      }, mergeRepoPullRequest({
        commitMessage: input.commitMessage,
        commitTitle: input.commitTitle,
        mergeMethod: input.mergeMethod,
        owner: input.owner,
        pullNumber: input.pullNumber,
        repo: input.repo,
      }));
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
        throwRequestValidation(FAILURES.review, "github.trpc.submitPullRequestReview", {
          owner: input.owner,
          repo: input.repo,
          pullNumber: input.pullNumber,
        });
      }

      return settle("submitPullRequestReview", FAILURES.review, {
        bodyLength: body?.length ?? 0,
        commentCount: comments?.length ?? 0,
        event: input.event,
        owner: input.owner,
        pullNumber: input.pullNumber,
        repo: input.repo,
      }, addPullRequestReview({
        body,
        comments,
        event: input.event,
        owner: input.owner,
        pullNumber: input.pullNumber,
        repo: input.repo,
      }));
    }),

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
      return data ?? { files: [], nextPage: null };
    }),

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

  getCheckReport: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        ref: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const report = await getCheckReportForPR(input.owner, input.repo, input.ref);
      return report ?? { runs: [], summary: null };
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

  getCheckSummaries: protectedProcedure
    .input(
      z.array(
        z.object({
          owner: z.string().min(1),
          repo: z.string().min(1),
          ref: z.string().min(1),
        }),
      ),
    )
    .query(async ({ input }) => {
      return getCheckSummariesForRefs(input);
    }),

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
      return settle("updatePullRequest", FAILURES.updatePullRequest, {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
      }, updateRepoPullRequest(input));
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
      return settle("requestReviewers", FAILURES.requestReviewers, {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
      }, requestPullRequestReviewers(input));
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
      return settle("removeReviewer", FAILURES.removeReviewer, {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
      }, removePullRequestReviewer(input));
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
      return settle("addLabels", FAILURES.addLabels, {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
      }, addPullRequestLabels(input));
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
      return settle("removeLabel", FAILURES.removeLabel, {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
      }, removePullRequestLabel(input));
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
      return settle("convertToReady", FAILURES.convertToReady, {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
      }, convertPullRequestToReady(input));
    }),

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
        throwRouteDataNotFound(FAILURES.fileContent, "github.trpc.getFileContent", {
          owner: input.owner,
          repo: input.repo,
          path: input.path,
          ref: input.ref,
        });
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

  getPullRequestStack: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      return getPullRequestStack(input.owner, input.repo, input.pullNumber);
    }),

  getStackHealth: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      return getStackHealth(input.owner, input.repo, input.pullNumber);
    }),

  restackPullRequest: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        pullNumber: z.number().int().positive(),
        newBase: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return settle("restackPullRequest", "Failed to restack pull request.", {
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
        newBase: input.newBase,
      }, restackPullRequest(input.owner, input.repo, input.pullNumber, input.newBase));
    }),

  updateStackedBranch: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1),
        upstreamBranch: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      return settle("updateStackedBranch", "Failed to update stacked branch.", {
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
        upstreamBranch: input.upstreamBranch,
      }, updateStackedBranch(
        input.owner,
        input.repo,
        input.branch,
        input.upstreamBranch,
      ));
    }),

  restackAfterMerge: protectedProcedure
    .input(
      z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        mergedPrNumber: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input }) => {
      return settle("restackAfterMerge", "Failed to restack after merge.", {
        owner: input.owner,
        repo: input.repo,
        mergedPrNumber: input.mergedPrNumber,
      }, restackAfterMerge(input.owner, input.repo, input.mergedPrNumber));
    }),
});
