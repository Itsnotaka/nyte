export type RuntimeCommandType =
  | "runtime.ingest"
  | "runtime.approve"
  | "runtime.dismiss"
  | "runtime.feedback";

export type RuntimeCommandSource = "web";

export type RuntimeCommandContext = {
  userId: string;
  requestId: string;
  source: RuntimeCommandSource;
  issuedAt: string;
};

export type RuntimeIngestPayload = {
  cursor?: string;
  watchKeywords?: string[];
};

export type RuntimeApprovePayload = {
  itemId: string;
  idempotencyKey?: string;
};

export type RuntimeDismissPayload = {
  itemId: string;
};

export type RuntimeFeedbackPayload = {
  itemId: string;
  rating: "positive" | "negative";
  note?: string;
};

export type RuntimeIngestCommand = {
  type: "runtime.ingest";
  context: RuntimeCommandContext;
  payload: RuntimeIngestPayload;
};

export type RuntimeApproveCommand = {
  type: "runtime.approve";
  context: RuntimeCommandContext;
  payload: RuntimeApprovePayload;
};

export type RuntimeDismissCommand = {
  type: "runtime.dismiss";
  context: RuntimeCommandContext;
  payload: RuntimeDismissPayload;
};

export type RuntimeFeedbackCommand = {
  type: "runtime.feedback";
  context: RuntimeCommandContext;
  payload: RuntimeFeedbackPayload;
};

export type RuntimeCommand =
  | RuntimeIngestCommand
  | RuntimeApproveCommand
  | RuntimeDismissCommand
  | RuntimeFeedbackCommand;

type RuntimeResultEnvelope<TType extends RuntimeCommandType, TResult> = {
  status: "accepted";
  type: TType;
  requestId: string;
  receivedAt: string;
  result: TResult;
};

export type RuntimeIngestResult = RuntimeResultEnvelope<
  "runtime.ingest",
  {
    cursor: string;
    queuedCount: number;
  }
>;

export type RuntimeApproveResult = RuntimeResultEnvelope<
  "runtime.approve",
  {
    itemId: string;
    idempotent: boolean;
  }
>;

export type RuntimeDismissResult = RuntimeResultEnvelope<
  "runtime.dismiss",
  {
    itemId: string;
  }
>;

export type RuntimeFeedbackResult = RuntimeResultEnvelope<
  "runtime.feedback",
  {
    itemId: string;
    rating: "positive" | "negative";
  }
>;

export type RuntimeErrorResult = {
  status: "error";
  requestId: string;
  code: "bad_request" | "unauthorized" | "not_found" | "conflict" | "internal";
  message: string;
};

export type RuntimeCommandResult =
  | RuntimeIngestResult
  | RuntimeApproveResult
  | RuntimeDismissResult
  | RuntimeFeedbackResult
  | RuntimeErrorResult;

type RuntimeCommandByTypeMap = {
  "runtime.ingest": RuntimeIngestCommand;
  "runtime.approve": RuntimeApproveCommand;
  "runtime.dismiss": RuntimeDismissCommand;
  "runtime.feedback": RuntimeFeedbackCommand;
};

export type RuntimeCommandByType<TType extends RuntimeCommandType> = RuntimeCommandByTypeMap[TType];

export function isRuntimeCommandType(value: unknown): value is RuntimeCommandType {
  return (
    value === "runtime.ingest" ||
    value === "runtime.approve" ||
    value === "runtime.dismiss" ||
    value === "runtime.feedback"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRuntimeContext(value: unknown): value is RuntimeCommandContext {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.requestId) &&
    value.source === "web" &&
    isNonEmptyString(value.issuedAt)
  );
}

function isIngestPayload(value: unknown): value is RuntimeIngestPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (value.cursor !== undefined && typeof value.cursor !== "string") {
    return false;
  }

  if (
    value.watchKeywords !== undefined &&
    (!Array.isArray(value.watchKeywords) ||
      value.watchKeywords.some((entry) => typeof entry !== "string"))
  ) {
    return false;
  }

  return true;
}

function isApprovePayload(value: unknown): value is RuntimeApprovePayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.itemId)) {
    return false;
  }

  if (value.idempotencyKey !== undefined && !isNonEmptyString(value.idempotencyKey)) {
    return false;
  }

  return true;
}

function isDismissPayload(value: unknown): value is RuntimeDismissPayload {
  if (!isRecord(value)) {
    return false;
  }

  return isNonEmptyString(value.itemId);
}

function isFeedbackPayload(value: unknown): value is RuntimeFeedbackPayload {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.itemId)) {
    return false;
  }

  if (value.rating !== "positive" && value.rating !== "negative") {
    return false;
  }

  if (value.note !== undefined && typeof value.note !== "string") {
    return false;
  }

  return true;
}

export function isRuntimeCommand(value: unknown): value is RuntimeCommand {
  if (!isRecord(value) || !isRuntimeCommandType(value.type) || !isRuntimeContext(value.context)) {
    return false;
  }

  if (value.type === "runtime.ingest") {
    return isIngestPayload(value.payload);
  }

  if (value.type === "runtime.approve") {
    return isApprovePayload(value.payload);
  }

  if (value.type === "runtime.dismiss") {
    return isDismissPayload(value.payload);
  }

  return isFeedbackPayload(value.payload);
}
