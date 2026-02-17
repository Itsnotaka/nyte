import { WORKFLOW_TASK_IDS } from "@nyte/workflows";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { REQUEST_EVENTS } from "./request-events";

export const NEEDS_YOU_ROUTE_CONFIG = {
  queueSync: {
    route: NEEDS_YOU_API_ROUTES.sync,
    taskId: WORKFLOW_TASK_IDS.ingestSignals,
    events: REQUEST_EVENTS.queueSync,
  },
  actionApprove: {
    route: NEEDS_YOU_API_ROUTES.approveAction,
    taskId: WORKFLOW_TASK_IDS.approveAction,
    events: REQUEST_EVENTS.actionApprove,
  },
  actionDismiss: {
    route: NEEDS_YOU_API_ROUTES.dismissAction,
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    events: REQUEST_EVENTS.actionDismiss,
  },
  actionFeedback: {
    route: NEEDS_YOU_API_ROUTES.feedbackAction,
    taskId: WORKFLOW_TASK_IDS.feedback,
    events: REQUEST_EVENTS.actionFeedback,
  },
} as const;
