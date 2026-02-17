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

function isTriggerEnabled() {
  return Boolean(process.env.TRIGGER_SECRET_KEY?.trim());
}

function toTaskError(value: unknown) {
  if (value instanceof Error && value.message.trim().length > 0) {
    return value;
  }

  return new Error("Trigger.dev task failed.");
}

function runTaskProgram<TOutput>({
  localRun,
  triggerRun,
}: {
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
  return Effect.gen(function* () {
    if (!isTriggerEnabled()) {
      return yield* Effect.tryPromise({
        try: () => localRun(),
        catch: toTaskError,
      });
    }

    const result = yield* Effect.tryPromise({
      try: () => triggerRun(),
      catch: toTaskError,
    });
    if (!result.ok) {
      return yield* Effect.fail(toTaskError(result.error));
    }

    return result.output;
  });
}

type TriggerableIngestSignalsInput = Omit<IngestSignalsTaskInput, "now">;
type TriggerableApproveActionInput = Omit<ApproveActionTaskInput, "now">;
type TriggerableDismissActionInput = Omit<DismissActionTaskInput, "now">;
type TriggerableFeedbackInput = Omit<FeedbackTaskInput, "now">;

export async function runIngestSignalsTask(input: TriggerableIngestSignalsInput) {
  return Effect.runPromise(
    runTaskProgram({
      localRun: () => ingestSignalsTask(input),
      triggerRun: () =>
        tasks.triggerAndWait<typeof triggerIngestSignalsTask>(triggerIngestSignalsTask.id, input),
    }),
  );
}

export async function runApproveActionTask(input: TriggerableApproveActionInput) {
  return Effect.runPromise(
    runTaskProgram({
      localRun: () => approveActionTask(input),
      triggerRun: () =>
        tasks.triggerAndWait<typeof triggerApproveActionTask>(triggerApproveActionTask.id, input),
    }),
  );
}

export async function runDismissActionTask(input: TriggerableDismissActionInput) {
  return Effect.runPromise(
    runTaskProgram({
      localRun: () => dismissActionTask(input),
      triggerRun: () =>
        tasks.triggerAndWait<typeof triggerDismissActionTask>(triggerDismissActionTask.id, input),
    }),
  );
}

export async function runFeedbackTask(input: TriggerableFeedbackInput) {
  return Effect.runPromise(
    runTaskProgram({
      localRun: () => feedbackTask(input),
      triggerRun: () =>
        tasks.triggerAndWait<typeof triggerFeedbackTask>(triggerFeedbackTask.id, input),
    }),
  );
}
