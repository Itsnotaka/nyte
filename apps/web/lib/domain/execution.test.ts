import { describe, expect, it } from "vitest";

import { executeProposedAction } from "./execution";

describe("executeProposedAction", () => {
  it("routes gmail draft payloads to gmail_drafts destination", () => {
    const result = executeProposedAction(
      {
        kind: "gmail.createDraft",
        to: ["david.kim@example.com"],
        subject: "Re: renewal",
        body: "Draft body",
      },
      new Date("2026-01-20T12:00:00.000Z"),
    );

    expect(result.destination).toBe("gmail_drafts");
    expect(result.providerReference).toContain("gmail_drafts_");
    expect(result.executedAt).toBe("2026-01-20T12:00:00.000Z");
  });

  it("routes calendar payloads to google_calendar destination", () => {
    const result = executeProposedAction({
      kind: "google-calendar.createEvent",
      title: "Board sync",
      startsAt: "2026-01-22T14:00:00.000Z",
      endsAt: "2026-01-22T15:00:00.000Z",
      attendees: ["rachel@company.com"],
      description: "Quarterly board sync",
    });

    expect(result.destination).toBe("google_calendar");
  });

  it("routes refund payloads to refund queue destination", () => {
    const result = executeProposedAction({
      kind: "billing.queueRefund",
      customerName: "Joe",
      amount: 20,
      currency: "USD",
      reason: "Integration unavailable",
    });

    expect(result.destination).toBe("refund_queue");
  });
});
