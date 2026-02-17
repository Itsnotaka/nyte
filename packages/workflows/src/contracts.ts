import type { WorkItemWithAction } from "@nyte/domain/actions";

import type { approveActionTask } from "./tasks/approve-action-task";
import type { dismissActionTask } from "./tasks/dismiss-action-task";
import type { feedbackTask } from "./tasks/feedback-task";
import type { ingestSignalsTask } from "./tasks/ingest-signals-task";

type TaskInput<TTask extends (...args: never[]) => unknown> = Parameters<TTask>[0];
type TaskOutput<TTask extends (...args: never[]) => unknown> = Awaited<ReturnType<TTask>>;

export type QueueSyncRequest = Omit<TaskInput<typeof ingestSignalsTask>, "accessToken" | "now">;
export type QueueSyncResponse = Pick<TaskOutput<typeof ingestSignalsTask>, "cursor" | "needsYou">;

export type ApproveActionRequest = Omit<TaskInput<typeof approveActionTask>, "now">;
export type ApproveActionResponse = TaskOutput<typeof approveActionTask>;

export type DismissActionRequest = Omit<TaskInput<typeof dismissActionTask>, "now">;
export type DismissActionResponse = TaskOutput<typeof dismissActionTask>;

export type FeedbackActionRequest = Omit<TaskInput<typeof feedbackTask>, "now">;
export type FeedbackActionResponse = TaskOutput<typeof feedbackTask>;

export type QueueActionStatus = "approved" | "dismissed";
export type QueueActionItem = WorkItemWithAction;
export type QueueFeedbackRating = FeedbackActionRequest["rating"];

export type WorkflowApiErrorResponse = {
  error: string;
};
