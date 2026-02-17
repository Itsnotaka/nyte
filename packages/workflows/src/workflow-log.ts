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

type WorkflowLogEvent = {
  scope: "workflow.task";
  event: "task.start" | "task.success" | "task.failure";
  taskId: string;
  stage: "local" | "trigger";
  durationMs?: number;
  message?: string;
  errorTag?: string;
  itemId?: string;
  rating?: string;
  hasCursor?: boolean;
  watchKeywordCount?: number;
};

export function workflowInfo(event: WorkflowLogEvent) {
  ensureLoggerInitialized();
  log.info(event);
}

export function workflowError(event: WorkflowLogEvent) {
  ensureLoggerInitialized();
  log.error(event);
}
