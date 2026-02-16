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
} from "@nyte/db";

import { resetRateLimitState } from "~/lib/server/rate-limit";

import { POST } from "./route";

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

function buildRequest(body?: unknown, headers?: HeadersInit) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-forwarded-for", "198.51.100.16");
  if (body !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  return new Request("http://localhost/api/workflows/prune", {
    method: "POST",
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("workflow prune route", () => {
  const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    resetRateLimitState();
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
      return;
    }

    process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
  });

  it("returns prune result payload", async () => {
    const response = await POST(buildRequest());
    const body = (await response.json()) as {
      retentionDays: number | null;
      prunedRuns: number;
      prunedAuditLogs: number;
      performed: boolean;
      triggeredBy: string;
    };

    expect(response.status).toBe(200);
    expect(body.performed).toBe(true);
    expect(body.triggeredBy).toBe("manual");
    expect(typeof body.prunedRuns).toBe("number");
    expect(typeof body.prunedAuditLogs).toBe("number");
  });

  it("returns 429 when prune rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 6; index += 1) {
      lastResponse = await POST(buildRequest());
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 for malformed json body", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflows/prune", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.17",
        },
        body: "{bad-json",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid JSON body");
  });

  it("returns 415 for non-json content-type with non-empty body", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflows/prune", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-forwarded-for": "198.51.100.18",
        },
        body: "payload",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(415);
    expect(body.error).toContain("application/json");
  });

  it("returns 400 when unexpected payload fields are provided", async () => {
    const response = await POST(
      buildRequest({
        force: true,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("does not accept request payload fields");
  });

  it("returns 400 when request body is not a JSON object", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflows/prune", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.21",
        },
        body: JSON.stringify([]),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON object");
  });

  it("accepts empty structured +json payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflows/prune", {
        method: "POST",
        headers: {
          "content-type": "application/merge-patch+json",
          "x-forwarded-for": "198.51.100.19",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = (await response.json()) as {
      performed: boolean;
      triggeredBy: string;
    };

    expect(response.status).toBe(200);
    expect(body.performed).toBe(true);
    expect(body.triggeredBy).toBe("manual");
  });

  it("accepts empty UTF-8 BOM prefixed json payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/workflows/prune", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.20",
        },
        body: `\ufeff${JSON.stringify({})}`,
      }),
    );
    const body = (await response.json()) as {
      performed: boolean;
      triggeredBy: string;
    };

    expect(response.status).toBe(200);
    expect(body.performed).toBe(true);
    expect(body.triggeredBy).toBe("manual");
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await POST(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
