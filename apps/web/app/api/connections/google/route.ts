import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  upsertGoogleConnection,
} from "@/lib/server/connections";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  isJsonObject,
  readOptionalJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type ConnectBody = {
  providerAccountId?: unknown;
  accessToken?: unknown;
  refreshToken?: unknown;
  scopes?: unknown;
};

type NormalizedConnectBody = {
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
};

type NormalizeConnectBodyResult =
  | {
      error: string;
    }
  | {
      value: NormalizedConnectBody;
    };

function normalizeOptionalString(value: unknown, fieldName: string) {
  if (value === undefined) {
    return {
      value: undefined,
    };
  }

  if (typeof value !== "string") {
    return {
      error: `${fieldName} must be a string.`,
    };
  }

  const trimmed = value.trim();
  return {
    value: trimmed || undefined,
  };
}

function normalizeConnectBody(body: ConnectBody): NormalizeConnectBodyResult {
  const providerAccountId = normalizeOptionalString(body.providerAccountId, "providerAccountId");
  if (providerAccountId.error) {
    return providerAccountId;
  }

  const accessToken = normalizeOptionalString(body.accessToken, "accessToken");
  if (accessToken.error) {
    return accessToken;
  }

  const refreshToken = normalizeOptionalString(body.refreshToken, "refreshToken");
  if (refreshToken.error) {
    return refreshToken;
  }

  if (body.scopes !== undefined) {
    if (!Array.isArray(body.scopes)) {
      return {
        error: "scopes must be an array of strings.",
      };
    }

    const normalizedScopes: string[] = [];
    for (const scope of body.scopes) {
      if (typeof scope !== "string") {
        return {
          error: "scopes must contain non-empty string values.",
        };
      }

      const trimmedScope = scope.trim();
      if (!trimmedScope) {
        return {
          error: "scopes must contain non-empty string values.",
        };
      }

      normalizedScopes.push(trimmedScope);
    }

    if (normalizedScopes.length === 0) {
      return {
        error: "scopes must contain non-empty string values.",
      };
    }

    return {
      value: {
        providerAccountId: providerAccountId.value,
        accessToken: accessToken.value,
        refreshToken: refreshToken.value,
        scopes: Array.from(new Set(normalizedScopes)),
      },
    };
  }

  return {
    value: {
      providerAccountId: providerAccountId.value,
      accessToken: accessToken.value,
      refreshToken: refreshToken.value,
      scopes: undefined,
    },
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
    enforceRateLimit(request, "connections:google:read", {
      limit: 120,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const status = await getGoogleConnectionStatus();
  return Response.json(status);
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
    enforceRateLimit(request, "connections:google:mutate", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await readOptionalJsonBody<unknown>(request, {});
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

  const body = rawBody as ConnectBody;
  const normalizedBody = normalizeConnectBody(body);
  if ("error" in normalizedBody) {
    return Response.json({ error: normalizedBody.error }, { status: 400 });
  }
  const status = await upsertGoogleConnection(
    {
      providerAccountId: normalizedBody.value.providerAccountId,
      accessToken: normalizedBody.value.accessToken,
      refreshToken: normalizedBody.value.refreshToken,
      scopes: normalizedBody.value.scopes,
    },
    new Date(),
  );

  return Response.json(status);
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
    enforceRateLimit(request, "connections:google:mutate", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  const status = await disconnectGoogleConnection();
  return Response.json(status);
}
