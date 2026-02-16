import { randomUUID } from "node:crypto";
import type {
  RuntimeCommandContext,
  RuntimeCommandType,
  RuntimeErrorResult,
} from "@workspace/contracts";
import { ResultAsync } from "neverthrow";
import { recordAuditLog } from "./audit-log";

type RuntimeContextOptions = {
  userId?: string;
  requestId?: string;
  now?: Date;
};

type RuntimeDelegationOutcome = "accepted" | "dispatch_error" | "runtime_error" | "invalid_result";

type RuntimeDelegationAuditInput = {
  commandType: RuntimeCommandType;
  outcome: RuntimeDelegationOutcome;
  requestId: string;
  code?: RuntimeErrorResult["code"];
  message?: string;
  now?: Date;
};

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
}

function commandLabel(commandType: RuntimeCommandType) {
  if (commandType === "runtime.ingest") {
    return "ingest";
  }

  if (commandType === "runtime.approve") {
    return "approve";
  }

  if (commandType === "runtime.dismiss") {
    return "dismiss";
  }

  return "feedback";
}

export function shouldDelegateRuntimeCommand(flagName: string): boolean {
  return process.env[flagName]?.trim().toLowerCase() === "true";
}

export function runtimeErrorStatus(code: RuntimeErrorResult["code"]): number {
  if (code === "bad_request") {
    return 400;
  }

  if (code === "unauthorized") {
    return 401;
  }

  if (code === "not_found") {
    return 404;
  }

  if (code === "conflict") {
    return 409;
  }

  return 500;
}

export function createRuntimeCommandContext(
  options: RuntimeContextOptions = {},
): RuntimeCommandContext {
  return {
    userId: options.userId ?? "local-user",
    requestId: options.requestId ?? randomUUID(),
    source: "web",
    issuedAt: (options.now ?? new Date()).toISOString(),
  };
}

export function resolveRuntimeRequestId(request: Request): string {
  const headerValue = request.headers.get("x-request-id")?.trim();
  if (headerValue) {
    return headerValue;
  }

  return randomUUID();
}

export async function recordRuntimeDelegationAudit({
  commandType,
  outcome,
  requestId,
  code,
  message,
  now = new Date(),
}: RuntimeDelegationAuditInput) {
  await ResultAsync.fromPromise(
    recordAuditLog({
      action: `runtime.delegate.${commandLabel(commandType)}.${outcome}`,
      targetType: "runtime_command",
      targetId: requestId,
      payload: {
        commandType,
        outcome,
        code,
        message,
      },
      now,
    }),
    (error) => toError(error, "Failed to record runtime delegation audit event."),
  ).match(
    () => undefined,
    () => undefined,
  );
}
