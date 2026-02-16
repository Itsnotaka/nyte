import { describe, expect, it } from "vitest";

import { InvalidJsonBodyError, readJsonBody } from "./json-body";

describe("readJsonBody", () => {
  it("parses valid json payload", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: 42,
      }),
    });

    const body = await readJsonBody<{ value: number }>(request);
    expect(body.value).toBe(42);
  });

  it("throws InvalidJsonBodyError for malformed json", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad-json",
    });

    await expect(readJsonBody(request)).rejects.toBeInstanceOf(InvalidJsonBodyError);
  });
});
