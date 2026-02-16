import { describe, expect, it } from "vitest";

import { createNeedsYouQueue, evaluateNeedsYou, toWorkItem, type IntakeSignal } from "./triage";

const BASE_SIGNAL: IntakeSignal = {
  id: "test",
  source: "Gmail",
  actor: "Example",
  summary: "Summary",
  context: "Context",
  preview: "Preview",
  intent: "draft_reply",
};

describe("evaluateNeedsYou", () => {
  it("matches decision gate when decision is required", () => {
    const evaluation = evaluateNeedsYou(
      {
        ...BASE_SIGNAL,
        requiresDecision: true,
      },
      new Date("2026-01-20T00:00:00.000Z"),
    );

    const decision = evaluation.find((item) => item.gate === "decision");
    expect(decision?.matched).toBe(true);
  });

  it("matches time gate when deadline is within 48 hours", () => {
    const evaluation = evaluateNeedsYou(
      {
        ...BASE_SIGNAL,
        deadlineAt: "2026-01-21T12:00:00.000Z",
      },
      new Date("2026-01-20T12:00:00.000Z"),
    );

    const time = evaluation.find((item) => item.gate === "time");
    expect(time?.matched).toBe(true);
  });

  it("does not match any gates for low-signal intake", () => {
    const item = toWorkItem(
      {
        ...BASE_SIGNAL,
        relationshipScore: 0.2,
        impactScore: 0.2,
      },
      new Date("2026-01-20T12:00:00.000Z"),
    );

    expect(item).toBeNull();
  });

  it("creates a prioritized queue sorted by total gate score", () => {
    const queue = createNeedsYouQueue(
      [
        {
          ...BASE_SIGNAL,
          id: "low",
          requiresDecision: true,
        },
        {
          ...BASE_SIGNAL,
          id: "high",
          requiresDecision: true,
          impactScore: 0.9,
          watchMatched: true,
        },
      ],
      new Date("2026-01-20T12:00:00.000Z"),
    );

    expect(queue.map((entry) => entry.id)).toEqual(["high", "low"]);
  });
});
