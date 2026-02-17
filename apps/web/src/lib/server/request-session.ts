import type { WorkflowTaskId } from "@nyte/workflows";

import { auth } from "~/lib/auth";
import { resolveSessionUserId } from "~/lib/shared/session-user-id";

import type {
  HttpStatusCode,
  NeedsYouRouteMethod,
  NeedsYouRoutePath,
} from "./needs-you-route-config";
import type { ApiRequestLogger } from "./request-log";
import { toWorkflowApiErrorJsonResponse } from "./workflow-route-error";

type SessionValue = Awaited<ReturnType<typeof auth.api.getSession>>;
type AuthenticatedSessionValue = NonNullable<SessionValue>;

type UnauthorizedSessionResolution = {
  session: null;
  userId: string | null;
  status: HttpStatusCode;
  response: Response;
};

type AuthorizedSessionResolution = {
  session: AuthenticatedSessionValue;
  userId: string;
  status: null;
  response: null;
};

export type RequestSessionResolution = UnauthorizedSessionResolution | AuthorizedSessionResolution;

export async function resolveAuthenticatedRequestSession({
  request,
  requestLog,
  unauthorizedEvent,
  unauthorizedMessage,
  unauthorizedStatus,
  route,
  method,
  taskId,
}: {
  request: Request;
  requestLog: ApiRequestLogger;
  unauthorizedEvent: string;
  unauthorizedMessage: string;
  unauthorizedStatus: HttpStatusCode;
  route: NeedsYouRoutePath;
  method: NeedsYouRouteMethod;
  taskId: WorkflowTaskId;
}): Promise<RequestSessionResolution> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const userId = resolveSessionUserId(session);
  requestLog.set({
    userId,
  });

  if (!session || !userId) {
    requestLog.warn(unauthorizedEvent, {
      route,
      method,
      status: unauthorizedStatus,
      userId,
      taskId,
    });

    return {
      session: null,
      userId,
      status: unauthorizedStatus,
      response: toWorkflowApiErrorJsonResponse(unauthorizedMessage, unauthorizedStatus),
    };
  }

  return {
    session,
    userId,
    status: null,
    response: null,
  };
}
