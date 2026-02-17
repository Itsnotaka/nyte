import { auth } from "~/lib/auth";
import { resolveSessionUserId } from "~/lib/shared/session-user-id";

import type { ApiRequestLogger } from "./request-log";

type SessionValue = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function resolveRequestSession({
  request,
  requestLog,
}: {
  request: Request;
  requestLog: ApiRequestLogger;
}): Promise<{
  session: SessionValue;
  userId: string | null;
}> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const userId = resolveSessionUserId(session);
  requestLog.set({
    userId,
  });

  return {
    session,
    userId,
  };
}
