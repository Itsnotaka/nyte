import { randomUUID } from "node:crypto";
import type { RuntimeCommandContext, RuntimeErrorResult } from "@workspace/contracts";

type RuntimeContextOptions = {
  userId?: string;
  requestId?: string;
  now?: Date;
};

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
