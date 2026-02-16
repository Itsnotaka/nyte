import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditLogs, db, ensureDbSchema } from "@workspace/db";

import { recordAuditLog } from "@/lib/server/audit-log";
import { resetRateLimitState } from "@/lib/server/rate-limit";

import { GET } from "./route";

async function resetDb() {
  await ensureDbSchema();
  await db.delete(auditLogs);
}

function buildRequest(url: string) {
  return new Request(url, {
    headers: {
      "x-forwarded-for": "203.0.113.50",
    },
  });
}

describe("GET /api/admin/audit", () => {
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

  it("returns latest audit rows with limit applied", async () => {
    await recordAuditLog({
      action: "event.one",
      targetType: "work_item",
      targetId: "w_1",
      payload: { step: 1 },
      now: new Date("2026-02-10T10:00:00.000Z"),
    });
    await recordAuditLog({
      action: "event.two",
      targetType: "work_item",
      targetId: "w_2",
      payload: { step: 2 },
      now: new Date("2026-02-10T10:01:00.000Z"),
    });
    await recordAuditLog({
      action: "event.three",
      targetType: "work_item",
      targetId: "w_3",
      payload: { step: 3 },
      now: new Date("2026-02-10T10:02:00.000Z"),
    });

    const response = await GET(buildRequest("http://localhost/api/admin/audit?limit=2"));
    const body = (await response.json()) as {
      count: number;
      totalCount: number;
      hasMore: boolean;
      limit: number;
      offset: number;
      rows: Array<{ action: string; targetId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.count).toBe(2);
    expect(body.totalCount).toBe(3);
    expect(body.hasMore).toBe(true);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0]?.action).toBe("event.three");
    expect(body.rows[1]?.action).toBe("event.two");
  });

  it("supports pagination with offset", async () => {
    await recordAuditLog({
      action: "event.one",
      targetType: "work_item",
      targetId: "w_1",
      payload: {},
      now: new Date("2026-02-10T10:00:00.000Z"),
    });
    await recordAuditLog({
      action: "event.two",
      targetType: "work_item",
      targetId: "w_2",
      payload: {},
      now: new Date("2026-02-10T10:01:00.000Z"),
    });
    await recordAuditLog({
      action: "event.three",
      targetType: "work_item",
      targetId: "w_3",
      payload: {},
      now: new Date("2026-02-10T10:02:00.000Z"),
    });

    const response = await GET(buildRequest("http://localhost/api/admin/audit?limit=1&offset=1"));
    const body = (await response.json()) as {
      count: number;
      totalCount: number;
      hasMore: boolean;
      limit: number;
      offset: number;
      rows: Array<{ action: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.totalCount).toBe(3);
    expect(body.hasMore).toBe(true);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(1);
    expect(body.rows[0]?.action).toBe("event.two");
  });

  it("returns empty page when offset exceeds total rows", async () => {
    await recordAuditLog({
      action: "event.one",
      targetType: "work_item",
      targetId: "w_1",
      payload: {},
      now: new Date("2026-02-10T10:00:00.000Z"),
    });

    const response = await GET(buildRequest("http://localhost/api/admin/audit?limit=10&offset=50"));
    const body = (await response.json()) as {
      count: number;
      totalCount: number;
      hasMore: boolean;
      rows: Array<unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.count).toBe(0);
    expect(body.totalCount).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.rows).toHaveLength(0);
  });

  it("filters rows by targetType and targetId", async () => {
    await recordAuditLog({
      action: "event.match",
      targetType: "work_item",
      targetId: "w_match",
      payload: {},
    });
    await recordAuditLog({
      action: "event.other",
      targetType: "work_item",
      targetId: "w_other",
      payload: {},
    });

    const response = await GET(
      buildRequest(
        "http://localhost/api/admin/audit?targetType=work_item&targetId=w_match&limit=10",
      ),
    );
    const body = (await response.json()) as {
      count: number;
      totalCount: number;
      hasMore: boolean;
      limit: number;
      offset: number;
      rows: Array<{ action: string; targetId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.totalCount).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
    expect(body.rows[0]?.targetId).toBe("w_match");
  });

  it("trims target filters before querying", async () => {
    await recordAuditLog({
      action: "event.match",
      targetType: "work_item",
      targetId: "w_match",
      payload: {},
    });

    const response = await GET(
      buildRequest(
        "http://localhost/api/admin/audit?targetType=%20work_item%20&targetId=%20w_match%20",
      ),
    );
    const body = (await response.json()) as {
      count: number;
      rows: Array<{ targetType: string; targetId: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.rows[0]?.targetType).toBe("work_item");
    expect(body.rows[0]?.targetId).toBe("w_match");
  });

  it("rejects incomplete target filters", async () => {
    const response = await GET(
      buildRequest("http://localhost/api/admin/audit?targetType=work_item"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("must be provided together");
  });

  it("rejects effectively empty target filters after trimming", async () => {
    const response = await GET(
      buildRequest("http://localhost/api/admin/audit?targetType=%20%20%20&targetId=w_1"),
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("must be provided together");
  });

  it("returns 429 and retry-after when rate limit is exceeded", async () => {
    let lastResponse: Response | null = null;
    for (let index = 0; index < 61; index += 1) {
      lastResponse = await GET(buildRequest("http://localhost/api/admin/audit?limit=1"));
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });

  it("normalizes invalid pagination inputs", async () => {
    await recordAuditLog({
      action: "event.one",
      targetType: "work_item",
      targetId: "w_1",
      payload: {},
    });

    const response = await GET(
      buildRequest("http://localhost/api/admin/audit?limit=1000&offset=-10"),
    );
    const body = (await response.json()) as {
      limit: number;
      offset: number;
      count: number;
    };

    expect(response.status).toBe(200);
    expect(body.limit).toBe(500);
    expect(body.offset).toBe(0);
    expect(body.count).toBe(1);
  });

  it("returns 401 when authz is enforced and no session is present", async () => {
    process.env.NYTE_REQUIRE_AUTH = "true";
    const response = await GET(buildRequest("http://localhost/api/admin/audit"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Authentication required");
  });
});
