import { pollGmailIngestion } from "@workspace/integrations/gmail/polling";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { getDashboardData } from "@/lib/server/dashboard";
import { listWatchKeywords } from "@/lib/server/policy-rules";
import { persistSignals } from "@/lib/server/queue-store";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { dispatchRuntimeCommand } from "@/lib/server/runtime-client";
import {
  createRuntimeCommandContext,
  recordRuntimeDelegationAudit,
  resolveRuntimeRequestId,
  runtimeErrorStatus,
  shouldDelegateRuntimeCommand,
} from "@/lib/server/runtime-delegation";
import { pruneWorkflowHistoryIfDue } from "@/lib/server/workflow-retention";
import { ResultAsync } from "neverthrow";

export async function GET(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "sync:poll", {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const now = new Date();
  const watchKeywords = await ResultAsync.fromPromise(listWatchKeywords(), () => {
    return new Error("Failed to load watch keywords.");
  });
  if (watchKeywords.isErr()) {
    return Response.json({ error: "Failed to load watch keywords." }, { status: 500 });
  }

  if (shouldDelegateRuntimeCommand("NYTE_RUNTIME_DELEGATE_SYNC")) {
    const runtimeRequestId = resolveRuntimeRequestId(request);
    const runtimeResult = await dispatchRuntimeCommand({
      type: "runtime.ingest",
      context: createRuntimeCommandContext({
        requestId: runtimeRequestId,
        now,
      }),
      payload: {
        cursor,
        watchKeywords: watchKeywords.value,
      },
    });

    if (runtimeResult.isErr()) {
      await recordRuntimeDelegationAudit({
        commandType: "runtime.ingest",
        outcome: "dispatch_error",
        requestId: runtimeRequestId,
        message: runtimeResult.error.message,
      });
      return Response.json({ error: runtimeResult.error.message }, { status: 502 });
    }

    if (runtimeResult.value.status === "error") {
      await recordRuntimeDelegationAudit({
        commandType: "runtime.ingest",
        outcome: "runtime_error",
        requestId: runtimeResult.value.requestId,
        code: runtimeResult.value.code,
        message: runtimeResult.value.message,
      });
      return Response.json(
        { error: runtimeResult.value.message },
        { status: runtimeErrorStatus(runtimeResult.value.code) },
      );
    }

    if (runtimeResult.value.type !== "runtime.ingest") {
      await recordRuntimeDelegationAudit({
        commandType: "runtime.ingest",
        outcome: "invalid_result",
        requestId: runtimeResult.value.requestId,
        message: "Runtime service returned an unexpected command result type.",
      });
      return Response.json(
        { error: "Runtime service returned an unexpected command result type." },
        { status: 502 },
      );
    }

    await recordRuntimeDelegationAudit({
      commandType: "runtime.ingest",
      outcome: "accepted",
      requestId: runtimeResult.value.requestId,
    });

    const dashboard = await ResultAsync.fromPromise(getDashboardData(), () => {
      return new Error("Failed to load dashboard.");
    });
    if (dashboard.isErr()) {
      return Response.json({ error: "Failed to load dashboard." }, { status: 500 });
    }

    return Response.json({
      cursor: runtimeResult.value.result.cursor,
      signals: [],
      ...dashboard.value,
    });
  }

  const pollResult = pollGmailIngestion({
    cursor,
    now,
    watchKeywords: watchKeywords.value,
  });
  const persisted = await ResultAsync.fromPromise(persistSignals(pollResult.signals, now), () => {
    return new Error("Failed to persist sync results.");
  });
  if (persisted.isErr()) {
    return Response.json({ error: "Failed to persist sync results." }, { status: 500 });
  }

  const pruned = await ResultAsync.fromPromise(pruneWorkflowHistoryIfDue(now), () => {
    return new Error("Failed to run retention pruning.");
  });
  if (pruned.isErr()) {
    return Response.json({ error: "Failed to run retention pruning." }, { status: 500 });
  }

  const dashboard = await ResultAsync.fromPromise(getDashboardData(), () => {
    return new Error("Failed to load dashboard.");
  });
  if (dashboard.isErr()) {
    return Response.json({ error: "Failed to load dashboard." }, { status: 500 });
  }

  return Response.json({
    cursor: pollResult.nextCursor,
    signals: pollResult.signals,
    ...dashboard.value,
  });
}
