import { ingestSignalsTask } from "@nyte/workflows";

import { auth } from "~/lib/auth";

type AccessTokenPayload = {
  accessToken?: unknown;
};

function parseCursor(request: Request) {
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
    return Response.json(
      { error: "Connect Google to load Gmail and Calendar signals." },
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
    return Response.json(
      {
        error:
          "Google OAuth token is unavailable. Reconnect Google and grant Gmail + Calendar permissions.",
      },
      { status: 409 },
    );
  }

  try {
    const result = await ingestSignalsTask({
      accessToken,
      cursor: parseCursor(request),
      now: new Date(),
    });

    return Response.json({
      cursor: result.cursor,
      needsYou: result.needsYou,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Unable to sync Gmail and Calendar signals.";

    return Response.json({ error: message }, { status: 502 });
  }
}
