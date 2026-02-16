import { ApprovalError, approveWorkItem } from "@/lib/server/approve-action";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  isJsonObject,
  readJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

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
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "actions:approve", {
      limit: 30,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody<unknown>(request);
  } catch (error) {
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!isJsonObject(rawBody)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const body = rawBody as ApproveBody;
  const normalized = normalizeApproveBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }
  const idempotencyKey = request.headers.get("x-idempotency-key") ?? normalized.idempotencyKey;

  try {
    const result = await approveWorkItem(
      normalized.itemId,
      new Date(),
      idempotencyKey ?? undefined,
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApprovalError) {
      const status = error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Failed to approve work item." }, { status: 500 });
  }
}
