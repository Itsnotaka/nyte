import { FeedbackError, recordFeedback, type FeedbackRating } from "@/lib/server/feedback";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { createJsonBodyErrorResponse, isJsonObject, readJsonBody } from "@/lib/server/json-body";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { dispatchRuntimeCommand } from "@/lib/server/runtime-client";
import {
  createRuntimeCommandContext,
  recordRuntimeDelegationAudit,
  resolveRuntimeRequestId,
  runtimeErrorStatus,
  shouldDelegateRuntimeCommand,
} from "@/lib/server/runtime-delegation";
import { ResultAsync } from "neverthrow";

type FeedbackBody = {
  itemId?: unknown;
  rating?: unknown;
  note?: unknown;
};

const allowedRatings: FeedbackRating[] = ["positive", "negative"];

type NormalizedFeedbackBody =
  | {
      error: string;
    }
  | {
      itemId: string;
      rating: FeedbackRating;
      note?: string;
    };

function normalizeFeedbackBody(body: FeedbackBody): NormalizedFeedbackBody {
  if (body.itemId === undefined) {
    return {
      error: "itemId is required.",
    };
  }

  if (typeof body.itemId !== "string") {
    return {
      error: "itemId must be a string.",
    };
  }

  const itemId = body.itemId.trim();
  if (!itemId) {
    return {
      error: "itemId is required.",
    };
  }

  if (typeof body.rating !== "string" || !allowedRatings.includes(body.rating as FeedbackRating)) {
    return {
      error: "rating must be positive or negative.",
    };
  }

  if (body.note !== undefined && typeof body.note !== "string") {
    return {
      error: "note must be a string.",
    };
  }

  return {
    itemId,
    rating: body.rating as FeedbackRating,
    note: body.note?.trim() || undefined,
  };
}

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "feedback:create", {
    limit: 40,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const rawBody = await readJsonBody<unknown>(request);
  if (rawBody.isErr()) {
    return createJsonBodyErrorResponse(rawBody.error);
  }
  if (!isJsonObject(rawBody.value)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const body = rawBody.value as FeedbackBody;
  const normalized = normalizeFeedbackBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  if (shouldDelegateRuntimeCommand("NYTE_RUNTIME_DELEGATE_FEEDBACK")) {
    const runtimeRequestId = resolveRuntimeRequestId(request);
    const runtimeResult = await dispatchRuntimeCommand({
      type: "runtime.feedback",
      context: createRuntimeCommandContext({
        requestId: runtimeRequestId,
      }),
      payload: {
        itemId: normalized.itemId,
        rating: normalized.rating,
        note: normalized.note,
      },
    });

    if (runtimeResult.isErr()) {
      await recordRuntimeDelegationAudit({
        commandType: "runtime.feedback",
        outcome: "dispatch_error",
        requestId: runtimeRequestId,
        message: runtimeResult.error.message,
      });
      return Response.json({ error: runtimeResult.error.message }, { status: 502 });
    }

    if (runtimeResult.value.status === "error") {
      await recordRuntimeDelegationAudit({
        commandType: "runtime.feedback",
        outcome: "runtime_error",
        requestId: runtimeResult.value.requestId,
        code: runtimeResult.value.code,
        message: runtimeResult.value.message,
      });
      return Response.json(
        { error: runtimeResult.value.message },
        { status: runtimeErrorStatus(runtimeResult.value.code) },
      );
    }

    if (runtimeResult.value.type !== "runtime.feedback") {
      await recordRuntimeDelegationAudit({
        commandType: "runtime.feedback",
        outcome: "invalid_result",
        requestId: runtimeResult.value.requestId,
        message: "Runtime service returned an unexpected command result type.",
      });
      return Response.json(
        { error: "Runtime service returned an unexpected command result type." },
        { status: 502 },
      );
    }

    await recordRuntimeDelegationAudit({
      commandType: "runtime.feedback",
      outcome: "accepted",
      requestId: runtimeResult.value.requestId,
    });

    return Response.json({
      itemId: runtimeResult.value.result.itemId,
      rating: runtimeResult.value.result.rating,
      notedAt: runtimeResult.value.receivedAt,
      delegated: true,
      requestId: runtimeResult.value.requestId,
    });
  }

  const result = await ResultAsync.fromPromise(
    recordFeedback(normalized.itemId, normalized.rating, normalized.note, new Date()),
    (error) => error,
  );
  if (result.isErr()) {
    if (result.error instanceof FeedbackError) {
      const status = result.error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: result.error.message }, { status });
    }
    return Response.json({ error: "Failed to record feedback." }, { status: 500 });
  }

  return Response.json(result.value);
}
