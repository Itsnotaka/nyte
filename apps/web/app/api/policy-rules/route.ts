import {
  addWatchKeyword,
  listWatchKeywords,
  PolicyRuleError,
  removeWatchKeyword,
} from "@/lib/server/policy-rules";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { InvalidJsonBodyError, readJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type PolicyRuleBody = {
  keyword?: string;
};

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "policy-rules:read", {
      limit: 120,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const keywords = await listWatchKeywords();
  return Response.json({ watchKeywords: keywords });
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
    enforceRateLimit(request, "policy-rules:mutate", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let body: PolicyRuleBody;
  try {
    body = await readJsonBody<PolicyRuleBody>(request);
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!body.keyword) {
    return Response.json({ error: "keyword is required." }, { status: 400 });
  }

  try {
    const keyword = await addWatchKeyword(body.keyword, new Date());
    return Response.json({ keyword });
  } catch (error) {
    if (error instanceof PolicyRuleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to save watch rule." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "policy-rules:mutate", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let body: PolicyRuleBody;
  try {
    body = await readJsonBody<PolicyRuleBody>(request);
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!body.keyword) {
    return Response.json({ error: "keyword is required." }, { status: 400 });
  }

  try {
    const keyword = await removeWatchKeyword(body.keyword);
    return Response.json({ keyword });
  } catch (error) {
    if (error instanceof PolicyRuleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to remove watch rule." }, { status: 500 });
  }
}
