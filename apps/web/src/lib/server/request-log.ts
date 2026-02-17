import { createRequestLogger, initLogger, type RequestLogger } from "evlog";
import type {
  FeedbackActionRequest,
  WorkflowTaskId,
  WorkflowTaskStage,
} from "@nyte/workflows";
import type { NeedsYouRouteMethod } from "./needs-you-route-config";

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
  route: string;
  method: NeedsYouRouteMethod;
  requestId?: string | null;
  userId?: string | null;
  itemId?: string;
  taskId?: WorkflowTaskId;
  stage?: WorkflowTaskStage;
  hasCursor?: boolean;
  watchKeywordCount?: number;
  rating?: FeedbackActionRequest["rating"];
  status?: number;
  errorTag?: string;
  message?: string;
  durationMs?: number;
};

export type ApiRequestLogger = RequestLogger<RequestLogContext>;

export function createApiRequestLogger(
  request: Request,
  route: string,
): ApiRequestLogger {
  ensureLoggerInitialized();

  return createRequestLogger<RequestLogContext>({
    method: request.method,
    path: route,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });
}
