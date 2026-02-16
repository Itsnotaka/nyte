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

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    resetWorkflowRetentionState();
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
      return;
    }

    process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
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
});
