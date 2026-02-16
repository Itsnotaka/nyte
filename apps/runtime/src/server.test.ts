import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RuntimeCommand, RuntimeCommandResult } from "@workspace/contracts";

import { createRuntimeServerWithOptions } from "./server.js";

type RuntimeServerHandle = {
  baseUrl: string;
  close: () => Promise<void>;
};

type RuntimeServerStartOptions = {
  handleCommand?: (command: RuntimeCommand) => RuntimeCommandResult | Promise<RuntimeCommandResult>;
};

function createAcceptedResult(command: RuntimeCommand): RuntimeCommandResult {
  const receivedAt = "2026-02-16T12:00:00.000Z";
  if (command.type === "runtime.ingest") {
    return {
      status: "accepted",
      type: "runtime.ingest",
      requestId: command.context.requestId,
      receivedAt,
      result: {
        cursor: "2026-02-16T11:59:00.000Z",
        queuedCount: 0,
      },
    };
  }

  if (command.type === "runtime.approve") {
    return {
      status: "accepted",
      type: "runtime.approve",
      requestId: command.context.requestId,
      receivedAt,
      result: {
        itemId: command.payload.itemId,
        idempotent: false,
      },
    };
  }

  if (command.type === "runtime.dismiss") {
    return {
      status: "accepted",
      type: "runtime.dismiss",
      requestId: command.context.requestId,
      receivedAt,
      result: {
        itemId: command.payload.itemId,
      },
    };
  }

  return {
    status: "accepted",
    type: "runtime.feedback",
    requestId: command.context.requestId,
    receivedAt,
    result: {
      itemId: command.payload.itemId,
      rating: command.payload.rating,
    },
  };
}

async function startRuntimeServer(
  options: RuntimeServerStartOptions = {},
): Promise<RuntimeServerHandle> {
  const server = createRuntimeServerWithOptions({
    handleCommand: options.handleCommand ?? createAcceptedResult,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, () => {
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve runtime server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

const activeServers: Array<() => Promise<void>> = [];
const originalRuntimeAuthToken = process.env.NYTE_RUNTIME_AUTH_TOKEN;

beforeEach(() => {
  delete process.env.NYTE_RUNTIME_AUTH_TOKEN;
});

afterEach(async () => {
  while (activeServers.length > 0) {
    const close = activeServers.pop();
    if (close) {
      await close();
    }
  }

  if (originalRuntimeAuthToken === undefined) {
    delete process.env.NYTE_RUNTIME_AUTH_TOKEN;
  } else {
    process.env.NYTE_RUNTIME_AUTH_TOKEN = originalRuntimeAuthToken;
  }
});

describe("runtime server", () => {
  it("returns 401 when runtime auth token is required and missing", async () => {
    process.env.NYTE_RUNTIME_AUTH_TOKEN = "runtime-token-123";
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        context: {
          userId: "local-user",
          requestId: "req_approve_1",
          source: "web",
          issuedAt: "2026-02-16T12:00:00.000Z",
        },
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toContain("Unauthorized");
  });

  it("accepts runtime command when auth token matches", async () => {
    process.env.NYTE_RUNTIME_AUTH_TOKEN = "runtime-token-123";
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer runtime-token-123",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        context: {
          userId: "local-user",
          requestId: "req_approve_1",
          source: "web",
          issuedAt: "2026-02-16T12:00:00.000Z",
        },
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as {
      status: string;
      type?: string;
      result?: {
        itemId?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("accepted");
    expect(body.type).toBe("runtime.approve");
    expect(body.result?.itemId).toBe("w_1");
    expect(response.headers.get("x-request-id")).toBe("req_approve_1");
  });

  it("accepts valid runtime commands on type-specific endpoints", async () => {
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        context: {
          userId: "local-user",
          requestId: "req_approve_1",
          source: "web",
          issuedAt: "2026-02-16T12:00:00.000Z",
        },
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as {
      status: string;
      type?: string;
      result?: {
        itemId?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("accepted");
    expect(body.type).toBe("runtime.approve");
    expect(body.result?.itemId).toBe("w_1");
  });

  it("accepts valid runtime commands", async () => {
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/command`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        context: {
          userId: "local-user",
          requestId: "req_approve_1",
          source: "web",
          issuedAt: "2026-02-16T12:00:00.000Z",
        },
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as {
      status: string;
      type?: string;
      result?: {
        itemId?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("accepted");
    expect(body.type).toBe("runtime.approve");
    expect(body.result?.itemId).toBe("w_1");
  });

  it("returns 400 when endpoint and command type do not match", async () => {
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/dismiss`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        context: {
          userId: "local-user",
          requestId: "req_mismatch_1",
          source: "web",
          issuedAt: "2026-02-16T12:00:00.000Z",
        },
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("does not match endpoint");
    expect(response.headers.get("x-request-id")).toBe("req_mismatch_1");
  });

  it("returns 400 for invalid JSON payloads", async () => {
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/command`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{bad-json",
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Unable to parse JSON body");
  });

  it("returns 400 for payloads that fail runtime command contract", async () => {
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/command`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("RuntimeCommand contract");
  });

  it("returns 500 when runtime command handler throws", async () => {
    const server = await startRuntimeServer({
      handleCommand: async () => {
        throw new Error("handler exploded");
      },
    });
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/approve`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "runtime.approve",
        context: {
          userId: "local-user",
          requestId: "req_approve_1",
          source: "web",
          issuedAt: "2026-02-16T12:00:00.000Z",
        },
        payload: {
          itemId: "w_1",
        },
      }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toContain("Failed to process runtime command");
    expect(response.headers.get("x-request-id")).toBe("req_approve_1");
  });

  it("returns 404 for unknown paths", async () => {
    const server = await startRuntimeServer();
    activeServers.push(server.close);

    const response = await fetch(`${server.baseUrl}/runtime/unknown`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not found.");
  });
});
