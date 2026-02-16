import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  auditLogs,
  calendarEvents,
  connectedAccounts,
  db,
  ensureDbSchema,
  feedbackEntries,
  gateEvaluations,
  gmailDrafts,
  policyRules,
  proposedActions,
  users,
  workflowEvents,
  workflowRuns,
  workItems,
} from "@workspace/db";

import { resetWorkflowRetentionState } from "@/lib/server/workflow-retention";

import { GET } from "./route";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(calendarEvents);
  await db.delete(gmailDrafts);
  await db.delete(feedbackEntries);
  await db.delete(workflowEvents);
  await db.delete(workflowRuns);
  await db.delete(auditLogs);
  await db.delete(proposedActions);
  await db.delete(gateEvaluations);
  await db.delete(policyRules);
  await db.delete(workItems);
  await db.delete(connectedAccounts);
  await db.delete(users);
}

function buildRequest(url = "http://localhost/api/sync/poll") {
  return new Request(url, {
    headers: {
      "x-forwarded-for": "192.0.2.101",
    },
  });
}

describe("GET /api/sync/poll", () => {
  const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;
  const originalRuntimeDelegateSync = process.env.NYTE_RUNTIME_DELEGATE_SYNC;
  const originalRuntimeUrl = process.env.NYTE_RUNTIME_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    delete process.env.NYTE_RUNTIME_DELEGATE_SYNC;
    delete process.env.NYTE_RUNTIME_URL;
    globalThis.fetch = originalFetch;
    resetWorkflowRetentionState();
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
    } else {
      process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
    }
    if (originalRuntimeDelegateSync === undefined) {
      delete process.env.NYTE_RUNTIME_DELEGATE_SYNC;
    } else {
      process.env.NYTE_RUNTIME_DELEGATE_SYNC = originalRuntimeDelegateSync;
    }

    if (originalRuntimeUrl === undefined) {
      delete process.env.NYTE_RUNTIME_URL;
    } else {
      process.env.NYTE_RUNTIME_URL = originalRuntimeUrl;
    }

    globalThis.fetch = originalFetch;
  });

  it("returns poll cursor and dashboard sections", async () => {
    const response = await GET(buildRequest());
    const body = (await response.json()) as {
      cursor: string;
      signals: Array<{ id: string }>;
      needsYou: Array<{ id: string }>;
      drafts: Array<unknown>;
      processed: Array<unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.cursor).toBeTruthy();
    expect(body.signals.length).toBeGreaterThan(0);
    expect(Array.isArray(body.needsYou)).toBe(true);
    expect(Array.isArray(body.drafts)).toBe(true);
    expect(Array.isArray(body.processed)).toBe(true);
  });

  it("accepts cursor query parameter", async () => {
    const response = await GET(buildRequest("http://localhost/api/sync/poll?cursor=cursor_123"));
    const body = (await response.json()) as { cursor: string; signals: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.cursor).not.toBe("cursor_123");
    expect(body.signals.length).toBeGreaterThan(0);
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });

  it("returns 429 when sync poll rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 31; index += 1) {
      lastResponse = await GET(
        new Request("http://localhost/api/sync/poll", {
          headers: {
            "x-forwarded-for": "192.0.2.150",
          },
        }),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 502 when runtime delegation is enabled without runtime url", async () => {
    process.env.NYTE_RUNTIME_DELEGATE_SYNC = "true";
    delete process.env.NYTE_RUNTIME_URL;

    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain("NYTE_RUNTIME_URL is required");
  });

  it("returns delegated cursor and empty signals on runtime sync delegation", async () => {
    process.env.NYTE_RUNTIME_DELEGATE_SYNC = "true";
    process.env.NYTE_RUNTIME_URL = "https://runtime.nyte.dev";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.ingest",
          requestId: "req_123",
          receivedAt: "2026-02-16T12:00:00.000Z",
          result: {
            cursor: "2026-02-16T11:55:00.000Z",
            queuedCount: 3,
          },
        }),
        { status: 200 },
      );

    const response = await GET(buildRequest());
    const body = (await response.json()) as {
      cursor: string;
      signals: Array<unknown>;
      needsYou: Array<unknown>;
      drafts: Array<unknown>;
      processed: Array<unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.cursor).toBe("2026-02-16T11:55:00.000Z");
    expect(body.signals).toEqual([]);
    expect(Array.isArray(body.needsYou)).toBe(true);
  });

  it("recovers from transient runtime outage during delegated sync", async () => {
    process.env.NYTE_RUNTIME_DELEGATE_SYNC = "true";
    process.env.NYTE_RUNTIME_URL = "https://runtime.nyte.dev";
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(JSON.stringify({ error: "Runtime temporarily unavailable." }), {
          status: 503,
        });
      }

      return new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.ingest",
          requestId: "req_123_retry",
          receivedAt: "2026-02-16T12:00:01.000Z",
          result: {
            cursor: "2026-02-16T11:59:00.000Z",
            queuedCount: 2,
          },
        }),
        { status: 200 },
      );
    };

    const response = await GET(buildRequest());
    const body = (await response.json()) as {
      cursor: string;
      signals: Array<unknown>;
      needsYou: Array<unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.cursor).toBe("2026-02-16T11:59:00.000Z");
    expect(body.signals).toEqual([]);
    expect(Array.isArray(body.needsYou)).toBe(true);
    expect(callCount).toBe(2);
  });
});
