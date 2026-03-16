export type CommandRunState = {
  runId: string;
  status: "awaiting_follow_up" | "awaiting_approval";
  followUpQuestion?: string;
  proposal: {
    summary: string;
    preview: string;
    riskLevel: "low" | "medium" | "high";
    suggestionText: string;
    suggestedContactEmail?: string;
    cta: "Send email" | "Create event" | "Queue refund";
    payload: {
      kind: "gmail.createDraft" | "google-calendar.createEvent" | "billing.queueRefund";
    };
  };
  retrievalHits: Array<{
    sourceType: string;
    sourceId: string;
    summary: string;
    score: number;
    whyRelevant: string;
  }>;
};
