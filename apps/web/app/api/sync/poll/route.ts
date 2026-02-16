import { pollGmailIngestion } from "@workspace/integrations/gmail/polling";
import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import { getDashboardData } from "@/lib/server/dashboard";
import { listWatchKeywords } from "@/lib/server/policy-rules";
import { persistSignals } from "@/lib/server/queue-store";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { dispatchRuntimeCommand } from "@/lib/server/runtime-client";
import { pruneWorkflowHistoryIfDue } from "@/lib/server/workflow-retention";
import { ResultAsync } from "neverthrow";
import { randomUUID } from "node:crypto";

function shouldDelegateSyncToRuntime() {
  return process.env.NYTE_RUNTIME_DELEGATE_SYNC?.trim().toLowerCase() === "true";
}

function runtimeErrorStatus(
  code: "bad_request" | "unauthorized" | "not_found" | "conflict" | "internal",
) {
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

  if (shouldDelegateSyncToRuntime()) {
    const runtimeResult = await dispatchRuntimeCommand({
      type: "runtime.ingest",
      context: {
        userId: "local-user",
        requestId: randomUUID(),
        source: "web",
        issuedAt: now.toISOString(),
      },
      payload: {
        cursor,
        watchKeywords: watchKeywords.value,
      },
    });

    if (runtimeResult.isErr()) {
      return Response.json({ error: runtimeResult.error.message }, { status: 502 });
    }

    if (runtimeResult.value.status === "error") {
      return Response.json(
        { error: runtimeResult.value.message },
        { status: runtimeErrorStatus(runtimeResult.value.code) },
      );
    }

    if (runtimeResult.value.type !== "runtime.ingest") {
      return Response.json(
        { error: "Runtime service returned an unexpected command result type." },
        { status: 502 },
      );
    }

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
