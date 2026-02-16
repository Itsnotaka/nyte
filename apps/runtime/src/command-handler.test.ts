import { describe, expect, it } from "vitest";
import { ApprovalError } from "@nyte/application/approve-action";
import type { RuntimeCommand } from "@nyte/contracts";

import {
  createRuntimeCommandHandler,
  handleRuntimeCommand,
  type RuntimeCommandHandlerDeps,
} from "./command-handler.js";

const baseContext: RuntimeCommand["context"] = {
  userId: "local-user",
  requestId: "req_123",
  source: "web",
  issuedAt: "2026-02-16T00:00:00.000Z",
};

function createDeps(overrides: Partial<RuntimeCommandHandlerDeps> = {}): RuntimeCommandHandlerDeps {
  return {
    pollGmailIngestion: () => ({
      nextCursor: "2026-02-16T11:55:00.000Z",
      signals: [],
    }),
    persistSignals: async () => [{ id: "w_1" } as never],
    approveWorkItem: async (itemId) => {
      return {
        itemId,
        idempotent: false,
      } as Awaited<ReturnType<RuntimeCommandHandlerDeps["approveWorkItem"]>>;
    },
    dismissWorkItem: async (itemId) => {
      return {
        itemId,
        status: "dismissed",
        dismissedAt: "2026-02-16T12:00:00.000Z",
        idempotent: false,
      } as Awaited<ReturnType<RuntimeCommandHandlerDeps["dismissWorkItem"]>>;
    },
    recordFeedback: async (itemId, rating) => {
      return {
        itemId,
        rating,
        notedAt: "2026-02-16T12:00:00.000Z",
      } as Awaited<ReturnType<RuntimeCommandHandlerDeps["recordFeedback"]>>;
    },
    ...overrides,
  };
}

describe("createRuntimeCommandHandler", () => {
  it("returns ingest acceptance payload with persisted queue count", async () => {
    const handler = createRuntimeCommandHandler(
      createDeps({
        pollGmailIngestion: () => ({
          nextCursor: "2026-02-15T00:00:00.000Z",
          signals: [
            {
              id: "gmail_1",
              source: "Gmail",
              actor: "Dana",
              summary: "Need approval",
              context: "Please approve",
              preview: "Please approve",
              intent: "draft_reply",
              requiresDecision: true,
            },
          ],
        }),
        persistSignals: async () => [{ id: "w_renewal" } as never, { id: "w_board" } as never],
      }),
    );

    const result = await handler(
      {
        type: "runtime.ingest",
        context: baseContext,
        payload: {
          cursor: "2026-02-14T00:00:00.000Z",
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
        queuedCount: 2,
      },
    });
  });

  it("maps known mutation errors to runtime conflict errors", async () => {
    const handler = createRuntimeCommandHandler(
      createDeps({
        approveWorkItem: async () => {
          throw new ApprovalError("Work item is dismissed and cannot be approved.");
        },
      }),
    );

    const result = await handler(
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
      status: "error",
      requestId: "req_123",
      code: "conflict",
      message: "Work item is dismissed and cannot be approved.",
    });
  });

  it("executes ingest, approve, and feedback against shared services", async () => {
    const ingestResult = await handleRuntimeCommand(
      {
        type: "runtime.ingest",
        context: {
          ...baseContext,
          requestId: "req_ingest_live",
        },
        payload: {
          watchKeywords: ["refund", "board"],
        },
      },
      new Date("2026-02-17T09:00:00.000Z"),
    );
    expect(ingestResult.status).toBe("accepted");
    if (ingestResult.status === "error" || ingestResult.type !== "runtime.ingest") {
      return;
    }
    expect(ingestResult.result.queuedCount).toBeGreaterThan(0);

    const approveResult = await handleRuntimeCommand(
      {
        type: "runtime.approve",
        context: {
          ...baseContext,
          requestId: "req_approve_live",
        },
        payload: {
          itemId: "w_renewal",
          idempotencyKey: "approve-live-run",
        },
      },
      new Date("2026-02-17T09:01:00.000Z"),
    );
    expect(approveResult.status).toBe("accepted");
    if (approveResult.status === "error" || approveResult.type !== "runtime.approve") {
      return;
    }
    expect(approveResult.result.itemId).toBe("w_renewal");

    const feedbackResult = await handleRuntimeCommand(
      {
        type: "runtime.feedback",
        context: {
          ...baseContext,
          requestId: "req_feedback_live",
        },
        payload: {
          itemId: "w_renewal",
          rating: "positive",
          note: "Looks good",
        },
      },
      new Date("2026-02-17T09:02:00.000Z"),
    );
    expect(feedbackResult.status).toBe("accepted");
    if (feedbackResult.status === "error" || feedbackResult.type !== "runtime.feedback") {
      return;
    }
    expect(feedbackResult.result.itemId).toBe("w_renewal");
    expect(feedbackResult.result.rating).toBe("positive");
  });
});
