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
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe(42);
    }
  });

  it("returns InvalidJsonBodyError for malformed json", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad-json",
    });

    const body = await readJsonBody(request);
    expect(body.isErr()).toBe(true);
    if (body.isErr()) {
      expect(body.error).toBeInstanceOf(InvalidJsonBodyError);
    }
  });

  it("returns UnsupportedMediaTypeError for non-json content-type", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "value=42",
    });

    const body = await readJsonBody(request);
    expect(body.isErr()).toBe(true);
    if (body.isErr()) {
      expect(body.error).toBeInstanceOf(UnsupportedMediaTypeError);
    }
  });

  it("accepts structured json media types", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/merge-patch+json",
      },
      body: JSON.stringify({
        value: 7,
      }),
    });

    const body = await readJsonBody<{ value: number }>(request);
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe(7);
    }
  });

  it("parses UTF-8 BOM prefixed json payload", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: `\ufeff${JSON.stringify({
        value: 11,
      })}`,
    });

    const body = await readJsonBody<{ value: number }>(request);
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe(11);
    }
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
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe("fallback");
    }
  });

  it("returns fallback when body is whitespace-only", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "   \n\t",
    });

    const body = await readOptionalJsonBody<{ value: string }>(request, {
      value: "fallback",
    });
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe("fallback");
    }
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
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe("provided");
    }
  });

  it("parses valid payload prefixed with UTF-8 BOM", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: `\ufeff${JSON.stringify({
        value: "provided",
      })}`,
    });

    const body = await readOptionalJsonBody<{ value: string }>(request, {
      value: "fallback",
    });
    expect(body.isOk()).toBe(true);
    if (body.isOk()) {
      expect(body.value.value).toBe("provided");
    }
  });

  it("returns InvalidJsonBodyError for malformed payload", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad-json",
    });

    const body = await readOptionalJsonBody(request, {});
    expect(body.isErr()).toBe(true);
    if (body.isErr()) {
      expect(body.error).toBeInstanceOf(InvalidJsonBodyError);
    }
  });

  it("returns UnsupportedMediaTypeError for non-json non-empty body", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "payload",
    });

    const body = await readOptionalJsonBody(request, {});
    expect(body.isErr()).toBe(true);
    if (body.isErr()) {
      expect(body.error).toBeInstanceOf(UnsupportedMediaTypeError);
    }
  });
});
