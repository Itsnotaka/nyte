import { afterEach, describe, expect, it } from "vitest";

import { createRuntimeServer } from "./server.js";

type RuntimeServerHandle = {
  baseUrl: string;
  close: () => Promise<void>;
};

async function startRuntimeServer(): Promise<RuntimeServerHandle> {
  const server = createRuntimeServer();
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

afterEach(async () => {
  while (activeServers.length > 0) {
    const close = activeServers.pop();
    if (close) {
      await close();
    }
  }
});

describe("runtime server", () => {
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
