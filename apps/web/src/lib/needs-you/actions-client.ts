import type {
  ApproveActionRequest,
  ApproveActionResponse,
  DismissActionRequest,
  DismissActionResponse,
  FeedbackActionRequest,
  FeedbackActionResponse,
} from "@nyte/workflows";
import type { ToolCallPayload } from "@nyte/domain/actions";
import { readJsonSafe, resolveWorkflowApiError } from "./http-client";

const JSON_HEADERS = {
  "content-type": "application/json",
  accept: "application/json",
} as const;

async function postAction<TRequest, TResponse>({
  route,
  body,
  fallbackError,
}: {
  route: string;
  body: TRequest;
  fallbackError: string;
}): Promise<TResponse> {
  const response = await fetch(route, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  const payload = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(resolveWorkflowApiError(payload, fallbackError));
  }

  return payload as TResponse;
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
    route: "/api/actions/approve",
    body,
    fallbackError: "Unable to approve action.",
  });
}

export async function dismissNeedsYouAction(itemId: string): Promise<DismissActionResponse> {
  const body: DismissActionRequest = { itemId };
  return postAction<DismissActionRequest, DismissActionResponse>({
    route: "/api/actions/dismiss",
    body,
    fallbackError: "Unable to dismiss action.",
  });
}

export async function recordNeedsYouFeedback(
  itemId: string,
  rating: FeedbackActionRequest["rating"],
  note?: string,
): Promise<FeedbackActionResponse> {
  const body: FeedbackActionRequest = { itemId, rating, note };
  return postAction<FeedbackActionRequest, FeedbackActionResponse>({
    route: "/api/actions/feedback",
    body,
    fallbackError: "Unable to save feedback.",
  });
}
