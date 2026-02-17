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

type TriggerableIngestSignalsInput = Omit<IngestSignalsTaskInput, "now">;
type TriggerableApproveActionInput = Omit<ApproveActionTaskInput, "now">;
type TriggerableDismissActionInput = Omit<DismissActionTaskInput, "now">;
type TriggerableFeedbackInput = Omit<FeedbackTaskInput, "now">;

export async function runIngestSignalsTask(input: TriggerableIngestSignalsInput) {
  if (!isTriggerEnabled()) {
    return ingestSignalsTask(input);
  }

  const result = await tasks.triggerAndWait<typeof triggerIngestSignalsTask>(
    triggerIngestSignalsTask.id,
    input,
  );
  if (!result.ok) {
    throw toTaskError(result.error);
  }

  return result.output;
}

export async function runApproveActionTask(input: TriggerableApproveActionInput) {
  if (!isTriggerEnabled()) {
    return approveActionTask(input);
  }

  const result = await tasks.triggerAndWait<typeof triggerApproveActionTask>(
    triggerApproveActionTask.id,
    input,
  );
  if (!result.ok) {
    throw toTaskError(result.error);
  }

  return result.output;
}

export async function runDismissActionTask(input: TriggerableDismissActionInput) {
  if (!isTriggerEnabled()) {
    return dismissActionTask(input);
  }

  const result = await tasks.triggerAndWait<typeof triggerDismissActionTask>(
    triggerDismissActionTask.id,
    input,
  );
  if (!result.ok) {
    throw toTaskError(result.error);
  }

  return result.output;
}

export async function runFeedbackTask(input: TriggerableFeedbackInput) {
  if (!isTriggerEnabled()) {
    return feedbackTask(input);
  }

  const result = await tasks.triggerAndWait<typeof triggerFeedbackTask>(triggerFeedbackTask.id, input);
  if (!result.ok) {
    throw toTaskError(result.error);
  }

  return result.output;
}
