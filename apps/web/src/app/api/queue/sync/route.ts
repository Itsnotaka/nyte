import {
  runIngestSignalsTask,
  type QueueSyncRequest,
  type QueueSyncResponse,
  type WorkflowApiErrorResponse,
} from "@nyte/workflows";

import { auth } from "~/lib/auth";

type AccessTokenPayload = {
  accessToken?: unknown;
};

function parseCursor(request: Request): QueueSyncRequest["cursor"] {
  const cursor = new URL(request.url).searchParams.get("cursor")?.trim();
  if (!cursor) {
    return undefined;
  }

  return cursor;
}

function resolveAccessToken(payload: AccessTokenPayload) {
  if (typeof payload.accessToken !== "string") {
    return null;
  }

  const normalized = payload.accessToken.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    const response: WorkflowApiErrorResponse = {
      error: "Connect Google to load Gmail and Calendar signals.",
    };
    return Response.json(
      response,
      { status: 401 },
    );
  }

  const accessTokenResult = (await auth.api.getAccessToken({
    headers: request.headers,
    body: {
      providerId: "google",
    },
  })) as AccessTokenPayload;

  const accessToken = resolveAccessToken(accessTokenResult);
  if (!accessToken) {
    const response: WorkflowApiErrorResponse = {
      error:
        "Google OAuth token is unavailable. Reconnect Google and grant Gmail + Calendar permissions.",
    };
    return Response.json(
      response,
      { status: 409 },
    );
  }

  try {
    const result = await runIngestSignalsTask({
      accessToken,
      cursor: parseCursor(request),
    });

    const response: QueueSyncResponse = {
      cursor: result.cursor,
      needsYou: result.needsYou,
    };
    return Response.json(response);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Unable to sync Gmail and Calendar signals.";

    const response: WorkflowApiErrorResponse = {
      error: message,
    };
    return Response.json(response, { status: 502 });
  }
}
