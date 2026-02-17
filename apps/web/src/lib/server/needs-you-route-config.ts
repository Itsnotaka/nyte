import { WORKFLOW_TASK_IDS, type WorkflowTaskId } from "@nyte/workflows";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { HTTP_STATUS, type HttpStatusCode } from "./http-status";
import { REQUEST_EVENTS } from "./request-events";

type NeedsYouRoutePath = (typeof NEEDS_YOU_API_ROUTES)[keyof typeof NEEDS_YOU_API_ROUTES];

type BaseNeedsYouRouteConfig = {
  route: NeedsYouRoutePath;
  method: "GET" | "POST";
  taskId: WorkflowTaskId;
};

type QueueSyncRouteConfig = BaseNeedsYouRouteConfig & {
  events: typeof REQUEST_EVENTS.queueSync;
  messages: {
    authRequired: string;
    tokenUnavailable: string;
    taskUnavailable: string;
  };
  statuses: {
    ok: HttpStatusCode;
    unauthorized: HttpStatusCode;
    tokenUnavailable: HttpStatusCode;
  };
};

type ActionRouteConfig<TEvents extends Record<string, string>> = BaseNeedsYouRouteConfig & {
  events: TEvents;
  messages: {
    authRequired: string;
    invalidPayload: string;
    taskUnavailable: string;
  };
  statuses: {
    ok: HttpStatusCode;
    unauthorized: HttpStatusCode;
    invalidPayload: HttpStatusCode;
  };
};

export const NEEDS_YOU_ROUTE_CONFIG = {
  queueSync: {
    route: NEEDS_YOU_API_ROUTES.sync,
    method: "GET",
    taskId: WORKFLOW_TASK_IDS.ingestSignals,
    events: REQUEST_EVENTS.queueSync,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.queueAuthRequired,
      tokenUnavailable: NEEDS_YOU_MESSAGES.queueTokenUnavailable,
      taskUnavailable: NEEDS_YOU_MESSAGES.syncUnavailable,
    },
    statuses: {
      ok: HTTP_STATUS.ok,
      unauthorized: HTTP_STATUS.unauthorized,
      tokenUnavailable: HTTP_STATUS.conflict,
    },
  },
  actionApprove: {
    route: NEEDS_YOU_API_ROUTES.approveAction,
    method: "POST",
    taskId: WORKFLOW_TASK_IDS.approveAction,
    events: REQUEST_EVENTS.actionApprove,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidApprovePayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.approveUnavailable,
    },
    statuses: {
      ok: HTTP_STATUS.ok,
      unauthorized: HTTP_STATUS.unauthorized,
      invalidPayload: HTTP_STATUS.badRequest,
    },
  },
  actionDismiss: {
    route: NEEDS_YOU_API_ROUTES.dismissAction,
    method: "POST",
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    events: REQUEST_EVENTS.actionDismiss,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidDismissPayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.dismissUnavailable,
    },
    statuses: {
      ok: HTTP_STATUS.ok,
      unauthorized: HTTP_STATUS.unauthorized,
      invalidPayload: HTTP_STATUS.badRequest,
    },
  },
  actionFeedback: {
    route: NEEDS_YOU_API_ROUTES.feedbackAction,
    method: "POST",
    taskId: WORKFLOW_TASK_IDS.feedback,
    events: REQUEST_EVENTS.actionFeedback,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidFeedbackPayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.feedbackUnavailable,
    },
    statuses: {
      ok: HTTP_STATUS.ok,
      unauthorized: HTTP_STATUS.unauthorized,
      invalidPayload: HTTP_STATUS.badRequest,
    },
  },
} as const satisfies {
  queueSync: QueueSyncRouteConfig;
  actionApprove: ActionRouteConfig<typeof REQUEST_EVENTS.actionApprove>;
  actionDismiss: ActionRouteConfig<typeof REQUEST_EVENTS.actionDismiss>;
  actionFeedback: ActionRouteConfig<typeof REQUEST_EVENTS.actionFeedback>;
};
