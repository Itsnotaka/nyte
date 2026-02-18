import "server-only";

import { ApprovalError } from "@nyte/application/actions";
import { DismissError } from "@nyte/application/actions";
import { FeedbackError } from "@nyte/application/actions";
import { isToolCallPayload } from "@nyte/domain/actions";
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

import { authedProcedure, router } from "./trpc";

const toolCallPayloadSchema = z.union([
  z.object({
    kind: z.literal("gmail.createDraft"),
    to: z.array(z.string()),
    subject: z.string(),
    body: z.string(),
  }),
  z.object({
    kind: z.literal("google-calendar.createEvent"),
    title: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    attendees: z.array(z.string()),
    description: z.string(),
  }),
  z.object({
    kind: z.literal("billing.queueRefund"),
    customerName: z.string(),
    amount: z.number(),
    currency: z.literal("USD"),
    reason: z.string(),
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

export const appRouter = router({
  queue: router({
    sync: authedProcedure
      .input(
        z.object({
          cursor: z.string().optional(),
          watchKeywords: z.array(z.string()).optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        const accessTokenResult = await auth.api.getAccessToken({
          headers: ctx.request.headers,
          body: { providerId: GOOGLE_AUTH_PROVIDER },
        });

        const accessToken =
          accessTokenResult &&
          typeof accessTokenResult === "object" &&
          "accessToken" in accessTokenResult &&
          typeof accessTokenResult.accessToken === "string" &&
          accessTokenResult.accessToken.trim()
            ? accessTokenResult.accessToken
            : null;

        if (!accessToken) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Google OAuth token is unavailable. Reconnect Google and grant Gmail + Calendar permissions.",
          });
        }

        return runIngestSignalsTask({
          accessToken,
          cursor: input.cursor,
          watchKeywords: input.watchKeywords,
        });
      }),
  }),

  actions: router({
    approve: authedProcedure
      .input(
        z.object({
          itemId: z.string().min(1),
          idempotencyKey: z.string().optional(),
          payloadOverride: toolCallPayloadSchema.optional().refine(
            (val) => val === undefined || isToolCallPayload(val),
            { message: "Invalid payload override." }
          ),
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
          if (error instanceof ApprovalError) throw domainErrorToTRPC(error);
          throw error;
        }
      }),

    dismiss: authedProcedure
      .input(z.object({ itemId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await runDismissActionTask({ itemId: input.itemId });
        } catch (error) {
          if (error instanceof DismissError) throw domainErrorToTRPC(error);
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
          if (error instanceof FeedbackError) throw domainErrorToTRPC(error);
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
