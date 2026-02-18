import { createRequestLogger, initLogger, type RequestLogger } from "evlog";

import type { WorkflowTaskId } from "./task-ids";
import type { FeedbackTaskInput } from "./tasks/feedback-task";
import type { WorkflowTaskStage } from "./trigger-errors";

export const WORKFLOW_TASK_EVENTS = {
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
  durationMs: number;
  message?: string;
  errorTag?: string;
  errorStack?: string;
  causeMessage?: string;
  causeStack?: string;
  itemId?: string;
  rating?: FeedbackTaskInput["rating"];
  hasCursor?: boolean;
  watchKeywordCount?: number;
};

export type WorkflowTaskLogContext = Omit<
  WorkflowLogEvent,
  | "scope"
  | "event"
  | "taskId"
  | "stage"
  | "durationMs"
  | "message"
  | "errorTag"
  | "errorStack"
  | "causeMessage"
  | "causeStack"
>;

type WorkflowTaskLoggerInput = {
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
} & WorkflowTaskLogContext;

type WorkflowTaskLogger = {
  success: (durationMs: number) => void;
  failure: (input: {
    durationMs: number;
    message: string;
    errorTag: string;
    errorStack?: string;
    causeMessage?: string;
    causeStack?: string;
  }) => void;
};

function createWorkflowLogger(
  context: WorkflowTaskLoggerInput
): RequestLogger<WorkflowLogEvent> {
  ensureLoggerInitialized();
  const logger = createRequestLogger<WorkflowLogEvent>({
    method: "TASK",
    path: `/workflow/${context.taskId}`,
  });
  logger.set({
    scope: "workflow.task",
    ...context,
  });

  return logger;
}

export function createWorkflowTaskLogger(
  context: WorkflowTaskLoggerInput
): WorkflowTaskLogger {
  const logger = createWorkflowLogger(context);

  return {
    success(durationMs) {
      logger.emit({
        event: WORKFLOW_TASK_EVENTS.success,
        durationMs,
      });
    },

    failure({
      durationMs,
      message,
      errorTag,
      errorStack,
      causeMessage,
      causeStack,
    }) {
      logger.error(message, {
        event: WORKFLOW_TASK_EVENTS.failure,
        durationMs,
        message,
        errorTag,
        errorStack,
        causeMessage,
        causeStack,
      });
      logger.emit({
        event: WORKFLOW_TASK_EVENTS.failure,
        durationMs,
        message,
        errorTag,
        errorStack,
        causeMessage,
        causeStack,
        _forceKeep: true,
      });
    },
  };
}
