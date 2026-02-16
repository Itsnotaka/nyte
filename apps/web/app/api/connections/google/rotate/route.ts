import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import { rotateGoogleConnectionSecrets } from "@/lib/server/connections";
import {
  InvalidJsonBodyError,
  isJsonObject,
  readOptionalJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

export async function POST(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "connections:google:rotate", {
      limit: 10,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await readOptionalJsonBody<Record<string, unknown>>(request, {});
  } catch (error) {
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  if (!isJsonObject(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  if (Object.keys(body).length > 0) {
    return Response.json(
      { error: "This endpoint does not accept request payload fields." },
      { status: 400 },
    );
  }

  try {
    const result = await rotateGoogleConnectionSecrets(new Date());
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to rotate stored Google connection secrets." },
      { status: 500 },
    );
  }
}
