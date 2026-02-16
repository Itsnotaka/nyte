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
import { mockIntakeSignals } from "@workspace/domain/mock-intake";

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
  requestHeaders.set("x-forwarded-for", "198.51.100.44");

  return new Request("http://localhost/api/actions/dismiss", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
}

describe("POST /api/actions/dismiss", () => {
  const originalRequireAuth = process.env.NYTE_REQUIRE_AUTH;
  const originalRuntimeDelegateDismiss = process.env.NYTE_RUNTIME_DELEGATE_DISMISS;
  const originalRuntimeUrl = process.env.NYTE_RUNTIME_URL;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    process.env.NYTE_REQUIRE_AUTH = "false";
    delete process.env.NYTE_RUNTIME_DELEGATE_DISMISS;
    delete process.env.NYTE_RUNTIME_URL;
    globalThis.fetch = originalFetch;
    resetRateLimitState();
    await resetDb();
  });

  afterEach(() => {
    if (originalRequireAuth === undefined) {
      delete process.env.NYTE_REQUIRE_AUTH;
    } else {
      process.env.NYTE_REQUIRE_AUTH = originalRequireAuth;
    }

    if (originalRuntimeDelegateDismiss === undefined) {
      delete process.env.NYTE_RUNTIME_DELEGATE_DISMISS;
    } else {
      process.env.NYTE_RUNTIME_DELEGATE_DISMISS = originalRuntimeDelegateDismiss;
    }

    if (originalRuntimeUrl === undefined) {
      delete process.env.NYTE_RUNTIME_URL;
    } else {
      process.env.NYTE_RUNTIME_URL = originalRuntimeUrl;
    }

    globalThis.fetch = originalFetch;
  });

  it("dismisses a seeded work item", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    const response = await POST(
      buildRequest({
        itemId: "w_board",
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      dismissedAt: string;
      idempotent?: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_board");
    expect(body.idempotent).toBeFalsy();
    expect(body.dismissedAt).toBeTruthy();
  });

  it("returns 400 when itemId is missing", async () => {
    const response = await POST(buildRequest({}));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("itemId is required");
  });

  it("returns 400 when itemId is whitespace-only", async () => {
    const response = await POST(
      buildRequest({
        itemId: "   ",
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
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("itemId must be a string");
  });

  it("returns 400 when request body is not a JSON object", async () => {
    const response = await POST(
      new Request("http://localhost/api/actions/dismiss", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.49",
        },
        body: JSON.stringify(["w_board"]),
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("JSON object");
  });

  it("returns 400 for malformed json body", async () => {
    const response = await POST(
      new Request("http://localhost/api/actions/dismiss", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.45",
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
      new Request("http://localhost/api/actions/dismiss", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "x-forwarded-for": "198.51.100.46",
        },
        body: "itemId=w_board",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(415);
    expect(body.error).toContain("application/json");
  });

  it("accepts structured +json content-type", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    const response = await POST(
      new Request("http://localhost/api/actions/dismiss", {
        method: "POST",
        headers: {
          "content-type": "application/merge-patch+json",
          "x-forwarded-for": "198.51.100.47",
        },
        body: JSON.stringify({
          itemId: "w_board",
        }),
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_board");
    expect(body.status).toBe("dismissed");
  });

  it("accepts UTF-8 BOM prefixed json payload", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    const response = await POST(
      new Request("http://localhost/api/actions/dismiss", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.48",
        },
        body: `\ufeff${JSON.stringify({
          itemId: "w_board",
        })}`,
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_board");
    expect(body.status).toBe("dismissed");
  });

  it("returns idempotent true on repeated dismiss", async () => {
    await persistSignals(mockIntakeSignals, new Date("2026-02-10T10:00:00.000Z"));

    await POST(
      buildRequest({
        itemId: "w_board",
      }),
    );
    const secondResponse = await POST(
      buildRequest({
        itemId: "w_board",
      }),
    );
    const secondBody = (await secondResponse.json()) as {
      status: string;
      idempotent: boolean;
    };

    expect(secondResponse.status).toBe(200);
    expect(secondBody.status).toBe("dismissed");
    expect(secondBody.idempotent).toBe(true);
  });

  it("returns 502 when dismiss delegation is enabled without runtime url", async () => {
    process.env.NYTE_RUNTIME_DELEGATE_DISMISS = "true";
    delete process.env.NYTE_RUNTIME_URL;

    const response = await POST(
      buildRequest({
        itemId: "w_board",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toContain("NYTE_RUNTIME_URL is required");
  });

  it("returns delegated dismiss ack when runtime delegation is enabled", async () => {
    process.env.NYTE_RUNTIME_DELEGATE_DISMISS = "true";
    process.env.NYTE_RUNTIME_URL = "https://runtime.nyte.dev";
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.dismiss",
          requestId: "req_dismiss_123",
          receivedAt: "2026-02-16T12:00:00.000Z",
          result: {
            itemId: "w_board",
          },
        }),
        { status: 200 },
      );

    const response = await POST(
      buildRequest({
        itemId: "w_board",
      }),
    );
    const body = (await response.json()) as {
      itemId: string;
      status: string;
      idempotent: boolean;
      delegated: boolean;
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(body.itemId).toBe("w_board");
    expect(body.status).toBe("dismissed");
    expect(body.idempotent).toBe(false);
    expect(body.delegated).toBe(true);
    expect(body.requestId).toBe("req_dismiss_123");
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

  it("returns 429 when dismiss rate limit is exceeded", async () => {
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
        itemId: "w_board",
      }),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
