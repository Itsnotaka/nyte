import type { IntakeSignal } from "./triage";

export const mockIntakeSignals: IntakeSignal[] = [
  {
    id: "w_renewal",
    source: "Gmail",
    actor: "David Kim",
    summary: "Sent over the signed term sheet and asked for countersignature confirmation.",
    context: "Relationship context: strategic customer. Tone needs executive confidence.",
    preview:
      "Hi David — thanks for sending this through. I reviewed the terms and we are aligned to countersign by EOD...",
    intent: "draft_reply",
    requiresDecision: true,
    relationshipScore: 0.92,
    impactScore: 0.88,
    watchMatched: true,
  },
  {
    id: "w_board",
    source: "Google Calendar",
    actor: "Rachel Torres",
    summary: "Invited you to Quarterly Board Sync and requested updated agenda focus.",
    context: "Time context: meeting starts this week. Requires your decision on attendance + prep.",
    preview:
      "Proposed slot: Wed Jan 22, 2:00 PM. Agenda draft includes growth metrics and GTM follow-up.",
    intent: "schedule_event",
    requiresDecision: true,
    deadlineAt: "2026-01-22T14:00:00.000Z",
    relationshipScore: 0.81,
    impactScore: 0.72,
  },
  {
    id: "w_refund",
    source: "Gmail",
    actor: "Joe",
    summary: "Requested a refund because Notion integration is still unavailable.",
    context: "Impact context: customer trust risk if unresolved within 24 hours.",
    preview:
      "Refund amount: $20. Draft includes apology, refund timing, and integration roadmap update.",
    intent: "refund_request",
    deadlineAt: "2026-01-21T09:00:00.000Z",
    impactScore: 0.78,
    relationshipScore: 0.34,
  },
  {
    id: "w_digest_only",
    source: "Gmail",
    actor: "Newsletter Bot",
    summary: "Shared weekly industry digest.",
    context: "No action required.",
    preview: "Top 10 product launches this week.",
    intent: "draft_reply",
    relationshipScore: 0.1,
    impactScore: 0.1,
  },
];
