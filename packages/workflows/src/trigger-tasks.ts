import { task } from "@trigger.dev/sdk/v3";

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

export const triggerIngestSignalsTask = task({
  id: "workflow.ingest-signals",
  run: async (payload: TriggerIngestSignalsInput) => ingestSignalsTask(payload),
});

export const triggerApproveActionTask = task({
  id: "workflow.approve-action",
  run: async (payload: TriggerApproveActionInput) => approveActionTask(payload),
});

export const triggerDismissActionTask = task({
  id: "workflow.dismiss-action",
  run: async (payload: TriggerDismissActionInput) => dismissActionTask(payload),
});

export const triggerFeedbackTask = task({
  id: "workflow.feedback",
  run: async (payload: TriggerFeedbackInput) => feedbackTask(payload),
});
