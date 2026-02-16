import {
  addWatchKeyword,
  listWatchKeywords,
  PolicyRuleError,
  removeWatchKeyword,
} from "@/lib/server/policy-rules";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  readJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

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
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const normalized = normalizePolicyRuleBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  try {
    const keyword = await addWatchKeyword(normalized.keyword, new Date());
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
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const normalized = normalizePolicyRuleBody(body);
  if ("error" in normalized) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  try {
    const keyword = await removeWatchKeyword(normalized.keyword);
    return Response.json({ keyword });
  } catch (error) {
    if (error instanceof PolicyRuleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to remove watch rule." }, { status: 500 });
  }
}
