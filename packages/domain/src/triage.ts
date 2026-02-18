export type Gate = "decision" | "time" | "relationship" | "impact" | "watch";
export type WorkType = "draft" | "calendar" | "refund";
export type WorkSource = "Gmail" | "Google Calendar";

export type IntakeIntent = "draft_reply" | "schedule_event" | "refund_request";

export type IntakeSignal = {
  id: string;
  source: WorkSource;
  actor: string;
  summary: string;
  context: string;
  preview: string;
  intent: IntakeIntent;
  requiresDecision?: boolean;
  deadlineAt?: string;
  relationshipScore?: number;
  impactScore?: number;
  watchMatched?: boolean;
};

export type GateEvaluation = {
  gate: Gate;
  matched: boolean;
  reason: string;
  score: number;
};

export type WorkItem = {
  id: string;
  type: WorkType;
  source: WorkSource;
  actor: string;
  summary: string;
  context: string;
  actionLabel: string;
  secondaryLabel: string;
  cta: "Save draft" | "Create event" | "Queue refund";
  gates: Gate[];
  preview: string;
  priorityScore: number;
};

const HOUR = 1000 * 60 * 60;
const TWO_DAYS = HOUR * 48;

const GATE_WEIGHTS: Record<Gate, number> = {
  decision: 5,
  time: 4,
  relationship: 3,
  impact: 4,
  watch: 2,
};

export const GATE_LABEL: Record<Gate, string> = {
  decision: "Decision",
  time: "Time",
  relationship: "Relationship",
  impact: "Impact",
  watch: "Watch",
};

function evaluateTimeGate(
  deadlineAt: string | undefined,
  now: Date
): GateEvaluation {
  if (!deadlineAt) {
    return {
      gate: "time",
      matched: false,
      reason: "No explicit deadline.",
      score: 0,
    };
  }

  const deadline = new Date(deadlineAt);
  const delta = deadline.getTime() - now.getTime();
  const matched = Number.isFinite(delta) && delta <= TWO_DAYS;

  return {
    gate: "time",
    matched,
    reason: matched
      ? "Deadline is within 48 hours."
      : "Deadline exists but is not urgent.",
    score: matched ? GATE_WEIGHTS.time : 0,
  };
}

export function evaluateApprovalGates(
  signal: IntakeSignal,
  now = new Date()
): GateEvaluation[] {
  const decision: GateEvaluation = {
    gate: "decision",
    matched: Boolean(signal.requiresDecision),
    reason: signal.requiresDecision
      ? "Only owner can approve this action."
      : "No owner decision required.",
    score: signal.requiresDecision ? GATE_WEIGHTS.decision : 0,
  };

  const time = evaluateTimeGate(signal.deadlineAt, now);

  const relationshipMatched = (signal.relationshipScore ?? 0) >= 0.75;
  const relationship: GateEvaluation = {
    gate: "relationship",
    matched: relationshipMatched,
    reason: relationshipMatched
      ? "High relationship sensitivity detected."
      : "Relationship sensitivity below threshold.",
    score: relationshipMatched ? GATE_WEIGHTS.relationship : 0,
  };

  const impactMatched = (signal.impactScore ?? 0) >= 0.7;
  const impact: GateEvaluation = {
    gate: "impact",
    matched: impactMatched,
    reason: impactMatched
      ? "Material customer or revenue impact."
      : "Low impact signal.",
    score: impactMatched ? GATE_WEIGHTS.impact : 0,
  };

  const watch: GateEvaluation = {
    gate: "watch",
    matched: Boolean(signal.watchMatched),
    reason: signal.watchMatched
      ? "Matched explicit watch rule."
      : "No watch rule matched.",
    score: signal.watchMatched ? GATE_WEIGHTS.watch : 0,
  };

  return [decision, time, relationship, impact, watch];
}

function resolveType(intent: IntakeIntent): WorkType {
  if (intent === "schedule_event") {
    return "calendar";
  }

  if (intent === "refund_request") {
    return "refund";
  }

  return "draft";
}

function actionText(type: WorkType) {
  if (type === "calendar") {
    return {
      actionLabel: "Open scheduling form",
      secondaryLabel: "Decline",
      cta: "Create event" as const,
    };
  }

  if (type === "refund") {
    return {
      actionLabel: "Prepare refund response",
      secondaryLabel: "Dismiss",
      cta: "Queue refund" as const,
    };
  }

  return {
    actionLabel: "Review draft reply",
    secondaryLabel: "Dismiss",
    cta: "Save draft" as const,
  };
}

export function toWorkItem(
  signal: IntakeSignal,
  now = new Date()
): WorkItem | null {
  const evaluations = evaluateApprovalGates(signal, now);
  const matched = evaluations.filter((evaluation) => evaluation.matched);
  if (matched.length === 0) {
    return null;
  }

  const type = resolveType(signal.intent);
  const actions = actionText(type);
  const priorityScore = matched.reduce(
    (total, evaluation) => total + evaluation.score,
    0
  );

  return {
    id: signal.id,
    type,
    source: signal.source,
    actor: signal.actor,
    summary: signal.summary,
    context: signal.context,
    preview: signal.preview,
    actionLabel: actions.actionLabel,
    secondaryLabel: actions.secondaryLabel,
    cta: actions.cta,
    gates: matched.map((entry) => entry.gate),
    priorityScore,
  };
}

export function createApprovalQueue(
  signals: IntakeSignal[],
  now = new Date()
): WorkItem[] {
  return signals
    .map((signal) => toWorkItem(signal, now))
    .filter((item): item is WorkItem => item !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
