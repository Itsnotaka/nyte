import { initLogger, log } from "evlog";
import type { WorkflowTaskStage } from "./trigger-errors";

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

export type WorkflowLogEvent = {
  scope: "workflow.task";
  event: "task.start" | "task.success" | "task.failure";
  taskId: string;
  stage: WorkflowTaskStage;
  durationMs?: number;
  message?: string;
  errorTag?: string;
  itemId?: string;
  rating?: string;
  hasCursor?: boolean;
  watchKeywordCount?: number;
};

export type WorkflowTaskLogContext = Omit<
  WorkflowLogEvent,
  "scope" | "event" | "taskId" | "stage" | "durationMs" | "message" | "errorTag"
>;

export function workflowInfo(event: WorkflowLogEvent) {
  ensureLoggerInitialized();
  log.info(event);
}

export function workflowError(event: WorkflowLogEvent) {
  ensureLoggerInitialized();
  log.error(event);
}
