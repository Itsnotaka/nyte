import {
  PI_RUNTIME_AI_PROVIDERS,
  type ImportanceClassificationRequest,
  type ImportanceClassificationResult,
  type PiRuntimeAiModel,
} from "./contracts";
import { openCodeJsonCompletion } from "./opencode";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseClassificationResponse(
  payload: unknown
): Pick<
  ImportanceClassificationResult,
  "score" | "tier" | "reason" | "confidence"
> | null {
  const parsed = asRecord(payload);
  if (!parsed) {
    return null;
  }

  const rawScore = parsed.score;
  const rawTier = parsed.tier;
  const rawReason = parsed.reason;
  const rawConfidence = parsed.confidence;
  if (typeof rawScore !== "number") {
    return null;
  }

  if (
    rawTier !== "critical" &&
    rawTier !== "important" &&
    rawTier !== "later"
  ) {
    return null;
  }

  if (typeof rawReason !== "string" || rawReason.trim().length === 0) {
    return null;
  }

  if (typeof rawConfidence !== "number" || !Number.isFinite(rawConfidence)) {
    return null;
  }

  return {
    score: clampScore(rawScore),
    tier: rawTier,
    reason: rawReason.trim(),
    confidence: Math.max(0, Math.min(1, rawConfidence)),
  };
}

export async function classifyImportance(
  request: ImportanceClassificationRequest
): Promise<ImportanceClassificationResult> {
  const completion = await openCodeJsonCompletion({
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You classify importance for user notifications. Return JSON only with keys score, tier, reason, confidence. score is an integer 0-100, tier is critical|important|later, reason is concise, confidence is 0-1.",
      },
      {
        role: "user",
        content: JSON.stringify({
          summary: request.summary,
          context: request.context,
          preview: request.preview,
          ruleScore: clampScore(request.ruleScore),
        }),
      },
    ],
  });

  const parsed = parseClassificationResponse(completion.json);
  if (!parsed) {
    throw new Error("OpenCode returned an invalid importance payload.");
  }

  return {
    provider: PI_RUNTIME_AI_PROVIDERS.opencode,
    model: completion.model as PiRuntimeAiModel,
    score: parsed.score,
    tier: parsed.tier,
    reason: parsed.reason,
    confidence: parsed.confidence,
    fallback: false,
  };
}
