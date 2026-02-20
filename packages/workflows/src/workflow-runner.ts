import type {
  ApproveActionResponse,
  DismissActionResponse,
  FeedbackActionResponse,
  QueueSyncResponse,
} from "./contracts";
import { WORKFLOW_TASK_IDS, type WorkflowTaskId } from "./task-ids";
import {
  approveActionTask,
  type ApproveActionTaskInput,
} from "./tasks/approve-action-task";
import {
  dismissActionTask,
  type DismissActionTaskInput,
} from "./tasks/dismiss-action-task";
import { feedbackTask, type FeedbackTaskInput } from "./tasks/feedback-task";
import {
  ingestSignalsTask,
  type IngestSignalsTaskInput,
} from "./tasks/ingest-signals-task";
import {
  createWorkflowTaskExecutionError,
  isWorkflowTaskError,
  type WorkflowTaskError,
} from "./workflow-errors";
import {
  createWorkflowTaskLogger,
  type WorkflowTaskLogContext,
} from "./workflow-log";

function toErrorMessage(value: unknown): string {
  if (typeof value === "string") {
    const message = value.trim();
    return message.length > 0 ? message : "Workflow task failed.";
  }

  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  ) {
    const message = (value as { message: string }).message.trim();
    if (message.length > 0) {
      return message;
    }
  }

  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized === "string" && serialized.trim().length > 0) {
      return serialized;
    }
  } catch {}

  return "Workflow task failed.";
}

function toErrorName(value: unknown): string {
  if (value instanceof Error && value.name.trim().length > 0) {
    return value.name;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  ) {
    const name = (value as { name: string }).name.trim();
    if (name.length > 0) {
      return name;
    }
  }

  return "UnknownError";
}

function toErrorStack(value: unknown): string | undefined {
  if (value instanceof Error && typeof value.stack === "string") {
    const stack = value.stack.trim();
    return stack.length > 0 ? stack : undefined;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "stack" in value &&
    typeof (value as { stack: unknown }).stack === "string"
  ) {
    const stack = (value as { stack: string }).stack.trim();
    return stack.length > 0 ? stack : undefined;
  }

  return undefined;
}

function toWorkflowTaskError({
  taskId,
  error,
}: {
  taskId: WorkflowTaskId;
  error: unknown;
}): WorkflowTaskError {
  if (isWorkflowTaskError(error)) {
    return error;
  }

  return createWorkflowTaskExecutionError({
    taskId,
    message: toErrorMessage(error),
    cause: error,
  });
}

async function runTask<TOutput>({
  taskId,
  localRun,
  logContext,
}: {
  taskId: WorkflowTaskId;
  localRun: () => Promise<TOutput>;
  logContext?: WorkflowTaskLogContext;
}) {
  const startedAt = Date.now();
  const taskLogger = createWorkflowTaskLogger({
    taskId,
    ...logContext,
  });

  try {
    try {
      const output = await localRun();
      taskLogger.success(Date.now() - startedAt);
      return output;
    } catch (error) {
      throw createWorkflowTaskExecutionError({
        taskId,
        message: toErrorMessage(error),
        cause: error,
      });
    }
  } catch (error) {
    const workflowTaskError = toWorkflowTaskError({
      taskId,
      error,
    });

    taskLogger.failure({
      durationMs: Date.now() - startedAt,
      message: workflowTaskError.message,
      errorTag: toErrorName(workflowTaskError),
      errorStack: toErrorStack(workflowTaskError),
      causeMessage: toErrorMessage(workflowTaskError.workflowCause),
      causeStack: toErrorStack(workflowTaskError.workflowCause),
    });

    throw workflowTaskError;
  }
}

type WorkflowIngestSignalsInput = Omit<IngestSignalsTaskInput, "now">;
type WorkflowApproveActionInput = Omit<ApproveActionTaskInput, "now">;
type WorkflowDismissActionInput = Omit<DismissActionTaskInput, "now">;
type WorkflowFeedbackInput = Omit<FeedbackTaskInput, "now">;

export async function runIngestSignalsTask(
  input: WorkflowIngestSignalsInput
): Promise<QueueSyncResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.ingestSignals,
    localRun: () => ingestSignalsTask(input),
    logContext: {
      hasCursor: Boolean(input.cursor),
      watchKeywordCount: input.watchKeywords?.length ?? 0,
    },
  });
}

export async function runApproveActionTask(
  input: WorkflowApproveActionInput
): Promise<ApproveActionResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.approveAction,
    localRun: () => approveActionTask(input),
    logContext: {
      itemId: input.itemId,
    },
  });
}

export async function runDismissActionTask(
  input: WorkflowDismissActionInput
): Promise<DismissActionResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    localRun: () => dismissActionTask(input),
    logContext: {
      itemId: input.itemId,
    },
  });
}

export async function runFeedbackTask(
  input: WorkflowFeedbackInput
): Promise<FeedbackActionResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.feedback,
    localRun: () => feedbackTask(input),
    logContext: {
      itemId: input.itemId,
      rating: input.rating,
    },
  });
}
