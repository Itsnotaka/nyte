import { describe, expect, it } from "vitest";

import { createToolCallPayload, withToolCalls } from "@nyte/domain/actions";
import type { WorkItem } from "@nyte/domain/triage";

const BASE_ITEM: WorkItem = {
  id: "base",
  type: "draft",
  source: "Gmail",
  actor: "David Kim",
  summary: "Signed term sheet attached.",
  context: "Context",
  preview: "Hi David, here is the draft reply...",
  actionLabel: "Review draft reply",
  secondaryLabel: "Dismiss",
  cta: "Save draft",
  gates: ["decision"],
  priorityScore: 5,
};

describe("createToolCallPayload", () => {
  it("creates gmail draft payload for draft work items", () => {
    const payload = createToolCallPayload(BASE_ITEM);
    expect(payload.kind).toBe("gmail.createDraft");
    if (payload.kind === "gmail.createDraft") {
      expect(payload.to[0]).toBe("david.kim@example.com");
      expect(payload.subject).toContain("Re:");
    }
  });

  it("creates calendar payload for calendar work items", () => {
    const payload = createToolCallPayload({
      ...BASE_ITEM,
      id: "calendar",
      type: "calendar",
      source: "Google Calendar",
      cta: "Create event",
    });

    expect(payload.kind).toBe("google-calendar.createEvent");
    if (payload.kind === "google-calendar.createEvent") {
      expect(payload.attendees).toContain("david.kim@example.com");
      expect(payload.startsAt).toBe("2026-01-22T14:00:00.000Z");
    }
  });

  it("creates refund payload with parsed amount", () => {
    const payload = createToolCallPayload({
      ...BASE_ITEM,
      id: "refund",
      type: "refund",
      preview: "Refund amount: $20. Draft includes apology.",
      cta: "Queue refund",
    });

    expect(payload.kind).toBe("billing.queueRefund");
    if (payload.kind === "billing.queueRefund") {
      expect(payload.amount).toBe(20);
      expect(payload.currency).toBe("USD");
    }
  });
});

describe("withToolCalls", () => {
  it("attaches payload to each work item", () => {
    const result = withToolCalls([BASE_ITEM]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    expect(result[0]!.proposedAction.kind).toBe("gmail.createDraft");
  });
});
