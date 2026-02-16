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
  requestHeaders.set("x-forwarded-for", "192.0.2.44");

  return new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

describe("POST /api/feedback", () => {
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

  it("stores feedback for a completed item", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-10T10:05:00.000Z"));

    const response = await POST(
      buildRequest({
        itemId: "w_renewal",
        rating: "positive",
        note: "Helpful draft",
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      rating: "positive" | "negative";
      notedAt: string;
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_renewal");
    expect(body.rating).toBe("positive");
    expect(body.notedAt).toBeTruthy();
  });

  it("returns 400 when rating is invalid", async () => {
    const response = await POST(
      buildRequest({
        itemId: "w_renewal",
        rating: "neutral",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("rating must be positive or negative");
  });

  it("returns 400 when itemId is whitespace-only", async () => {
    const response = await POST(
      buildRequest({
        itemId: "   ",
        rating: "positive",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("itemId is required");
  });

  it("returns 400 when itemId is not a string", async () => {
    const response = await POST(
      buildRequest({
        itemId: 123,
        rating: "positive",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("itemId must be a string");
  });

  it("returns 400 when request body is not a JSON object", async () => {
    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.49",
        },
        body: JSON.stringify(["w_renewal", "positive"]),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON object");
  });

  it("returns 400 for malformed json body", async () => {
    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.45",
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
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-forwarded-for": "192.0.2.46",
        },
        body: "itemId=w_renewal&rating=positive",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(415);
    expect(body.error).toContain("application/json");
  });

  it("accepts structured +json content-type", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-10T10:05:00.000Z"));

    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/merge-patch+json",
          "x-forwarded-for": "192.0.2.47",
        },
        body: JSON.stringify({
          itemId: "w_renewal",
          rating: "positive",
        }),
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      rating: "positive" | "negative";
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_renewal");
    expect(body.rating).toBe("positive");
  });

  it("accepts UTF-8 BOM prefixed json payload", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-10T10:05:00.000Z"));

    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "192.0.2.48",
        },
        body: `\ufeff${JSON.stringify({
          itemId: "w_renewal",
          rating: "positive",
        })}`,
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      rating: "positive" | "negative";
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_renewal");
    expect(body.rating).toBe("positive");
  });

  it("returns 409 for unprocessed item feedback attempt", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    const response = await POST(
      buildRequest({
        itemId: "w_board",
        rating: "positive",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(409);
    expect(body.error).toContain("processed items");
  });

  it("returns 400 when note is not a string", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));
    await approveWorkItem("w_renewal", new Date("2026-02-10T10:05:00.000Z"));

    const response = await POST(
      buildRequest({
        itemId: "w_renewal",
        rating: "positive",
        note: 7,
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("note must be a string");
  });

  it("returns 404 for unknown item", async () => {
    const response = await POST(
      buildRequest({
        itemId: "w_missing",
        rating: "positive",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toContain("not found");
  });

  it("returns 429 when feedback limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 41; index += 1) {
      lastResponse = await POST(
        buildRequest({
          itemId: "w_missing",
          rating: "positive",
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
        rating: "positive",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
