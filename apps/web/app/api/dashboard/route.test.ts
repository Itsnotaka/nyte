import { eq } from "drizzle-orm";
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
import { mockIntakeSignals } from "@nyte/domain/mock-intake";

import { approveWorkItem } from "~/lib/server/approve-action";
import { persistSignals } from "~/lib/server/queue-store";
import { resetRateLimitState } from "~/lib/server/rate-limit";

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

function buildRequest() {
  return new Request("http://localhost/api/dashboard", {
    headers: {
      "x-forwarded-for": "203.0.113.101",
    },
  });
}

describe("GET /api/dashboard", () => {
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

  it("returns seeded queue items in dashboard payload", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-11T09:00:00.000Z"));

    const response = await GET(buildRequest());
    const body = (await response.json()) as {
      needsYou: Array<{ id: string }>;
      drafts: Array<unknown>;
      processed: Array<unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.needsYou.length).toBeGreaterThan(0);
    expect(body.needsYou.some((item) => item.id === "w_renewal")).toBe(true);
    expect(Array.isArray(body.drafts)).toBe(true);
    expect(Array.isArray(body.processed)).toBe(true);
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });

  it("returns 429 when dashboard read rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 121; index += 1) {
      lastResponse = await GET(buildRequest());
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns resilient processed detail when stored action payload is malformed", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-11T09:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-11T09:05:00.000Z"));
    await db
      .update(proposedActions)
      .set({
        payloadJson: "{bad-json",
      })
      .where(eq(proposedActions.workItemId, "w_renewal"));

    const response = await GET(buildRequest());
    const body = (await response.json()) as {
      processed: Array<{
        itemId: string;
        detail: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.processed.find((entry) => entry.itemId === "w_renewal")?.detail).toBe(
      "action_payload • unreadable",
    );
  });
});
