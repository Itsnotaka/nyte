import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  upsertGoogleConnection,
} from "@/lib/server/connections";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { InvalidJsonBodyError, readOptionalJsonBody } from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type ConnectBody = {
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
};

export async function GET(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
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

  let body: ConnectBody;
  try {
    body = await readOptionalJsonBody<ConnectBody>(request, {});
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const status = await upsertGoogleConnection(
    {
      providerAccountId: body.providerAccountId,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      scopes: body.scopes,
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
