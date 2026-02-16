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

import { DELETE, GET, POST } from "./route";

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

function buildRequest(url: string, method: "GET" | "POST" | "DELETE", body?: unknown) {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.88",
  });
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }

  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("policy rules route", () => {
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

  it("creates and lists watch keywords", async () => {
    const createResponse = await POST(
      buildRequest("http://localhost/api/policy-rules", "POST", {
        keyword: " Strategic ",
      }),
    );
    const createBody = (await createResponse.json()) as { keyword: string };
    expect(createResponse.status).toBe(200);
    expect(createBody.keyword).toBe("strategic");

    const listResponse = await GET(buildRequest("http://localhost/api/policy-rules", "GET"));
    const listBody = (await listResponse.json()) as { watchKeywords: string[] };
    expect(listResponse.status).toBe(200);
    expect(listBody.watchKeywords).toContain("strategic");
  });

  it("deletes an existing keyword", async () => {
    await POST(
      buildRequest("http://localhost/api/policy-rules", "POST", {
        keyword: "follow-up",
      }),
    );

    const deleteResponse = await DELETE(
      buildRequest("http://localhost/api/policy-rules", "DELETE", {
        keyword: "follow-up",
      }),
    );
    const deleteBody = (await deleteResponse.json()) as { keyword: string };

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.keyword).toBe("follow-up");

    const listResponse = await GET(buildRequest("http://localhost/api/policy-rules", "GET"));
    const listBody = (await listResponse.json()) as { watchKeywords: string[] };
    expect(listBody.watchKeywords).not.toContain("follow-up");
  });

  it("returns 400 when keyword is missing", async () => {
    const response = await POST(buildRequest("http://localhost/api/policy-rules", "POST", {}));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("keyword is required");
  });

  it("returns 400 for malformed json body", async () => {
    const response = await POST(
      new Request("http://localhost/api/policy-rules", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.89",
        },
        body: "{bad-json",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid JSON body");
  });

  it("returns 415 for non-json content-type", async () => {
    const response = await POST(
      new Request("http://localhost/api/policy-rules", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-forwarded-for": "203.0.113.91",
        },
        body: "keyword=raw",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(415);
    expect(body.error).toContain("application/json");
  });

  it("returns 400 for malformed json body on delete", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/policy-rules", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.90",
        },
        body: "{bad-json",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid JSON body");
  });

  it("returns 429 when mutate rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 21; index += 1) {
      lastResponse = await POST(
        buildRequest("http://localhost/api/policy-rules", "POST", {
          keyword: `rule-${index}`,
        }),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 429 when read rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 121; index += 1) {
      lastResponse = await GET(
        new Request("http://localhost/api/policy-rules", {
          method: "GET",
          headers: {
            "x-forwarded-for": "203.0.113.180",
          },
        }),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when authz is enforced and no session exists", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest("http://localhost/api/policy-rules", "GET"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
