import { describe, expect, it } from "vitest";

import { InvalidJsonBodyError, readJsonBody, readOptionalJsonBody } from "./json-body";

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

describe("readOptionalJsonBody", () => {
  it("returns fallback when body is empty", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "",
    });

    const body = await readOptionalJsonBody<{ value: string }>(request, {
      value: "fallback",
    });
    expect(body.value).toBe("fallback");
  });

  it("parses valid payload when body is present", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        value: "provided",
      }),
    });

    const body = await readOptionalJsonBody<{ value: string }>(request, {
      value: "fallback",
    });
    expect(body.value).toBe("provided");
  });

  it("throws InvalidJsonBodyError for malformed payload", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad-json",
    });

    await expect(readOptionalJsonBody(request, {})).rejects.toBeInstanceOf(InvalidJsonBodyError);
  });
});
