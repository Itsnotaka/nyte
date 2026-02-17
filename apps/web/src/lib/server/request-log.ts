import { createRequestLogger, initLogger, type RequestLogger } from "evlog";

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

type RequestLogContext = {
  route: string;
  method: string;
  requestId?: string | null;
  userId?: string | null;
  itemId?: string;
  taskId?: string;
  status?: number;
  errorTag?: string;
  message?: string;
  durationMs?: number;
};

export function createApiRequestLogger(
  request: Request,
  route: string,
): RequestLogger<RequestLogContext> {
  ensureLoggerInitialized();

  return createRequestLogger<RequestLogContext>({
    method: request.method,
    path: route,
    requestId: request.headers.get("x-request-id") ?? undefined,
  });
}
