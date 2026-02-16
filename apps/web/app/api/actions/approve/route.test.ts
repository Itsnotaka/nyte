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
import { resetRateLimitState } from "@/lib/server/rate-limit";
import { persistSignals } from "@/lib/server/queue-store";

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

function buildRequest(body: Record<string, unknown>, headers?: HeadersInit) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("content-type", "application/json");
  requestHeaders.set("x-forwarded-for", "203.0.113.44");

  return new Request("http://localhost/api/actions/approve", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

describe("POST /api/actions/approve", () => {
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

  it("approves a seeded work item", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    const response = await POST(
      buildRequest({
        itemId: "w_renewal",
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      idempotent?: boolean;
      execution: {
        idempotencyKey: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_renewal");
    expect(body.idempotent).toBeFalsy();
    expect(body.execution.idempotencyKey).toBeTruthy();
  });

  it("returns 400 when itemId is missing", async () => {
    const response = await POST(buildRequest({}));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("itemId is required");
  });

  it("propagates explicit idempotency key from header", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    const response = await POST(
      buildRequest(
        {
          itemId: "w_renewal",
        },
        {
          "x-idempotency-key": "approve-key-123",
        },
      ),
    );
    const body = (await response.json()) as {
      execution: {
        idempotencyKey: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.execution.idempotencyKey).toBe("approve-key-123");
  });

  it("returns 404 for unknown item", async () => {
    const response = await POST(
      buildRequest({
        itemId: "w_missing",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("returns 429 when action approve limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 31; index += 1) {
      lastResponse = await POST(
        buildRequest({
          itemId: "w_missing",
        }),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 401 when authz is enforced and session missing", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await POST(
      buildRequest({
        itemId: "w_renewal",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
