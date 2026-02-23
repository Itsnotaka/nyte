import "server-only";
import {
  isApprovalError,
  type ApprovalError,
} from "@nyte/application/actions/approve";
import {
  isDismissError,
  type DismissError,
} from "@nyte/application/actions/dismiss";
import {
  isFeedbackError,
  type FeedbackError,
} from "@nyte/application/actions/feedback";
import { getDashboardData } from "@nyte/application/dashboard/data";
import { getUserIngestionState } from "@nyte/application/queue/ingestion-state";
import { queueToolCall } from "@nyte/application/queue/queue-tool-call";
import {
  runApproveActionTask,
  runDismissActionTask,
  runFeedbackTask,
  runIngestSignalsTask,
} from "@nyte/workflows";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { auth } from "~/lib/auth";
import { GOOGLE_AUTH_PROVIDER } from "~/lib/auth-provider";

import { buildDefaultPayload, parseCommandToToolCall } from "./parse-command";
import { authedProcedure, router } from "./trpc";

const WATCH_KEYWORD_MIN_LENGTH = 3;
const WATCH_KEYWORD_MAX_LENGTH = 64;
const WATCH_KEYWORD_LIMIT = 8;
const QUEUE_STALE_THRESHOLD_MS = 2 * 60 * 1000;

const watchKeywordSchema = z
  .string()
  .trim()
  .min(WATCH_KEYWORD_MIN_LENGTH)
  .max(WATCH_KEYWORD_MAX_LENGTH);

const watchKeywordsSchema = z
  .array(watchKeywordSchema)
  .max(WATCH_KEYWORD_LIMIT);

const toolCallPayloadSchema = z.union([
  z.object({
    kind: z.literal("gmail.createDraft"),
    to: z.array(z.email()).min(1).max(20),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(5000),
  }),
  z.object({
    kind: z.literal("google-calendar.createEvent"),
    title: z.string().trim().min(1).max(300),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    attendees: z.array(z.email()).max(50),
    description: z.string().trim().min(1).max(5000),
  }),
  z.object({
    kind: z.literal("billing.queueRefund"),
    customerName: z.string().trim().min(1).max(300),
    amount: z.number().finite().nonnegative(),
    currency: z.literal("USD"),
    reason: z.string().trim().min(1).max(5000),
  }),
]);

function domainErrorToTRPC(
  error: ApprovalError | DismissError | FeedbackError
): TRPCError {
  const code =
    error.code === "not_found"
      ? "NOT_FOUND"
      : error.code === "invalid_payload"
        ? "BAD_REQUEST"
        : "CONFLICT";
  return new TRPCError({ code, message: error.message });
}

function resolveAccessToken(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const token = (value as { accessToken?: unknown }).accessToken;
  if (typeof token !== "string") {
    return null;
  }

  return token.trim().length > 0 ? token : null;
}

function isQueueStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) {
    return true;
  }

  const parsed = new Date(lastSyncedAt);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return Date.now() - parsed.getTime() >= QUEUE_STALE_THRESHOLD_MS;
}

export const appRouter = router({
  queue: router({
    feed: authedProcedure
      .input(
        z
          .object({
            includeAll: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const includeAll = input?.includeAll ?? false;
        const dashboard = await getDashboardData(ctx.userId, {
          importantOnly: !includeAll,
          includeSecondary: false,
        });
        const state = await getUserIngestionState(ctx.userId);

        return {
          approvalQueue: dashboard.approvalQueue,
          lastSyncedAt: state?.lastSyncedAt ?? null,
          isStale: isQueueStale(state?.lastSyncedAt ?? null),
        };
      }),
    sync: authedProcedure
      .input(
        z
          .object({
            cursor: z.string().optional(),
            watchKeywords: watchKeywordsSchema.optional(),
            force: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ input, ctx }) => {
        const accessToken = resolveAccessToken(
          await auth.api.getAccessToken({
            headers: ctx.request.headers,
            body: { providerId: GOOGLE_AUTH_PROVIDER },
          })
        );

        if (!accessToken) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Google OAuth token is unavailable. Reconnect Google and grant Gmail + Calendar permissions.",
          });
        }

        return runIngestSignalsTask({
          userId: ctx.userId,
          accessToken,
          cursor: input?.cursor,
          watchKeywords: input?.watchKeywords,
          staleAfterMs: QUEUE_STALE_THRESHOLD_MS,
          force: input?.force,
        });
      }),
  }),

  agent: router({
    run: authedProcedure
      .input(
        z.object({
          message: z.string().trim().min(1).max(1000),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const kind = parseCommandToToolCall(input.message);
        const payload = buildDefaultPayload(kind, input.message);
        const itemId = await queueToolCall(payload, ctx.userId, input.message);
        return { itemId };
      }),
  }),

  actions: router({
    approve: authedProcedure
      .input(
        z.object({
          itemId: z.string().min(1),
          idempotencyKey: z.string().optional(),
          payloadOverride: toolCallPayloadSchema.optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await runApproveActionTask({
            itemId: input.itemId,
            idempotencyKey: input.idempotencyKey,
            payloadOverride: input.payloadOverride,
            actorUserId: ctx.userId,
          });
        } catch (error) {
          if (isApprovalError(error)) throw domainErrorToTRPC(error);
          throw error;
        }
      }),

    dismiss: authedProcedure
      .input(z.object({ itemId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await runDismissActionTask({ itemId: input.itemId });
        } catch (error) {
          if (isDismissError(error)) throw domainErrorToTRPC(error);
          throw error;
        }
      }),

    feedback: authedProcedure
      .input(
        z.object({
          itemId: z.string().min(1),
          rating: z.enum(["positive", "negative"]),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await runFeedbackTask({
            itemId: input.itemId,
            rating: input.rating,
            note: input.note,
          });
        } catch (error) {
          if (isFeedbackError(error)) throw domainErrorToTRPC(error);
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
