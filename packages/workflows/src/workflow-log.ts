import { initLogger, log } from "evlog";
import type { WorkflowTaskStage } from "./trigger-errors";
import type { WorkflowTaskId } from "./task-ids";
import type { FeedbackTaskInput } from "./tasks/feedback-task";

export const WORKFLOW_TASK_EVENTS = {
  start: "task.start",
  success: "task.success",
  failure: "task.failure",
} as const;

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
  event: (typeof WORKFLOW_TASK_EVENTS)[keyof typeof WORKFLOW_TASK_EVENTS];
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
  durationMs?: number;
  message?: string;
  errorTag?: string;
  itemId?: string;
  rating?: FeedbackTaskInput["rating"];
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
