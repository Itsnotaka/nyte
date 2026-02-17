import {
  isApproveActionResponse,
  isDismissActionResponse,
  isFeedbackActionResponse,
} from "@nyte/workflows";
import type {
  ApproveActionRequest,
  ApproveActionResponse,
  DismissActionRequest,
  DismissActionResponse,
  FeedbackActionRequest,
  FeedbackActionResponse,
} from "@nyte/workflows";
import type { ToolCallPayload } from "@nyte/domain/actions";
import { NEEDS_YOU_MESSAGES } from "./messages";
import {
  JSON_REQUEST_HEADERS,
  readJsonSafe,
  resolveWorkflowApiError,
} from "./http-client";
import { NEEDS_YOU_API_ROUTES } from "./routes";

async function postAction<TRequest extends object, TResponse extends object>({
  route,
  body,
  fallbackError,
  invalidResponseError,
  isResponse,
}: {
  route: string;
  body: TRequest;
  fallbackError: string;
  invalidResponseError: string;
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
    throw new Error(invalidResponseError);
  }

  return payload;
}

export async function approveNeedsYouAction(
  itemId: string,
  payloadOverride?: ToolCallPayload,
): Promise<ApproveActionResponse> {
  const body: ApproveActionRequest = {
    itemId,
    payloadOverride,
  };
  return postAction<ApproveActionRequest, ApproveActionResponse>({
    route: NEEDS_YOU_API_ROUTES.approveAction,
    body,
    fallbackError: NEEDS_YOU_MESSAGES.approveUnavailable,
    invalidResponseError: NEEDS_YOU_MESSAGES.invalidActionResponse,
    isResponse: isApproveActionResponse,
  });
}

export async function dismissNeedsYouAction(itemId: string): Promise<DismissActionResponse> {
  const body: DismissActionRequest = { itemId };
  return postAction<DismissActionRequest, DismissActionResponse>({
    route: NEEDS_YOU_API_ROUTES.dismissAction,
    body,
    fallbackError: NEEDS_YOU_MESSAGES.dismissUnavailable,
    invalidResponseError: NEEDS_YOU_MESSAGES.invalidActionResponse,
    isResponse: isDismissActionResponse,
  });
}

export async function recordNeedsYouFeedback(
  itemId: string,
  rating: FeedbackActionRequest["rating"],
  note?: string,
): Promise<FeedbackActionResponse> {
  const body: FeedbackActionRequest = { itemId, rating, note };
  return postAction<FeedbackActionRequest, FeedbackActionResponse>({
    route: NEEDS_YOU_API_ROUTES.feedbackAction,
    body,
    fallbackError: NEEDS_YOU_MESSAGES.feedbackUnavailable,
    invalidResponseError: NEEDS_YOU_MESSAGES.invalidActionResponse,
    isResponse: isFeedbackActionResponse,
  });
}
