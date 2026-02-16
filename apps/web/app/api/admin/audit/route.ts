import { createAuthorizationErrorResponse, requireAuthorizedSession } from "@/lib/server/authz";
import {
  countAuditLogs,
  countAuditLogsByTarget,
  listAuditLogs,
  listAuditLogsByTarget,
} from "@/lib/server/audit-log";
import { rateLimitRequest } from "@/lib/server/rate-limit";
import { createRateLimitResponse } from "@/lib/server/rate-limit-response";
import { ResultAsync } from "neverthrow";

export async function GET(request: Request) {
  const authorization = await requireAuthorizedSession(request);
  if (authorization.isErr()) {
    return createAuthorizationErrorResponse(authorization.error);
  }

  const rateLimit = await rateLimitRequest(request, "admin:audit:read", {
    limit: 60,
    windowMs: 60_000,
  });
  if (rateLimit.isErr()) {
    return createRateLimitResponse(rateLimit.error);
  }

  const url = new URL(request.url);
  const targetTypeParam = url.searchParams.get("targetType");
  const targetIdParam = url.searchParams.get("targetId");
  const targetType = targetTypeParam?.trim() ? targetTypeParam.trim() : null;
  const targetId = targetIdParam?.trim() ? targetIdParam.trim() : null;
  if ((targetType && !targetId) || (!targetType && targetId)) {
    return Response.json(
      { error: "targetType and targetId must be provided together." },
      { status: 400 },
    );
  }

  const limit = Number(url.searchParams.get("limit") ?? "100");
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 100;
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;

  const rowsResult = await ResultAsync.fromPromise(
    targetType && targetId
      ? listAuditLogsByTarget(targetType, targetId, safeLimit, safeOffset)
      : listAuditLogs(safeLimit, safeOffset),
    () => new Error("Failed to load audit logs."),
  );
  if (rowsResult.isErr()) {
    return Response.json({ error: "Failed to load audit logs." }, { status: 500 });
  }

  const totalCountResult = await ResultAsync.fromPromise(
    targetType && targetId ? countAuditLogsByTarget(targetType, targetId) : countAuditLogs(),
    () => new Error("Failed to load audit log count."),
  );
  if (totalCountResult.isErr()) {
    return Response.json({ error: "Failed to load audit log count." }, { status: 500 });
  }
  const rows = rowsResult.value;
  const totalCount = totalCountResult.value;

  return Response.json({
    count: rows.length,
    totalCount,
    hasMore: safeOffset + rows.length < totalCount,
    limit: safeLimit,
    offset: safeOffset,
    rows,
  });
}
