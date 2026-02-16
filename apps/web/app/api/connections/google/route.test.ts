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

function buildRequest(
  method: "GET" | "POST" | "DELETE",
  body?: Record<string, unknown>,
  ip = "198.51.100.88",
) {
  const headers = new Headers({
    "x-forwarded-for": ip,
  });
  if (body) {
    headers.set("content-type", "application/json");
  }

  return new Request("http://localhost/api/connections/google", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("google connection route", () => {
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

  it("returns disconnected status by default", async () => {
    const response = await GET(buildRequest("GET"));
    const body = (await response.json()) as { connected: boolean };

    expect(response.status).toBe(200);
    expect(body.connected).toBe(false);
  });

  it("connects and then disconnects google account", async () => {
    const connectResponse = await POST(
      buildRequest("POST", {
        providerAccountId: "google-account-1",
      }),
    );
    const connectBody = (await connectResponse.json()) as {
      connected: boolean;
      providerAccountId: string | null;
    };
    expect(connectResponse.status).toBe(200);
    expect(connectBody.connected).toBe(true);
    expect(connectBody.providerAccountId).toBe("google-account-1");

    const disconnectResponse = await DELETE(buildRequest("DELETE"));
    const disconnectBody = (await disconnectResponse.json()) as { connected: boolean };
    expect(disconnectResponse.status).toBe(200);
    expect(disconnectBody.connected).toBe(false);
  });

  it("returns 429 when mutate rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 21; index += 1) {
      lastResponse = await POST(
        buildRequest(
          "POST",
          {
            providerAccountId: `google-${index}`,
          },
          "198.51.100.89",
        ),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when authz is enforced and session is missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest("GET"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
