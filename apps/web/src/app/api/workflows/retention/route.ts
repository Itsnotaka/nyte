import {
  getWorkflowRetentionDays,
  setWorkflowRetentionDays,
  WorkflowRetentionError,
} from "~/lib/server/workflow-retention";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "~/lib/server/authz";
import { createJsonBodyErrorResponse, isJsonObject, readJsonBody } from "~/lib/server/json-body";
import { rateLimitRequest } from "~/lib/server/rate-limit";
import { createRateLimitResponse } from "~/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

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
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "workflows:retention:read", {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const retention = await ResultAsync.fromPromise(getWorkflowRetentionDays(), () => {
    return new Error("Failed to read retention policy.");
  });
  return retention.match(
    (value) => Response.json(value),
    () => Response.json({ error: "Failed to read retention policy." }, { status: 500 }),
  );
}

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "workflows:retention:update", {
    limit: 20,
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

  const body = rawBody.value as RetentionBody;
  const normalized = normalizeRetentionBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const retention = await ResultAsync.fromPromise(
    setWorkflowRetentionDays(normalized.days, new Date()),
    (error) => error,
  );
  if (retention.isErr()) {
    if (retention.error instanceof WorkflowRetentionError) {
      return Response.json({ error: retention.error.message }, { status: 400 });
    }

    return Response.json({ error: "Failed to update retention policy." }, { status: 500 });
  }

  return Response.json(retention.value);
}
