import { tasks } from "@trigger.dev/sdk/v3";

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
  createWorkflowTaskResultError,
  isWorkflowTaskError,
  type WorkflowTaskError,
  type WorkflowTaskStage,
} from "./trigger-errors";
import {
  triggerApproveActionTask,
  triggerDismissActionTask,
  triggerFeedbackTask,
  triggerIngestSignalsTask,
} from "./trigger-tasks";
import {
  createWorkflowTaskLogger,
  type WorkflowTaskLogContext,
} from "./workflow-log";

function isTriggerEnabled() {
  return Boolean(process.env.TRIGGER_SECRET_KEY?.trim());
}

function resolveTaskStage(): WorkflowTaskStage {
  return isTriggerEnabled() ? "trigger" : "local";
}

function toErrorMessage(value: unknown): string {
  if (typeof value === "string") {
    const message = value.trim();
    return message.length > 0 ? message : "Trigger.dev task failed.";
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

  return "Trigger.dev task failed.";
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

type TriggerTaskRunResult<TOutput> =
  | {
      ok: true;
      output: TOutput;
    }
  | {
      ok: false;
      error: unknown;
    };

function toWorkflowTaskError({
  taskId,
  stage,
  error,
}: {
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
  error: unknown;
}): WorkflowTaskError {
  if (isWorkflowTaskError(error)) {
    return error;
  }

  return createWorkflowTaskExecutionError({
    taskId,
    stage,
    message: toErrorMessage(error),
    cause: error,
  });
}

async function runTask<TOutput>({
  taskId,
  localRun,
  triggerRun,
  logContext,
}: {
  taskId: WorkflowTaskId;
  localRun: () => Promise<TOutput>;
  triggerRun: () => Promise<TriggerTaskRunResult<TOutput>>;
  logContext?: WorkflowTaskLogContext;
}) {
  const stage = resolveTaskStage();
  const startedAt = Date.now();
  const taskLogger = createWorkflowTaskLogger({
    taskId,
    stage,
    ...logContext,
  });

  try {
    if (stage === "local") {
      try {
        const output = await localRun();
        taskLogger.success(Date.now() - startedAt);
        return output;
      } catch (error) {
        throw createWorkflowTaskExecutionError({
          taskId,
          stage,
          message: toErrorMessage(error),
          cause: error,
        });
      }
    }

    let result: TriggerTaskRunResult<TOutput>;

    try {
      result = await triggerRun();
    } catch (error) {
      throw createWorkflowTaskExecutionError({
        taskId,
        stage,
        message: toErrorMessage(error),
        cause: error,
      });
    }

    if (!result.ok) {
      throw createWorkflowTaskResultError({
        taskId,
        stage,
        message: toErrorMessage(result.error),
        cause: result.error,
      });
    }

    taskLogger.success(Date.now() - startedAt);
    return result.output;
  } catch (error) {
    const workflowTaskError = toWorkflowTaskError({
      taskId,
      stage,
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

type TriggerableIngestSignalsInput = Omit<IngestSignalsTaskInput, "now">;
type TriggerableApproveActionInput = Omit<ApproveActionTaskInput, "now">;
type TriggerableDismissActionInput = Omit<DismissActionTaskInput, "now">;
type TriggerableFeedbackInput = Omit<FeedbackTaskInput, "now">;

export async function runIngestSignalsTask(
  input: TriggerableIngestSignalsInput
): Promise<QueueSyncResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.ingestSignals,
    localRun: () => ingestSignalsTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerIngestSignalsTask>(
        WORKFLOW_TASK_IDS.ingestSignals,
        input
      ),
    logContext: {
      hasCursor: Boolean(input.cursor),
      watchKeywordCount: input.watchKeywords?.length ?? 0,
    },
  });
}

export async function runApproveActionTask(
  input: TriggerableApproveActionInput
): Promise<ApproveActionResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.approveAction,
    localRun: () => approveActionTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerApproveActionTask>(
        WORKFLOW_TASK_IDS.approveAction,
        input
      ),
    logContext: {
      itemId: input.itemId,
    },
  });
}

export async function runDismissActionTask(
  input: TriggerableDismissActionInput
): Promise<DismissActionResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    localRun: () => dismissActionTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerDismissActionTask>(
        WORKFLOW_TASK_IDS.dismissAction,
        input
      ),
    logContext: {
      itemId: input.itemId,
    },
  });
}

export async function runFeedbackTask(
  input: TriggerableFeedbackInput
): Promise<FeedbackActionResponse> {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.feedback,
    localRun: () => feedbackTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerFeedbackTask>(
        WORKFLOW_TASK_IDS.feedback,
        input
      ),
    logContext: {
      itemId: input.itemId,
      rating: input.rating,
    },
  });
}
