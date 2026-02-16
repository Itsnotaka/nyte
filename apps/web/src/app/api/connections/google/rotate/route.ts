import { createAuthorizationErrorResponse, requireAuthorizedSession } from "~/lib/server/authz";
import { rotateGoogleConnectionSecrets } from "~/lib/server/connections";
import {
  createJsonBodyErrorResponse,
  isJsonObject,
  readOptionalJsonBody,
} from "~/lib/server/json-body";
import { rateLimitRequest } from "~/lib/server/rate-limit";
import { createRateLimitResponse } from "~/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

export async function POST(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "connections:google:rotate", {
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const body = await readOptionalJsonBody<Record<string, unknown>>(request, {});
  if (body.isErr()) {
    return createJsonBodyErrorResponse(body.error);
  }
  if (!isJsonObject(body.value)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  if (Object.keys(body.value).length > 0) {
    return Response.json(
      { error: "This endpoint does not accept request payload fields." },
      { status: 400 },
    );
  }

  const result = await ResultAsync.fromPromise(rotateGoogleConnectionSecrets(new Date()), () => {
    return new Error("Failed to rotate stored Google connection secrets.");
  });
  if (result.isErr()) {
    return Response.json(
      { error: "Failed to rotate stored Google connection secrets." },
      { status: 500 },
    );
  }

  return Response.json(result.value);
}
