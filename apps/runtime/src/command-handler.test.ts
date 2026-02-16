import { describe, expect, it } from "vitest";

import type { RuntimeCommand } from "@workspace/contracts";

import { handleRuntimeCommand } from "./command-handler.js";

const baseContext: RuntimeCommand["context"] = {
  userId: "local-user",
  requestId: "req_123",
  source: "web",
  issuedAt: "2026-02-16T00:00:00.000Z",
};

describe("handleRuntimeCommand", () => {
  it("returns ingest acceptance payload", () => {
    const result = handleRuntimeCommand(
      {
        type: "runtime.ingest",
        context: baseContext,
        payload: {
          cursor: "2026-02-15T00:00:00.000Z",
          watchKeywords: ["renewal"],
        },
      },
      new Date("2026-02-16T12:00:00.000Z"),
    );

    expect(result).toEqual({
      status: "accepted",
      type: "runtime.ingest",
      requestId: "req_123",
      receivedAt: "2026-02-16T12:00:00.000Z",
      result: {
        cursor: "2026-02-15T00:00:00.000Z",
        queuedCount: 0,
      },
    });
  });

  it("returns approve acceptance payload", () => {
    const result = handleRuntimeCommand(
      {
        type: "runtime.approve",
        context: baseContext,
        payload: {
          itemId: "w_1",
          idempotencyKey: "approve:w_1",
        },
      },
      new Date("2026-02-16T12:00:00.000Z"),
    );

    expect(result).toEqual({
      status: "accepted",
      type: "runtime.approve",
      requestId: "req_123",
      receivedAt: "2026-02-16T12:00:00.000Z",
      result: {
        itemId: "w_1",
        idempotent: false,
      },
    });
  });
});
