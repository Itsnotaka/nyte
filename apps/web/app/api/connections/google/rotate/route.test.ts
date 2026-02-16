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

import { POST } from "./route";
import { POST as connectGoogle } from "../route";

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
  body?: Record<string, unknown>,
  ip = "192.0.2.88",
  url = "http://localhost/api/connections/google/rotate",
) {
  const headers = new Headers({
    "x-forwarded-for": ip,
  });
  if (body) {
    headers.set("content-type", "application/json");
  }

  return new Request(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("google connection rotate route", () => {
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

  it("returns rotated false when google connection is absent", async () => {
    const response = await POST(buildRequest());
    const body = (await response.json()) as { rotated: boolean };

    expect(response.status).toBe(200);
    expect(body.rotated).toBe(false);
  });

  it("rotates secrets for an existing connection", async () => {
    await connectGoogle(
      new Request("http://localhost/api/connections/google", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.90",
        },
        body: JSON.stringify({
          providerAccountId: "google-rotate",
          accessToken: "access-token-rotate",
          refreshToken: "refresh-token-rotate",
        }),
      }),
    );

    const response = await POST(buildRequest(undefined, "192.0.2.90"));
    const body = (await response.json()) as {
      rotated: boolean;
      status: { connected: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.rotated).toBe(true);
    expect(body.status.connected).toBe(true);
  });

  it("returns 429 when rotate rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 11; index += 1) {
      lastResponse = await POST(buildRequest(undefined, "192.0.2.91"));
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 500 when stored secret payload is invalid", async () => {
    const now = new Date("2026-02-11T10:00:00.000Z");
    await db.insert(users).values({
      id: "local-user",
      email: "local-user@nyte.dev",
      name: "Local Nyte User",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(connectedAccounts).values({
      id: "connection:google",
      userId: "local-user",
      provider: "google",
      providerAccountId: "google-broken",
      scopes: "https://www.googleapis.com/auth/gmail.readonly",
      accessToken: "not-a-valid-encrypted-payload",
      refreshToken: "not-a-valid-encrypted-payload",
      connectedAt: now,
      updatedAt: now,
    });

    const response = await POST(buildRequest(undefined, "192.0.2.92"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toContain("Failed to rotate");
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await POST(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
