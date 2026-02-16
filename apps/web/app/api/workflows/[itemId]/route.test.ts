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
  return new Request("http://localhost/api/workflows/w_renewal", {
    headers: {
      "x-forwarded-for": "203.0.113.102",
    },
  });
}

describe("GET /api/workflows/[itemId]", () => {
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

  it("returns workflow timeline for item", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-11T09:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-11T09:05:00.000Z"));

    const response = await GET(buildRequest(), {
      params: Promise.resolve({
        itemId: "w_renewal",
      }),
    });
    const body = (await response.json()) as {
      itemId: string;
      timeline: Array<{ runId: string; events: Array<{ kind: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_renewal");
    expect(body.timeline.length).toBeGreaterThan(0);
    expect(body.timeline.some((entry) => entry.events.length > 0)).toBe(true);
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest(), {
      params: Promise.resolve({
        itemId: "w_renewal",
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
