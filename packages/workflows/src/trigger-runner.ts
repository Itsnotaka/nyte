import { Effect } from "effect";
import { log } from "evlog";
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
} from "./trigger-errors";

function isTriggerEnabled() {
  return Boolean(process.env.TRIGGER_SECRET_KEY?.trim());
}

function toErrorMessage(value: unknown) {
  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }

  return "Trigger.dev task failed.";
}

function runTaskProgram<TOutput>({
  taskId,
  localRun,
  triggerRun,
}: {
  taskId: string;
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
}) {
  const startedAt = Date.now();
  const stage = isTriggerEnabled() ? "trigger" : "local";

  return Effect.gen(function* () {
    yield* Effect.sync(() =>
      log.info({
        scope: "workflow.task",
        event: "task.start",
        taskId,
        stage,
      }),
    );

    if (!isTriggerEnabled()) {
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
        log.info({
          scope: "workflow.task",
          event: "task.success",
          taskId,
          stage,
          durationMs: Date.now() - startedAt,
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
          message: toErrorMessage(result.error),
          cause: result.error,
        }),
      );
    }

    yield* Effect.sync(() =>
      log.info({
        scope: "workflow.task",
        event: "task.success",
        taskId,
        stage,
        durationMs: Date.now() - startedAt,
      }),
    );

    return result.output;
  }).pipe(
    Effect.tapError((error) =>
      Effect.sync(() =>
        log.error({
          scope: "workflow.task",
          event: "task.failure",
          taskId,
          stage,
          durationMs: Date.now() - startedAt,
          errorTag: error._tag,
          message: error.message,
        }),
      ),
    ),
  );
}

async function runTask<TOutput>({
  taskId,
  localRun,
  triggerRun,
}: {
  taskId: string;
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
}) {
  return Effect.runPromise(
    runTaskProgram({
      taskId,
      localRun,
      triggerRun,
    }),
  ).catch((error: unknown) => {
    if (error instanceof WorkflowTaskExecutionError || error instanceof WorkflowTaskResultError) {
      throw error;
    }

    const workflowTaskError: WorkflowTaskError = new WorkflowTaskExecutionError({
      taskId,
      stage: isTriggerEnabled() ? "trigger" : "local",
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
    taskId: triggerIngestSignalsTask.id,
    localRun: () => ingestSignalsTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerIngestSignalsTask>(triggerIngestSignalsTask.id, input),
  });
}

export async function runApproveActionTask(input: TriggerableApproveActionInput) {
  return runTask({
    taskId: triggerApproveActionTask.id,
    localRun: () => approveActionTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerApproveActionTask>(triggerApproveActionTask.id, input),
  });
}

export async function runDismissActionTask(input: TriggerableDismissActionInput) {
  return runTask({
    taskId: triggerDismissActionTask.id,
    localRun: () => dismissActionTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerDismissActionTask>(triggerDismissActionTask.id, input),
  });
}

export async function runFeedbackTask(input: TriggerableFeedbackInput) {
  return runTask({
    taskId: triggerFeedbackTask.id,
    localRun: () => feedbackTask(input),
    triggerRun: () =>
      tasks.triggerAndWait<typeof triggerFeedbackTask>(triggerFeedbackTask.id, input),
  });
}
