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

import { POST as approveAction } from "./actions/approve/route";
import { POST as connectGoogle } from "./connections/google/route";
import { GET as getDashboard } from "./dashboard/route";
import { GET as getMetrics } from "./metrics/route";
import { GET as pollSync } from "./sync/poll/route";
import { GET as getWorkflowTimeline } from "./workflows/[itemId]/route";

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

function buildGetRequest(url: string, forwardedFor: string) {
  return new Request(url, {
    headers: {
      "x-forwarded-for": forwardedFor,
    },
  });
}

describe("supervisor flow integration", () => {
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

  it("completes connect -> ingest -> approve -> timeline/metrics flow", async () => {
    const connectionResponse = await connectGoogle(
      new Request("http://localhost/api/connections/google", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.10",
        },
        body: JSON.stringify({
          providerAccountId: "acct-flow",
          accessToken: "flow-access",
          refreshToken: "flow-refresh",
          scopes: ["gmail.readonly", "gmail.modify", "calendar.events"],
        }),
      }),
    );
    const connectionBody = (await connectionResponse.json()) as {
      connected: boolean;
      providerAccountId: string;
      scopes: string[];
    };

    expect(connectionResponse.status).toBe(200);
    expect(connectionBody.connected).toBe(true);
    expect(connectionBody.providerAccountId).toBe("acct-flow");
    expect(connectionBody.scopes).toContain("calendar.events");

    const syncResponse = await pollSync(
      buildGetRequest("http://localhost/api/sync/poll", "198.51.100.11"),
    );
    const syncBody = (await syncResponse.json()) as {
      cursor: string;
      needsYou: Array<{
        id: string;
      }>;
    };

    expect(syncResponse.status).toBe(200);
    expect(syncBody.cursor).toBeTruthy();
    expect(syncBody.needsYou.length).toBeGreaterThan(0);
    const itemId = syncBody.needsYou[0]?.id;
    expect(itemId).toBeTruthy();

    const approvalResponse = await approveAction(
      new Request("http://localhost/api/actions/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.12",
        },
        body: JSON.stringify({
          itemId,
        }),
      }),
    );
    const approvalBody = (await approvalResponse.json()) as {
      itemId: string;
      idempotent?: boolean;
      execution: {
        destination: string;
      };
    };

    expect(approvalResponse.status).toBe(200);
    expect(approvalBody.itemId).toBe(itemId);
    expect(approvalBody.idempotent).toBeFalsy();
    expect(approvalBody.execution.destination.length).toBeGreaterThan(0);

    const dashboardResponse = await getDashboard(
      buildGetRequest("http://localhost/api/dashboard", "198.51.100.13"),
    );
    const dashboardBody = (await dashboardResponse.json()) as {
      needsYou: Array<{
        id: string;
      }>;
      processed: Array<{
        itemId: string;
        status: "executed" | "dismissed";
      }>;
    };

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardBody.needsYou.some((entry) => entry.id === itemId)).toBe(false);
    expect(
      dashboardBody.processed.some(
        (entry) => entry.itemId === itemId && entry.status === "executed",
      ),
    ).toBe(true);

    const workflowResponse = await getWorkflowTimeline(
      buildGetRequest(`http://localhost/api/workflows/${itemId}`, "198.51.100.14"),
      {
        params: Promise.resolve({
          itemId: itemId ?? "",
        }),
      },
    );
    const workflowBody = (await workflowResponse.json()) as {
      itemId: string;
      timeline: Array<{
        phase: string;
      }>;
    };

    expect(workflowResponse.status).toBe(200);
    expect(workflowBody.itemId).toBe(itemId);
    expect(workflowBody.timeline.length).toBeGreaterThan(0);
    expect(workflowBody.timeline.some((entry) => entry.phase === "ingest")).toBe(true);
    expect(workflowBody.timeline.some((entry) => entry.phase === "approve")).toBe(true);

    const metricsResponse = await getMetrics(
      buildGetRequest("http://localhost/api/metrics", "198.51.100.15"),
    );
    const metricsBody = (await metricsResponse.json()) as {
      completedCount: number;
      approvalRate: number;
    };

    expect(metricsResponse.status).toBe(200);
    expect(metricsBody.completedCount).toBeGreaterThanOrEqual(1);
    expect(metricsBody.approvalRate).toBeGreaterThan(0);
  });
});
