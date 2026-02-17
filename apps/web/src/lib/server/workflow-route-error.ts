import {
  WorkflowTaskExecutionError,
  type WorkflowTaskId,
  WorkflowTaskResultError,
  type WorkflowApiErrorResponse,
  type WorkflowTaskStage,
} from "@nyte/workflows";
import { HTTP_STATUS, type HttpStatusCode } from "./http-status";

type WorkflowRouteErrorResolution = {
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
): WorkflowRouteErrorResolution {
  if (error instanceof WorkflowTaskExecutionError || error instanceof WorkflowTaskResultError) {
    return {
      status: HTTP_STATUS.badGateway,
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
    error instanceof Error && error.message.trim().length > 0 ? error.message : fallbackMessage;

  return {
    status: HTTP_STATUS.badGateway,
    response: {
      error: message,
    },
    logData: {
      message,
    },
  };
}

export function resolveWorkflowDomainStatus(message: string): 404 | 409 {
  return message.toLowerCase().includes("not found")
    ? HTTP_STATUS.notFound
    : HTTP_STATUS.conflict;
}

export function toWorkflowApiErrorResponse(error: string): WorkflowApiErrorResponse {
  return { error };
}

export function toWorkflowApiErrorJsonResponse(error: string, status: HttpStatusCode) {
  return Response.json(toWorkflowApiErrorResponse(error), { status });
}
