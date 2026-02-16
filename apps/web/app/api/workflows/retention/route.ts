import {
  getWorkflowRetentionDays,
  setWorkflowRetentionDays,
  WorkflowRetentionError,
} from "@/lib/server/workflow-retention";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  readJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type RetentionBody = {
  days?: unknown;
};

type NormalizedRetentionBody =
  | {
      error: string;
    }
  | {
      days: number;
    };

function normalizeRetentionBody(body: RetentionBody): NormalizedRetentionBody {
  if (body.days === undefined) {
    return {
      error: "days is required.",
    };
  }

  if (typeof body.days !== "number") {
    return {
      error: "days must be a number.",
    };
  }

  return {
    days: body.days,
  };
}

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "workflows:retention:read", {
      limit: 120,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const retention = await getWorkflowRetentionDays();
  return Response.json(retention);
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
    enforceRateLimit(request, "workflows:retention:update", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let body: RetentionBody;
  try {
    body = await readJsonBody<RetentionBody>(request);
  } catch (error) {
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const normalized = normalizeRetentionBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  try {
    const retention = await setWorkflowRetentionDays(normalized.days, new Date());
    return Response.json(retention);
  } catch (error) {
    if (error instanceof WorkflowRetentionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: "Failed to update retention policy." }, { status: 500 });
  }
}
