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

import { mockIntakeSignals } from "@/lib/domain/mock-intake";
import { approveWorkItem } from "@/lib/server/approve-action";
import { persistSignals } from "@/lib/server/queue-store";

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
  return new Request("http://localhost/api/metrics", {
    headers: {
      "x-forwarded-for": "198.51.100.101",
    },
  });
}

describe("GET /api/metrics", () => {
  const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
      return;
    }

    process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
  });

  it("returns computed metrics snapshot", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-11T09:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-11T09:05:00.000Z"));

    const response = await GET(buildRequest());
    const body = (await response.json()) as {
      completedCount: number;
      awaitingCount: number;
      approvalRate: number;
      gateHitCounts: Record<string, number>;
    };

    expect(response.status).toBe(200);
    expect(body.completedCount).toBeGreaterThan(0);
    expect(body.awaitingCount).toBeGreaterThanOrEqual(0);
    expect(body.approvalRate).toBeGreaterThan(0);
    expect(body.gateHitCounts.decision).toBeGreaterThanOrEqual(0);
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
