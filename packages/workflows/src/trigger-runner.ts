import { Effect } from "effect";
import { tasks } from "@trigger.dev/sdk/v3";

import {
  triggerApproveActionTask,
  triggerDismissActionTask,
  triggerFeedbackTask,
  triggerIngestSignalsTask,
} from "./trigger-tasks";
import { approveActionTask, type ApproveActionTaskInput } from "./tasks/approve-action-task";
import { dismissActionTask, type DismissActionTaskInput } from "./tasks/dismiss-action-task";
import { feedbackTask, type FeedbackTaskInput } from "./tasks/feedback-task";
import { ingestSignalsTask, type IngestSignalsTaskInput } from "./tasks/ingest-signals-task";
import {
  WorkflowTaskExecutionError,
  WorkflowTaskResultError,
  type WorkflowTaskError,
  type WorkflowTaskStage,
} from "./trigger-errors";
import { WORKFLOW_TASK_IDS, type WorkflowTaskId } from "./task-ids";
import {
  workflowError,
  workflowInfo,
  WORKFLOW_TASK_EVENTS,
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

  return "Trigger.dev task failed.";
}

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
  triggerRun: () => Promise<
    | {
        ok: true;
        output: TOutput;
      }
    | {
        ok: false;
        error: unknown;
      }
  >;
  logContext?: WorkflowTaskLogContext;
}) {
  const startedAt = Date.now();

  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      workflowInfo({
        scope: "workflow.task",
        event: WORKFLOW_TASK_EVENTS.start,
        taskId,
        stage,
        ...logContext,
      }),
    );

    if (stage === "local") {
      const output = yield* Effect.tryPromise({
        try: () => localRun(),
        catch: (cause) =>
          new WorkflowTaskExecutionError({
            taskId,
            stage,
            message: toErrorMessage(cause),
            cause,
          }),
      });

      yield* Effect.sync(() =>
        workflowInfo({
          scope: "workflow.task",
          event: WORKFLOW_TASK_EVENTS.success,
          taskId,
          stage,
          durationMs: Date.now() - startedAt,
          ...logContext,
        }),
      );

      return output;
    }

    const result = yield* Effect.tryPromise({
      try: () => triggerRun(),
      catch: (cause) =>
        new WorkflowTaskExecutionError({
          taskId,
          stage,
          message: toErrorMessage(cause),
          cause,
        }),
    });

    if (!result.ok) {
      return yield* Effect.fail(
        new WorkflowTaskResultError({
          taskId,
          stage,
          message: toErrorMessage(result.error),
          cause: result.error,
        }),
      );
    }

    yield* Effect.sync(() =>
      workflowInfo({
        scope: "workflow.task",
        event: WORKFLOW_TASK_EVENTS.success,
        taskId,
        stage,
        durationMs: Date.now() - startedAt,
        ...logContext,
      }),
    );

    return result.output;
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() =>
        workflowError({
          scope: "workflow.task",
          event: WORKFLOW_TASK_EVENTS.failure,
          taskId,
          stage,
          durationMs: Date.now() - startedAt,
          errorTag: error._tag,
          message: error.message,
          ...logContext,
        }),
      ),
    ),
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
  triggerRun: () => Promise<
    | {
        ok: true;
        output: TOutput;
      }
    | {
        ok: false;
        error: unknown;
      }
  >;
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
    }),
  ).catch((error: unknown) => {
    if (error instanceof WorkflowTaskExecutionError || error instanceof WorkflowTaskResultError) {
      throw error;
    }

    const workflowTaskError: WorkflowTaskError = new WorkflowTaskExecutionError({
      taskId,
      stage,
      message: toErrorMessage(error),
      cause: error,
    });
    throw workflowTaskError;
  });
}

type TriggerableIngestSignalsInput = Omit<IngestSignalsTaskInput, "now">;
type TriggerableApproveActionInput = Omit<ApproveActionTaskInput, "now">;
type TriggerableDismissActionInput = Omit<DismissActionTaskInput, "now">;
type TriggerableFeedbackInput = Omit<FeedbackTaskInput, "now">;

export async function runIngestSignalsTask(input: TriggerableIngestSignalsInput) {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.ingestSignals,
    localRun: () => ingestSignalsTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerIngestSignalsTask>(
        WORKFLOW_TASK_IDS.ingestSignals,
        input,
      ),
    logContext: {
      hasCursor: Boolean(input.cursor),
      watchKeywordCount: input.watchKeywords?.length ?? 0,
    },
  });
}

export async function runApproveActionTask(input: TriggerableApproveActionInput) {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.approveAction,
    localRun: () => approveActionTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerApproveActionTask>(WORKFLOW_TASK_IDS.approveAction, input),
    logContext: {
      itemId: input.itemId,
    },
  });
}

export async function runDismissActionTask(input: TriggerableDismissActionInput) {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    localRun: () => dismissActionTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerDismissActionTask>(WORKFLOW_TASK_IDS.dismissAction, input),
    logContext: {
      itemId: input.itemId,
    },
  });
}

export async function runFeedbackTask(input: TriggerableFeedbackInput) {
  return runTask({
    taskId: WORKFLOW_TASK_IDS.feedback,
    localRun: () => feedbackTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerFeedbackTask>(WORKFLOW_TASK_IDS.feedback, input),
    logContext: {
      itemId: input.itemId,
      rating: input.rating,
    },
  });
}
