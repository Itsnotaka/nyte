import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeCommand } from "@workspace/contracts";

import {
  dispatchRuntimeCommand,
  RuntimeClientConfigurationError,
  RuntimeCommandDispatchError,
} from "./runtime-client";

const originalRuntimeUrl = process.env.NYTE_RUNTIME_URL;
const originalRuntimeAuthToken = process.env.NYTE_RUNTIME_AUTH_TOKEN;

const baseCommand: RuntimeCommand = {
  type: "runtime.approve",
  context: {
    userId: "local-user",
    requestId: "req_123",
    source: "web",
    issuedAt: "2026-02-16T12:00:00.000Z",
  },
  payload: {
    itemId: "w_123",
  },
};

afterEach(() => {
  if (originalRuntimeUrl === undefined) {
    delete process.env.NYTE_RUNTIME_URL;
  } else {
    process.env.NYTE_RUNTIME_URL = originalRuntimeUrl;
  }

  if (originalRuntimeAuthToken === undefined) {
    delete process.env.NYTE_RUNTIME_AUTH_TOKEN;
  } else {
    process.env.NYTE_RUNTIME_AUTH_TOKEN = originalRuntimeAuthToken;
  }
});

function toFetchUrl(input: Parameters<typeof fetch>[0]) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function readAuthorizationHeader(init: Parameters<typeof fetch>[1] | undefined) {
  const headers = init?.headers;
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get("authorization");
  }

  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === "authorization");
    return entry?.[1] ?? null;
  }

  if (typeof headers === "object") {
    return (
      (headers as Record<string, string>)["authorization"] ??
      (headers as Record<string, string>)["Authorization"] ??
      null
    );
  }

  return null;
}

describe("dispatchRuntimeCommand", () => {
  it("returns configuration error when runtime url is missing", async () => {
    delete process.env.NYTE_RUNTIME_URL;

    const result = await dispatchRuntimeCommand(baseCommand);
    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }

    expect(result.error).toBeInstanceOf(RuntimeClientConfigurationError);
    expect(result.error.message).toBe("NYTE_RUNTIME_URL is required for runtime delegation.");
  });

  it("returns accepted runtime result when command succeeds", async () => {
    let calledUrl: string | null = null;
    const fetchImpl: typeof fetch = async (input) => {
      calledUrl = toFetchUrl(input);
      return new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.approve",
          requestId: "req_123",
          receivedAt: "2026-02-16T12:00:00.000Z",
          result: {
            itemId: "w_123",
            idempotent: false,
          },
        }),
        { status: 200 },
      );
    };

    const result = await dispatchRuntimeCommand(baseCommand, {
      runtimeBaseUrl: "https://runtime.nyte.dev",
      fetchImpl,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.status).toBe("accepted");
    if (result.value.status === "error") {
      return;
    }
    expect(result.value.type).toBe("runtime.approve");
    expect(calledUrl).toBe("https://runtime.nyte.dev/runtime/approve");
  });

  it("routes ingest commands to runtime ingest endpoint", async () => {
    let calledUrl: string | null = null;
    const fetchImpl: typeof fetch = async (input) => {
      calledUrl = toFetchUrl(input);
      return new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.ingest",
          requestId: "req_123",
          receivedAt: "2026-02-16T12:00:00.000Z",
          result: {
            cursor: "2026-02-16T12:00:00.000Z",
            queuedCount: 0,
          },
        }),
        { status: 200 },
      );
    };

    const result = await dispatchRuntimeCommand(
      {
        type: "runtime.ingest",
        context: baseCommand.context,
        payload: {},
      },
      {
        runtimeBaseUrl: "https://runtime.nyte.dev",
        fetchImpl,
      },
    );

    expect(result.isOk()).toBe(true);
    expect(calledUrl).toBe("https://runtime.nyte.dev/runtime/ingest");
  });

  it("includes runtime auth token header when configured", async () => {
    let authorizationHeader: string | null = null;
    const fetchImpl: typeof fetch = async (_, init) => {
      authorizationHeader = readAuthorizationHeader(init);
      return new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.approve",
          requestId: "req_123",
          receivedAt: "2026-02-16T12:00:00.000Z",
          result: {
            itemId: "w_123",
            idempotent: false,
          },
        }),
        { status: 200 },
      );
    };

    const result = await dispatchRuntimeCommand(baseCommand, {
      runtimeBaseUrl: "https://runtime.nyte.dev",
      runtimeAuthToken: "runtime-token-123",
      fetchImpl,
    });

    expect(result.isOk()).toBe(true);
    expect(authorizationHeader).toBe("Bearer runtime-token-123");
  });

  it("uses NYTE_RUNTIME_AUTH_TOKEN when runtime auth option is omitted", async () => {
    process.env.NYTE_RUNTIME_AUTH_TOKEN = "env-runtime-token";
    let authorizationHeader: string | null = null;
    const fetchImpl: typeof fetch = async (_, init) => {
      authorizationHeader = readAuthorizationHeader(init);
      return new Response(
        JSON.stringify({
          status: "accepted",
          type: "runtime.approve",
          requestId: "req_123",
          receivedAt: "2026-02-16T12:00:00.000Z",
          result: {
            itemId: "w_123",
            idempotent: false,
          },
        }),
        { status: 200 },
      );
    };

    const result = await dispatchRuntimeCommand(baseCommand, {
      runtimeBaseUrl: "https://runtime.nyte.dev",
      fetchImpl,
    });

    expect(result.isOk()).toBe(true);
    expect(authorizationHeader).toBe("Bearer env-runtime-token");
  });

  it("maps non-ok runtime responses into dispatch errors", async () => {
    const fetchImpl: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: "Runtime unavailable." }), {
        status: 503,
      });
    };

    const result = await dispatchRuntimeCommand(baseCommand, {
      runtimeBaseUrl: "https://runtime.nyte.dev",
      fetchImpl,
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }

    expect(result.error).toBeInstanceOf(RuntimeCommandDispatchError);
    expect(result.error.message).toBe("Runtime unavailable.");
  });

  it("rejects malformed success payloads that violate contracts", async () => {
    const fetchImpl: typeof fetch = async () => {
      return new Response(JSON.stringify({ status: "accepted", type: "runtime.approve" }), {
        status: 200,
      });
    };

    const result = await dispatchRuntimeCommand(baseCommand, {
      runtimeBaseUrl: "https://runtime.nyte.dev",
      fetchImpl,
    });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      return;
    }

    expect(result.error).toBeInstanceOf(RuntimeCommandDispatchError);
    expect(result.error.message).toBe("Runtime service returned an invalid command result.");
  });
});
