import { initLogger, log } from "evlog";

let loggerInitialized = false;

function ensureLoggerInitialized() {
  if (loggerInitialized) {
    return;
  }

  initLogger({
    env: {
      service: "nyte-workflows",
      environment: process.env.NODE_ENV ?? "development",
    },
  });
  loggerInitialized = true;
}

export function workflowInfo(event: Record<string, unknown>) {
  ensureLoggerInitialized();
  log.info(event);
}

export function workflowWarn(event: Record<string, unknown>) {
  ensureLoggerInitialized();
  log.warn(event);
}

export function workflowError(event: Record<string, unknown>) {
  ensureLoggerInitialized();
  log.error(event);
}
