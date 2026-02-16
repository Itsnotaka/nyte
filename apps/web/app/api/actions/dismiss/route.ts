import { dismissWorkItem, DismissError } from "@/lib/server/dismiss-action";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";
import {
  InvalidJsonBodyError,
  readJsonBody,
  UnsupportedMediaTypeError,
} from "@/lib/server/json-body";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";

type DismissBody = {
  itemId?: string;
};

export async function POST(request: Request) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  try {
    enforceRateLimit(request, "actions:dismiss", {
      limit: 30,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitResponse(error);
    }
  }

  let body: DismissBody;
  try {
    body = await readJsonBody<DismissBody>(request);
  } catch (error) {
    if (error instanceof UnsupportedMediaTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }

    if (error instanceof InvalidJsonBodyError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  const itemId = body.itemId?.trim();
  if (!itemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }

  try {
    const result = await dismissWorkItem(itemId, new Date());
    return Response.json(result);
  } catch (error) {
    if (error instanceof DismissError) {
      const status = error.message.includes("not found") ? 404 : 409;
      return Response.json({ error: error.message }, { status });
    }

    return Response.json({ error: "Failed to dismiss work item." }, { status: 500 });
  }
}
