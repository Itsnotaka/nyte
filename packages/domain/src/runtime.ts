export type RuntimePromptPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "contact";
      email: string;
      display: string;
      contactId?: string;
    }
  | {
      type: "file";
      path: string;
      display?: string;
    };

export type RuntimeRiskLevel = "low" | "medium" | "high";

export type RuntimeRunStatus =
  | "awaiting_follow_up"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type RuntimeFlowTriggerType = "manual" | "event" | "schedule";

export type RuntimeRetrievalHit = {
  sourceType: string;
  sourceId: string;
  summary: string;
  score: number;
  whyRelevant: string;
};

export type RuntimeProposal = {
  type: "draft" | "calendar" | "refund";
  source: "Gmail" | "Google Calendar";
  summary: string;
  context: string;
  actionLabel: string;
  secondaryLabel: string;
  cta: "Send email" | "Create event" | "Queue refund";
  preview: string;
  riskLevel: RuntimeRiskLevel;
  suggestionText: string;
  suggestedContactEmail?: string;
};

export type RuntimeConversationTurn = {
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export type RuntimeActionExecution = {
  destination: "gmail_sent" | "google_calendar" | "refund_queue";
  providerReference: string;
  idempotencyKey: string;
  executedAt: number;
};

export type RuntimeResult = {
  status: RuntimeRunStatus;
  proposal: RuntimeProposal;
  followUpQuestion?: string;
  executionPreview: string;
  riskLevel: RuntimeRiskLevel;
  retrievalHits: RuntimeRetrievalHit[];
};
