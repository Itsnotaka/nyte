import { describe, expect, it } from "vitest";

import {
  InvalidJsonBodyError,
  readJsonBody,
  readOptionalJsonBody,
  UnsupportedMediaTypeError,
} from "./json-body";

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

  it("throws UnsupportedMediaTypeError for non-json content-type", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "value=42",
    });

    await expect(readJsonBody(request)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
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

  it("returns fallback when body is whitespace-only", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "   \n\t",
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

  it("throws UnsupportedMediaTypeError for non-json non-empty body", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "payload",
    });

    await expect(readOptionalJsonBody(request, {})).rejects.toBeInstanceOf(
      UnsupportedMediaTypeError,
    );
  });
});
