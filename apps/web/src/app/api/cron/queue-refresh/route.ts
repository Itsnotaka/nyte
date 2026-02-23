import { db } from "@nyte/db/client";
import { accounts } from "@nyte/db/schema";
import { pruneAuditLogs } from "@nyte/application/audit/log";
import { pruneWorkflowEvents } from "@nyte/application/run-log";
import { runIngestSignalsTask } from "@nyte/workflows";
import { and, eq, isNotNull } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/lib/server/env";

const CRON_STALE_AFTER_MS = 2 * 60 * 1000;
const RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 50;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.PRELOAD_CRON_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Google refresh token exchange failed (${response.status}).`
    );
  }

  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
    throw new Error("Google refresh token exchange returned no access token.");
  }

  return payload.access_token;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const batchSize = env.PRELOAD_BATCH_SIZE ?? DEFAULT_BATCH_SIZE;
  const rows = await db
    .select({
      userId: accounts.userId,
      refreshToken: accounts.refreshToken,
    })
    .from(accounts)
    .where(
      and(eq(accounts.providerId, "google"), isNotNull(accounts.refreshToken))
    )
    .limit(batchSize);

  const refreshTokenByUser = new Map<string, string>();
  for (const row of rows) {
    if (typeof row.refreshToken !== "string" || row.refreshToken.length === 0) {
      continue;
    }

    if (!refreshTokenByUser.has(row.userId)) {
      refreshTokenByUser.set(row.userId, row.refreshToken);
    }
  }

  let refreshedUsers = 0;
  const failures: Array<{ userId: string; error: string }> = [];
  for (const [userId, refreshToken] of refreshTokenByUser) {
    try {
      const accessToken = await refreshGoogleAccessToken(refreshToken);
      await runIngestSignalsTask({
        userId,
        accessToken,
        watchKeywords: [],
        staleAfterMs: CRON_STALE_AFTER_MS,
      });
      refreshedUsers += 1;
    } catch (error) {
      failures.push({
        userId,
        error:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Unknown refresh error",
      });
    }
  }

  const retentionCutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  await Promise.all([
    pruneAuditLogs({ olderThan: retentionCutoff }),
    pruneWorkflowEvents({ olderThan: retentionCutoff }),
  ]);

  return NextResponse.json({
    scannedUsers: refreshTokenByUser.size,
    refreshedUsers,
    failedUsers: failures.length,
    failures,
  });
}
