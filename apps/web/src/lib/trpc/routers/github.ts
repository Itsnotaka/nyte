import { z } from "zod";

import {
  addPullRequestComment,
  addPullRequestReview,
  getGitHubAppInstallUrl,
  getPullRequestPageData,
  getRepoSubmitPageData,
  resolveGitHubAppSetupRedirect,
  saveBranchPullRequest,
} from "../../github/server";
import { createTRPCRouter, protectedProcedure } from "../server";

const FAILURES = {
  addComment: "Failed to add pull request comment.",
  getPullRequestPage: "Pull request page data not found.",
  getRepoSubmitPage: "Repository submit page data not found.",
  review: "Failed to submit pull request review.",
  savePullRequest: "Failed to save pull request.",
} as const;

export const githubRouter = createTRPCRouter({
  startInstall: protectedProcedure.mutation(() => {
    return { url: getGitHubAppInstallUrl() };
  }),
  resolveSetupRedirect: protectedProcedure
    .input(
      z.object({
        installationId: z.number().int().positive().nullable(),
        setupAction: z.string().nullable(),
      })
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
      })
    )
    .query(async ({ input }) => {
      const data = await getPullRequestPageData(
        input.owner,
        input.repo,
        input.pullNumber
      );
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
      })
    )
    .query(async ({ input }) => {
      const data = await getRepoSubmitPageData(
        input.owner,
        input.repo,
        input.branch
      );
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
      })
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
      } catch {
        throw new Error(FAILURES.savePullRequest);
      }
    }),
  addPullRequestComment: protectedProcedure
    .input(
      z.object({
        body: z.string().trim().min(1),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await addPullRequestComment({
          body: input.body,
          owner: input.owner,
          pullNumber: input.pullNumber,
          repo: input.repo,
        });
      } catch {
        throw new Error(FAILURES.addComment);
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
            })
          )
          .optional(),
        event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
        owner: z.string().min(1),
        pullNumber: z.number().int().positive(),
        repo: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const body = input.body?.trim();
      const comments = input.comments?.map((comment) => ({
        body: comment.body,
        line: comment.line,
        path: comment.path,
        side: comment.side,
      }));

      if (
        (!body || body.length === 0) &&
        (!comments || comments.length === 0)
      ) {
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
      } catch {
        throw new Error(FAILURES.review);
      }
    }),
});
