import { dismissWorkItem, DismissError } from "@/lib/server/dismiss-action";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { createJsonBodyErrorResponse, isJsonObject, readJsonBody } from "@/lib/server/json-body";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { dispatchRuntimeCommand } from "@/lib/server/runtime-client";
import {
  createRuntimeCommandContext,
  runtimeErrorStatus,
  shouldDelegateRuntimeCommand,
} from "@/lib/server/runtime-delegation";
import { ResultAsync } from "neverthrow";

type DismissBody = {
  itemId?: unknown;
};

type NormalizedDismissBody =
  | {
      error: string;
    }
  | {
      itemId: string;
    };

function normalizeDismissBody(body: DismissBody): NormalizedDismissBody {
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

  return {
    itemId,
  };
}

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "actions:dismiss", {
    limit: 30,
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

  const body = rawBody.value as DismissBody;
  const normalized = normalizeDismissBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  if (shouldDelegateRuntimeCommand("NYTE_RUNTIME_DELEGATE_DISMISS")) {
    const runtimeResult = await dispatchRuntimeCommand({
      type: "runtime.dismiss",
      context: createRuntimeCommandContext(),
      payload: {
        itemId: normalized.itemId,
      },
    });

    if (runtimeResult.isErr()) {
      return Response.json({ error: runtimeResult.error.message }, { status: 502 });
    }

    if (runtimeResult.value.status === "error") {
      return Response.json(
        { error: runtimeResult.value.message },
        { status: runtimeErrorStatus(runtimeResult.value.code) },
      );
    }

    if (runtimeResult.value.type !== "runtime.dismiss") {
      return Response.json(
        { error: "Runtime service returned an unexpected command result type." },
        { status: 502 },
      );
    }

    return Response.json({
      itemId: runtimeResult.value.result.itemId,
      status: "dismissed",
      idempotent: false,
      dismissedAt: runtimeResult.value.receivedAt,
      delegated: true,
      requestId: runtimeResult.value.requestId,
    });
  }

  const result = await ResultAsync.fromPromise(
    dismissWorkItem(normalized.itemId, new Date()),
    (error) => error,
  );
  if (result.isErr()) {
    if (result.error instanceof DismissError) {
      const status = result.error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: result.error.message }, { status });
    }
    return Response.json({ error: "Failed to dismiss work item." }, { status: 500 });
  }

  return Response.json(result.value);
}
