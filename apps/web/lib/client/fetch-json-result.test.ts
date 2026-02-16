import { describe, expect, it } from "vitest";

import { fetchJsonResult } from "@/lib/client/fetch-json-result";

describe("fetchJsonResult", () => {
  it("returns parsed payload when request succeeds", async () => {
    const result = await fetchJsonResult<{ ok: boolean }>(
      "http://localhost/api/test",
      undefined,
      "Unable to load data.",
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }
    expect(result.value).toEqual({ ok: true });
  });

  it("returns API-provided error message for non-ok responses", async () => {
    const result = await fetchJsonResult<{
      ok: boolean;
    }>(
      "http://localhost/api/test",
      undefined,
      "Unable to load data.",
      async () => new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429 }),
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }
    expect(result.error.message).toBe("Rate limit exceeded.");
  });

  it("falls back to provided error message when response body is unreadable", async () => {
    const result = await fetchJsonResult<{ ok: boolean }>(
      "http://localhost/api/test",
      undefined,
      "Unable to load data.",
      async () =>
        new Response("not-json", {
          status: 500,
          headers: {
            "content-type": "text/plain",
          },
        }),
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }
    expect(result.error.message).toBe("Unable to load data.");
  });

  it("returns fallback error when fetch throws a non-error", async () => {
    const result = await fetchJsonResult<{ ok: boolean }>(
      "http://localhost/api/test",
      undefined,
      "Unable to load data.",
      async () => {
        throw "network-down";
      },
    );

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }
    expect(result.error.message).toBe("Unable to load data.");
  });
});
