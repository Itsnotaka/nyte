import { WORKFLOW_TASK_IDS, type WorkflowTaskId } from "@nyte/workflows";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { NEEDS_YOU_API_ROUTES } from "~/lib/needs-you/routes";
import { HTTP_STATUS, type HttpStatusCode } from "./http-status";
import { REQUEST_EVENTS } from "./request-events";

export type NeedsYouRoutePath = (typeof NEEDS_YOU_API_ROUTES)[keyof typeof NEEDS_YOU_API_ROUTES];
export type NeedsYouRouteMethod = "GET" | "POST";

type BaseNeedsYouRouteConfig = {
  route: NeedsYouRoutePath;
  method: NeedsYouRouteMethod;
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
    taskFailure: HttpStatusCode;
  };
};

export type ActionRouteStatuses = {
  ok: HttpStatusCode;
  unauthorized: HttpStatusCode;
  invalidPayload: HttpStatusCode;
  taskFailure: HttpStatusCode;
  notFound: HttpStatusCode;
  conflict: HttpStatusCode;
  domainInvalidPayload: HttpStatusCode;
};
export type DomainErrorStatuses = Pick<
  ActionRouteStatuses,
  "notFound" | "conflict" | "domainInvalidPayload"
>;

type ActionRouteConfig<TEvents extends Record<string, string>> = BaseNeedsYouRouteConfig & {
  events: TEvents;
  messages: {
    authRequired: string;
    invalidPayload: string;
    taskUnavailable: string;
  };
  statuses: ActionRouteStatuses;
};

const ACTION_ROUTE_STATUSES = {
  ok: HTTP_STATUS.ok,
  unauthorized: HTTP_STATUS.unauthorized,
  invalidPayload: HTTP_STATUS.badRequest,
  taskFailure: HTTP_STATUS.badGateway,
  notFound: HTTP_STATUS.notFound,
  conflict: HTTP_STATUS.conflict,
  domainInvalidPayload: HTTP_STATUS.unprocessableEntity,
} as const satisfies ActionRouteStatuses;
const ACTION_ROUTE_METHOD: NeedsYouRouteMethod = "POST";

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
      taskFailure: HTTP_STATUS.badGateway,
    },
  },
  actionApprove: {
    route: NEEDS_YOU_API_ROUTES.approveAction,
    method: ACTION_ROUTE_METHOD,
    taskId: WORKFLOW_TASK_IDS.approveAction,
    events: REQUEST_EVENTS.actionApprove,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidApprovePayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.approveUnavailable,
    },
    statuses: ACTION_ROUTE_STATUSES,
  },
  actionDismiss: {
    route: NEEDS_YOU_API_ROUTES.dismissAction,
    method: ACTION_ROUTE_METHOD,
    taskId: WORKFLOW_TASK_IDS.dismissAction,
    events: REQUEST_EVENTS.actionDismiss,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidDismissPayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.dismissUnavailable,
    },
    statuses: ACTION_ROUTE_STATUSES,
  },
  actionFeedback: {
    route: NEEDS_YOU_API_ROUTES.feedbackAction,
    method: ACTION_ROUTE_METHOD,
    taskId: WORKFLOW_TASK_IDS.feedback,
    events: REQUEST_EVENTS.actionFeedback,
    messages: {
      authRequired: NEEDS_YOU_MESSAGES.actionAuthRequired,
      invalidPayload: NEEDS_YOU_MESSAGES.invalidFeedbackPayload,
      taskUnavailable: NEEDS_YOU_MESSAGES.feedbackUnavailable,
    },
    statuses: ACTION_ROUTE_STATUSES,
  },
} as const satisfies {
  queueSync: QueueSyncRouteConfig;
  actionApprove: ActionRouteConfig<typeof REQUEST_EVENTS.actionApprove>;
  actionDismiss: ActionRouteConfig<typeof REQUEST_EVENTS.actionDismiss>;
  actionFeedback: ActionRouteConfig<typeof REQUEST_EVENTS.actionFeedback>;
};
