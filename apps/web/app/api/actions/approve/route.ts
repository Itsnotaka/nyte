import { ApprovalError, approveWorkItem } from "@/lib/server/approve-action";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { createJsonBodyErrorResponse, isJsonObject, readJsonBody } from "@/lib/server/json-body";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

type ApproveBody = {
  itemId?: unknown;
  idempotencyKey?: unknown;
};

type NormalizedApproveBody =
  | {
      error: string;
    }
  | {
      itemId: string;
      idempotencyKey?: string;
    };

function normalizeApproveBody(body: ApproveBody): NormalizedApproveBody {
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

  if (body.idempotencyKey !== undefined && typeof body.idempotencyKey !== "string") {
    return {
      error: "idempotencyKey must be a string.",
    };
  }

  return {
    itemId,
    idempotencyKey: body.idempotencyKey?.trim() || undefined,
  };
}

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "actions:approve", {
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

  const body = rawBody.value as ApproveBody;
  const normalized = normalizeApproveBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }
  const idempotencyKey = request.headers.get("x-idempotency-key") ?? normalized.idempotencyKey;

  const result = await ResultAsync.fromPromise(
    approveWorkItem(normalized.itemId, new Date(), idempotencyKey ?? undefined),
    (error) => error,
  );
  if (result.isErr()) {
    if (result.error instanceof ApprovalError) {
      const status = result.error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: result.error.message }, { status });
    }
    return Response.json({ error: "Failed to approve work item." }, { status: 500 });
  }

  return Response.json(result.value);
}
