import type {
  ApprovalErrorCode,
  DismissErrorCode,
  FeedbackErrorCode,
} from "@nyte/application/actions";
import {
  WorkflowTaskExecutionError,
  type WorkflowTaskId,
  WorkflowTaskResultError,
  type WorkflowApiErrorResponse,
  type WorkflowTaskStage,
} from "@nyte/workflows";

import type { HttpStatusCode } from "./http-status";
import type { DomainErrorStatuses } from "./needs-you-route-config";

export type WorkflowRouteErrorResolution = {
  status: HttpStatusCode;
  response: WorkflowApiErrorResponse;
  logData: {
    message: string;
    taskId?: WorkflowTaskId;
    errorTag?: string;
    stage?: WorkflowTaskStage;
  };
};

export function resolveWorkflowRouteError(
  error: unknown,
  fallbackMessage: string,
  status: HttpStatusCode
): WorkflowRouteErrorResolution {
  if (
    error instanceof WorkflowTaskExecutionError ||
    error instanceof WorkflowTaskResultError
  ) {
    return {
      status,
      response: {
        error: error.message,
      },
      logData: {
        message: error.message,
        taskId: error.taskId,
        errorTag: error._tag,
        stage: error.stage,
      },
    };
  }

  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallbackMessage;

  return {
    status,
    response: {
      error: message,
    },
    logData: {
      message,
    },
  };
}

export function resolveWorkflowDomainStatus(
  errorCode: ApprovalErrorCode | DismissErrorCode | FeedbackErrorCode,
  statuses: DomainErrorStatuses
): HttpStatusCode {
  if (errorCode === "not_found") {
    return statuses.notFound;
  }

  if (errorCode === "invalid_payload") {
    return statuses.domainInvalidPayload;
  }

  return statuses.conflict;
}

export function toWorkflowApiErrorResponse(
  error: string
): WorkflowApiErrorResponse {
  return { error };
}

export function toWorkflowApiErrorJsonResponse(
  error: string,
  status: HttpStatusCode
) {
  return Response.json(toWorkflowApiErrorResponse(error), { status });
}

export function toWorkflowRouteErrorJsonResponse(
  resolution: WorkflowRouteErrorResolution
) {
  return Response.json(resolution.response, { status: resolution.status });
}

export function resolveWorkflowErrorTaskId(
  resolution: WorkflowRouteErrorResolution,
  fallbackTaskId: WorkflowTaskId
): WorkflowTaskId {
  return resolution.logData.taskId ?? fallbackTaskId;
}
