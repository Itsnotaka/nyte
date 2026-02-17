import {
  isApproveActionResponse,
  isDismissActionResponse,
  isFeedbackActionResponse,
  isWorkflowApiErrorResponse,
} from "@nyte/workflows";
import type {
  ApproveActionRequest,
  ApproveActionResponse,
  DismissActionRequest,
  DismissActionResponse,
  FeedbackActionRequest,
  FeedbackActionResponse,
} from "@nyte/workflows";

import { NEEDS_YOU_MESSAGES } from "./messages";
import { NEEDS_YOU_API_ROUTES } from "./routes";

const JSON_REQUEST_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
} as const;

async function readJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveWorkflowApiError(payload: unknown, fallback: string): string {
  if (isWorkflowApiErrorResponse(payload)) {
    return payload.error;
  }

  return fallback;
}

async function postAction<TRequest extends object, TResponse extends object>({
  route,
  body,
  fallbackError,
  isResponse,
}: {
  route: string;
  body: TRequest;
  fallbackError: string;
  isResponse: (payload: unknown) => payload is TResponse;
}): Promise<TResponse> {
  const response = await fetch(route, {
    method: "POST",
    headers: JSON_REQUEST_HEADERS,
    body: JSON.stringify(body),
  });

  const payload = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(resolveWorkflowApiError(payload, fallbackError));
  }

  if (!isResponse(payload)) {
    throw new Error(NEEDS_YOU_MESSAGES.invalidActionResponse);
  }

  return payload;
}

export async function approveNeedsYouAction(
  itemId: ApproveActionRequest["itemId"],
  payloadOverride?: ApproveActionRequest["payloadOverride"],
): Promise<ApproveActionResponse> {
  const body: ApproveActionRequest = {
    itemId,
    payloadOverride,
  };
  return postAction<ApproveActionRequest, ApproveActionResponse>({
    route: NEEDS_YOU_API_ROUTES.approveAction,
    body,
    fallbackError: NEEDS_YOU_MESSAGES.approveUnavailable,
    isResponse: isApproveActionResponse,
  });
}

export async function dismissNeedsYouAction(
  itemId: DismissActionRequest["itemId"],
): Promise<DismissActionResponse> {
  const body: DismissActionRequest = { itemId };
  return postAction<DismissActionRequest, DismissActionResponse>({
    route: NEEDS_YOU_API_ROUTES.dismissAction,
    body,
    fallbackError: NEEDS_YOU_MESSAGES.dismissUnavailable,
    isResponse: isDismissActionResponse,
  });
}

export async function recordNeedsYouFeedback(
  itemId: FeedbackActionRequest["itemId"],
  rating: FeedbackActionRequest["rating"],
  note?: FeedbackActionRequest["note"],
): Promise<FeedbackActionResponse> {
  const body: FeedbackActionRequest = { itemId, rating, note };
  return postAction<FeedbackActionRequest, FeedbackActionResponse>({
    route: NEEDS_YOU_API_ROUTES.feedbackAction,
    body,
    fallbackError: NEEDS_YOU_MESSAGES.feedbackUnavailable,
    isResponse: isFeedbackActionResponse,
  });
}
