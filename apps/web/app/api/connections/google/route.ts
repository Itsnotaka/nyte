import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  upsertGoogleConnection,
} from "@/lib/server/connections";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import {
  createJsonBodyErrorResponse,
  isJsonObject,
  readOptionalJsonBody,
} from "@/lib/server/json-body";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

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
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "connections:google:read", {
    limit: 120,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const status = await ResultAsync.fromPromise(getGoogleConnectionStatus(), () => {
    return new Error("Failed to load Google connection status.");
  });
  return status.match(
    (value) => Response.json(value),
    () => Response.json({ error: "Failed to load Google connection status." }, { status: 500 }),
  );
}

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "connections:google:mutate", {
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const rawBody = await readOptionalJsonBody<unknown>(request, {});
  if (rawBody.isErr()) {
    return createJsonBodyErrorResponse(rawBody.error);
  }
  if (!isJsonObject(rawBody.value)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const body = rawBody.value as ConnectBody;
  const normalizedBody = normalizeConnectBody(body);
  if ("error" in normalizedBody) {
    return Response.json({ error: normalizedBody.error }, { status: 400 });
  }
  const status = await ResultAsync.fromPromise(
    upsertGoogleConnection(
      {
        providerAccountId: normalizedBody.value.providerAccountId,
        accessToken: normalizedBody.value.accessToken,
        refreshToken: normalizedBody.value.refreshToken,
        scopes: normalizedBody.value.scopes,
      },
      new Date(),
    ),
    () => new Error("Failed to update Google connection status."),
  );
  if (status.isErr()) {
    return Response.json({ error: "Failed to update Google connection status." }, { status: 500 });
  }

  return Response.json(status.value);
}

export async function DELETE(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "connections:google:mutate", {
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const status = await ResultAsync.fromPromise(disconnectGoogleConnection(), () => {
    return new Error("Failed to disconnect Google connection.");
  });
  return status.match(
    (value) => Response.json(value),
    () => Response.json({ error: "Failed to disconnect Google connection." }, { status: 500 }),
  );
}
