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

function buildRequest(url: string) {
  return new Request(url, {
    headers: {
      "x-forwarded-for": "198.51.100.7",
    },
  });
}

describe("GET /api/admin/trust", () => {
  const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;
  const originalUnkeyRootKey = process.env.UNKEY_ROOT_KEY;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    delete process.env.UNKEY_ROOT_KEY;
    resetRateLimitState();
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
      return;
    }

    process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
    if (originalUnkeyRootKey === undefined) {
      delete process.env.UNKEY_ROOT_KEY;
      return;
    }

    process.env.UNKEY_ROOT_KEY = originalUnkeyRootKey;
  });

  it("returns trust report payload", async () => {
    const response = await GET(buildRequest("http://localhost/api/admin/trust"));
    const body = (await response.json()) as {
      generatedAt: string;
      posture: {
        status: "ok" | "warning";
      };
      security: {
        authzEnforced: boolean;
        rateLimitMode: "auto" | "memory" | "unkey";
        rateLimitProvider: "unkey" | "memory";
        unkeyRateLimitConfigured: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBeTruthy();
    expect(["ok", "warning"]).toContain(body.posture.status);
    expect(typeof body.security.authzEnforced).toBe("boolean");
    expect(body.security.rateLimitMode).toBe("auto");
    expect(body.security.rateLimitProvider).toBe("memory");
    expect(body.security.unkeyRateLimitConfigured).toBe(false);
  });

  it("returns 429 when trust read limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 31; index += 1) {
      lastResponse = await GET(buildRequest("http://localhost/api/admin/trust"));
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when authz is enforced and no session is present", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest("http://localhost/api/admin/trust"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
