import {
  addWatchKeyword,
  listWatchKeywords,
  PolicyRuleError,
  removeWatchKeyword,
} from "~/lib/server/policy-rules";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "~/lib/server/authz";
import { createJsonBodyErrorResponse, isJsonObject, readJsonBody } from "~/lib/server/json-body";
import { rateLimitRequest } from "~/lib/server/rate-limit";
import { createRateLimitResponse } from "~/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

type PolicyRuleBody = {
  keyword?: unknown;
};

type NormalizedPolicyRuleBody =
  | {
      error: string;
    }
  | {
      keyword: string;
    };

function normalizePolicyRuleBody(body: PolicyRuleBody): NormalizedPolicyRuleBody {
  if (body.keyword === undefined) {
    return {
      error: "keyword is required.",
    };
  }

  if (typeof body.keyword !== "string") {
    return {
      error: "keyword must be a string.",
    };
  }

  const keyword = body.keyword.trim();
  if (!keyword) {
    return {
      error: "keyword is required.",
    };
  }

  return {
    keyword,
  };
}

export async function GET(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "policy-rules:read", {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const keywords = await ResultAsync.fromPromise(listWatchKeywords(), () => {
    return new Error("Failed to load watch rules.");
  });
  return keywords.match(
    (value) => Response.json({ watchKeywords: value }),
    () => Response.json({ error: "Failed to load watch rules." }, { status: 500 }),
  );
}

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "policy-rules:mutate", {
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

  const body = rawBody.value as PolicyRuleBody;
  const normalized = normalizePolicyRuleBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const keyword = await ResultAsync.fromPromise(
    addWatchKeyword(normalized.keyword, new Date()),
    (error) => error,
  );
  if (keyword.isErr()) {
    if (keyword.error instanceof PolicyRuleError) {
      return Response.json({ error: keyword.error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to save watch rule." }, { status: 500 });
  }

  return Response.json({ keyword: keyword.value });
}

export async function DELETE(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "policy-rules:mutate", {
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

  const body = rawBody.value as PolicyRuleBody;
  const normalized = normalizePolicyRuleBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const keyword = await ResultAsync.fromPromise(
    removeWatchKeyword(normalized.keyword),
    (error) => error,
  );
  if (keyword.isErr()) {
    if (keyword.error instanceof PolicyRuleError) {
      return Response.json({ error: keyword.error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to remove watch rule." }, { status: 500 });
  }

  return Response.json({ keyword: keyword.value });
}
