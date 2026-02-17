import { task } from "@trigger.dev/sdk/v3";

import { WORKFLOW_TASK_IDS } from "./task-ids";
import {
  type ApproveActionTaskInput,
  approveActionTask,
} from "./tasks/approve-action-task";
import { type DismissActionTaskInput, dismissActionTask } from "./tasks/dismiss-action-task";
import { type FeedbackTaskInput, feedbackTask } from "./tasks/feedback-task";
import { type IngestSignalsTaskInput, ingestSignalsTask } from "./tasks/ingest-signals-task";

type TriggerIngestSignalsInput = Omit<IngestSignalsTaskInput, "now">;
type TriggerApproveActionInput = Omit<ApproveActionTaskInput, "now">;
type TriggerDismissActionInput = Omit<DismissActionTaskInput, "now">;
type TriggerFeedbackInput = Omit<FeedbackTaskInput, "now">;

const TASK_RETRY_POLICY = {
  maxAttempts: 3,
  factor: 2,
  minTimeoutInMs: 1_000,
  maxTimeoutInMs: 10_000,
  randomize: true,
} as const;

export const triggerIngestSignalsTask = task({
  id: WORKFLOW_TASK_IDS.ingestSignals,
  retry: TASK_RETRY_POLICY,
  queue: {
    name: "queue-sync",
    concurrencyLimit: 1,
  },
  run: async (payload: TriggerIngestSignalsInput) => ingestSignalsTask(payload),
});

export const triggerApproveActionTask = task({
  id: WORKFLOW_TASK_IDS.approveAction,
  retry: TASK_RETRY_POLICY,
  queue: {
    name: "action-mutations",
    concurrencyLimit: 2,
  },
  run: async (payload: TriggerApproveActionInput) => approveActionTask(payload),
});

export const triggerDismissActionTask = task({
  id: WORKFLOW_TASK_IDS.dismissAction,
  retry: TASK_RETRY_POLICY,
  queue: {
    name: "action-mutations",
    concurrencyLimit: 2,
  },
  run: async (payload: TriggerDismissActionInput) => dismissActionTask(payload),
});

export const triggerFeedbackTask = task({
  id: WORKFLOW_TASK_IDS.feedback,
  retry: TASK_RETRY_POLICY,
  queue: {
    name: "feedback",
    concurrencyLimit: 4,
  },
  run: async (payload: TriggerFeedbackInput) => feedbackTask(payload),
});
