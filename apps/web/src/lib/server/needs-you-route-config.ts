import { WORKFLOW_TASK_IDS } from "@nyte/workflows";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { HTTP_STATUS } from "./http-status";
import { REQUEST_EVENTS } from "./request-events";

export const NEEDS_YOU_ROUTE_CONFIG = {
  queueSync: {
    route: NEEDS_YOU_API_ROUTES.sync,
    taskId: WORKFLOW_TASK_IDS.ingestSignals,
    events: REQUEST_EVENTS.queueSync,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.queueAuthRequired,
      tokenUnavailable: NEEDS_YOU_MESSAGES.queueTokenUnavailable,
      taskUnavailable: NEEDS_YOU_MESSAGES.syncUnavailable,
    },
    statuses: {
      unauthorized: HTTP_STATUS.unauthorized,
      tokenUnavailable: HTTP_STATUS.conflict,
    },
  },
  actionApprove: {
    route: NEEDS_YOU_API_ROUTES.approveAction,
    taskId: WORKFLOW_TASK_IDS.approveAction,
    events: REQUEST_EVENTS.actionApprove,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidApprovePayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.approveUnavailable,
    },
    statuses: {
      unauthorized: HTTP_STATUS.unauthorized,
      invalidPayload: HTTP_STATUS.badRequest,
    },
  },
  actionDismiss: {
    route: NEEDS_YOU_API_ROUTES.dismissAction,
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    events: REQUEST_EVENTS.actionDismiss,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidDismissPayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.dismissUnavailable,
    },
    statuses: {
      unauthorized: HTTP_STATUS.unauthorized,
      invalidPayload: HTTP_STATUS.badRequest,
    },
  },
  actionFeedback: {
    route: NEEDS_YOU_API_ROUTES.feedbackAction,
    taskId: WORKFLOW_TASK_IDS.feedback,
    events: REQUEST_EVENTS.actionFeedback,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidFeedbackPayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.feedbackUnavailable,
    },
    statuses: {
      unauthorized: HTTP_STATUS.unauthorized,
      invalidPayload: HTTP_STATUS.badRequest,
    },
  },
} as const;
