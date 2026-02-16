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

import { resetRateLimitState } from "@/lib/server/rate-limit";

import { GET, POST } from "./route";

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

function buildRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  headers.set("x-forwarded-for", "203.0.113.16");

  return new Request(url, {
    ...init,
    headers,
  });
}

describe("workflow retention route", () => {
  const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;
  const originalRetentionEnv = process.env.NYTE_WORKFLOW_RETENTION_DAYS;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    delete process.env.NYTE_WORKFLOW_RETENTION_DAYS;
    resetRateLimitState();
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
    } else {
      process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
    }

    if (originalRetentionEnv === undefined) {
      delete process.env.NYTE_WORKFLOW_RETENTION_DAYS;
    } else {
      process.env.NYTE_WORKFLOW_RETENTION_DAYS = originalRetentionEnv;
    }
  });

  it("returns default retention via GET", async () => {
    const response = await GET(buildRequest("http://localhost/api/workflows/retention"));
    const body = (await response.json()) as { days: number; source: string };

    expect(response.status).toBe(200);
    expect(body.days).toBe(30);
    expect(body.source).toBe("default");
  });

  it("returns 429 when retention read rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 121; index += 1) {
      lastResponse = await GET(
        buildRequest("http://localhost/api/workflows/retention", {
          method: "GET",
          headers: {
            "x-forwarded-for": "203.0.113.19",
          },
        }),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("updates retention days via POST", async () => {
    const response = await POST(
      buildRequest("http://localhost/api/workflows/retention", {
        method: "POST",
        body: JSON.stringify({ days: 21 }),
      }),
    );
    const body = (await response.json()) as { days: number; source: string };

    expect(response.status).toBe(200);
    expect(body.days).toBe(21);
    expect(body.source).toBe("policy");
  });

  it("rejects invalid body payload", async () => {
    const response = await POST(
      buildRequest("http://localhost/api/workflows/retention", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("days is required");
  });

  it("returns 400 for malformed json body", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflows/retention", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.17",
        },
        body: "{bad-json",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid JSON body");
  });

  it("returns 429 when update rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 21; index += 1) {
      lastResponse = await POST(
        buildRequest("http://localhost/api/workflows/retention", {
          method: "POST",
          body: JSON.stringify({ days: 10 }),
        }),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest("http://localhost/api/workflows/retention"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
