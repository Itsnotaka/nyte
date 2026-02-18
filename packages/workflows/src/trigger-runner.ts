import { tasks } from "@trigger.dev/sdk/v3";
import { Effect } from "effect";

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

function toErrorMessage(value: unknown) {
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

  return "Trigger.dev task failed.";
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

function runTaskProgram<TOutput>({
  taskId,
  stage,
  localRun,
  triggerRun,
  logContext,
}: {
  taskId: WorkflowTaskId;
  stage: WorkflowTaskStage;
  localRun: () => Promise<TOutput>;
  triggerRun: () => Promise<TriggerTaskRunResult<TOutput>>;
  logContext?: WorkflowTaskLogContext;
}) {
  const startedAt = Date.now();
  const taskLogger = createWorkflowTaskLogger({
    taskId,
    stage,
    ...logContext,
  });

  return Effect.gen(function* () {
    if (stage === "local") {
      const output = yield* Effect.tryPromise({
        try: () => localRun(),
        catch: (cause) =>
          createWorkflowTaskExecutionError({
            taskId,
            stage,
            message: toErrorMessage(cause),
            cause,
          }),
      });

      yield* Effect.sync(() => taskLogger.success(Date.now() - startedAt));

      return output;
    }

    const result = yield* Effect.tryPromise({
      try: () => triggerRun(),
      catch: (cause) =>
        createWorkflowTaskExecutionError({
          taskId,
          stage,
          message: toErrorMessage(cause),
          cause,
        }),
    });

    if (!result.ok) {
      return yield* Effect.fail(
        createWorkflowTaskResultError({
          taskId,
          stage,
          message: toErrorMessage(result.error),
          cause: result.error,
        })
      );
    }

    yield* Effect.sync(() => taskLogger.success(Date.now() - startedAt));
    return result.output;
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() => {
        taskLogger.failure({
          durationMs: Date.now() - startedAt,
          errorTag: error._tag,
          message: error.message,
        });
      })
    )
  );
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
  return Effect.runPromise(
    runTaskProgram({
      taskId,
      stage,
      localRun,
      triggerRun,
      logContext,
    })
  ).catch((error: unknown) => {
    if (isWorkflowTaskError(error)) {
      throw error;
    }

    const workflowTaskError: WorkflowTaskError = createWorkflowTaskExecutionError(
      {
        taskId,
        stage,
        message: toErrorMessage(error),
        cause: error,
      }
    );
    throw workflowTaskError;
  });
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
