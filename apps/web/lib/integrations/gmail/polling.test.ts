import { describe, expect, it } from "vitest";

import { pollGmailIngestion } from "./polling";

describe("pollGmailIngestion", () => {
  it("returns all mock snapshots on first poll", () => {
    const result = pollGmailIngestion({
      now: new Date("2026-01-20T12:00:00.000Z"),
    });

    expect(result.signals).toHaveLength(3);
    expect(result.nextCursor).toBe("2026-01-20T12:00:00.000Z");
  });

  it("returns only records newer than cursor", () => {
    const result = pollGmailIngestion({
      cursor: "2026-01-20T10:30:00.000Z",
      now: new Date("2026-01-20T12:00:00.000Z"),
    });

    expect(result.signals).toHaveLength(2);
    expect(result.signals.map((signal) => signal.id)).toEqual(["gmail_board", "gmail_refund"]);
  });

  it("maps refund subject to refund_request intent", () => {
    const result = pollGmailIngestion({
      cursor: "2026-01-20T11:15:00.000Z",
      now: new Date("2026-01-20T12:00:00.000Z"),
    });

    expect(result.signals[0]).toBeDefined();
    expect(result.signals[0]!.intent).toBe("refund_request");
  });

  it("marks signals that match watch keywords", () => {
    const result = pollGmailIngestion({
      now: new Date("2026-01-20T12:00:00.000Z"),
      watchKeywords: ["term sheet", "board"],
    });

    const renewal = result.signals.find((signal) => signal.id === "gmail_renewal");
    const board = result.signals.find((signal) => signal.id === "gmail_board");
    const refund = result.signals.find((signal) => signal.id === "gmail_refund");

    expect(renewal?.watchMatched).toBe(true);
    expect(board?.watchMatched).toBe(true);
    expect(refund?.watchMatched).toBe(false);
  });
});
