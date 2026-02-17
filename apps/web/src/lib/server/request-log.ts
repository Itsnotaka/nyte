import { createRequestLogger, initLogger, type RequestLogger } from "evlog";
import type {
  FeedbackActionRequest,
  WorkflowTaskId,
  WorkflowTaskStage,
} from "@nyte/workflows";
import type { NeedsYouRouteMethod, NeedsYouRoutePath } from "./needs-you-route-config";
import type { HttpStatusCode } from "./http-status";

let loggerInitialized = false;

function ensureLoggerInitialized() {
  if (loggerInitialized) {
    return;
  }

  initLogger({
    env: {
      service: "nyte-web",
      environment: process.env.NODE_ENV ?? "development",
    },
  });
  loggerInitialized = true;
}

export type RequestLogContext = {
  route: NeedsYouRoutePath;
  method: NeedsYouRouteMethod;
  requestId?: string | null;
  userId?: string | null;
  itemId?: string;
  taskId?: WorkflowTaskId;
  stage?: WorkflowTaskStage;
  hasCursor?: boolean;
  watchKeywordCount?: number;
  rating?: FeedbackActionRequest["rating"];
  status?: HttpStatusCode;
  errorTag?: string;
  message?: string;
  durationMs?: number;
};

export type ApiRequestLogger = RequestLogger<RequestLogContext>;

export function createApiRequestLogger(
  request: Request,
  route: NeedsYouRoutePath,
): ApiRequestLogger {
  ensureLoggerInitialized();

  return createRequestLogger<RequestLogContext>({
    method: request.method,
    path: route,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });
}
