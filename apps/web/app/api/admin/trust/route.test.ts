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
  const originalRateLimitMode = process.env.NYTE_RATE_LIMIT_MODE;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    delete process.env.UNKEY_ROOT_KEY;
    delete process.env.NYTE_RATE_LIMIT_MODE;
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
    } else {
      process.env.UNKEY_ROOT_KEY = originalUnkeyRootKey;
    }

    if (originalRateLimitMode === undefined) {
      delete process.env.NYTE_RATE_LIMIT_MODE;
      return;
    }

    process.env.NYTE_RATE_LIMIT_MODE = originalRateLimitMode;
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
        unkeyRateLimitActive: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(body.generatedAt).toBeTruthy();
    expect(["ok", "warning"]).toContain(body.posture.status);
    expect(typeof body.security.authzEnforced).toBe("boolean");
    expect(body.security.rateLimitMode).toBe("auto");
    expect(body.security.rateLimitProvider).toBe("memory");
    expect(body.security.unkeyRateLimitConfigured).toBe(false);
    expect(body.security.unkeyRateLimitActive).toBe(false);
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

  it("surfaces warning when unkey mode is forced without root key", async () => {
    process.env.NYTE_RATE_LIMIT_MODE = "unkey";
    delete process.env.UNKEY_ROOT_KEY;

    const response = await GET(buildRequest("http://localhost/api/admin/trust"));
    const body = (await response.json()) as {
      security: {
        rateLimitMode: "auto" | "memory" | "unkey";
        rateLimitProvider: "unkey" | "memory";
      };
      posture: {
        warnings: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(body.security.rateLimitMode).toBe("unkey");
    expect(body.security.rateLimitProvider).toBe("memory");
    expect(body.posture.warnings).toContain(
      "NYTE_RATE_LIMIT_MODE is set to unkey but UNKEY_ROOT_KEY is not configured.",
    );
  });

  it("surfaces warning when memory mode is explicitly forced", async () => {
    process.env.UNKEY_ROOT_KEY = "trust-route-unkey-key";
    process.env.NYTE_RATE_LIMIT_MODE = "memory";

    const response = await GET(buildRequest("http://localhost/api/admin/trust"));
    const body = (await response.json()) as {
      security: {
        rateLimitMode: "auto" | "memory" | "unkey";
        rateLimitProvider: "unkey" | "memory";
      };
      posture: {
        warnings: string[];
      };
    };

    expect(response.status).toBe(200);
    expect(body.security.rateLimitMode).toBe("memory");
    expect(body.security.rateLimitProvider).toBe("memory");
    expect(body.posture.warnings).toContain(
      "NYTE_RATE_LIMIT_MODE is set to memory; using in-process rate limiter.",
    );
  });

  it("normalizes mode values from environment before trust payload rendering", async () => {
    process.env.UNKEY_ROOT_KEY = "trust-route-unkey-key";
    process.env.NYTE_RATE_LIMIT_MODE = " MeMoRy ";

    const forcedMemoryResponse = await GET(buildRequest("http://localhost/api/admin/trust"));
    const forcedMemoryBody = (await forcedMemoryResponse.json()) as {
      security: {
        rateLimitMode: "auto" | "memory" | "unkey";
        rateLimitProvider: "unkey" | "memory";
      };
    };

    expect(forcedMemoryResponse.status).toBe(200);
    expect(forcedMemoryBody.security.rateLimitMode).toBe("memory");
    expect(forcedMemoryBody.security.rateLimitProvider).toBe("memory");

    delete process.env.UNKEY_ROOT_KEY;
    process.env.NYTE_RATE_LIMIT_MODE = "in-valid-mode";
    const normalizedAutoResponse = await GET(buildRequest("http://localhost/api/admin/trust"));
    const normalizedAutoBody = (await normalizedAutoResponse.json()) as {
      security: {
        rateLimitMode: "auto" | "memory" | "unkey";
        rateLimitProvider: "unkey" | "memory";
      };
    };

    expect(normalizedAutoResponse.status).toBe(200);
    expect(normalizedAutoBody.security.rateLimitMode).toBe("auto");
    expect(normalizedAutoBody.security.rateLimitProvider).toBe("memory");
  });
});
