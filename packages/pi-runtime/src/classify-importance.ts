import {
  PI_RUNTIME_AI_MODELS,
  PI_RUNTIME_AI_PROVIDERS,
  type ImportanceClassificationRequest,
  type ImportanceClassificationResult,
  type ImportanceTier,
} from "./contracts";

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function toTier(score: number): ImportanceTier {
  if (score >= 85) {
    return "critical";
  }

  if (score >= 70) {
    return "important";
  }

  return "later";
}

function createFallbackResult(
  request: ImportanceClassificationRequest,
  reason: string
): ImportanceClassificationResult {
  const score = clampScore(request.ruleScore);

  return {
    provider: request.provider ?? PI_RUNTIME_AI_PROVIDERS.opencode,
    model: request.model ?? PI_RUNTIME_AI_MODELS.zen,
    score,
    tier: toTier(score),
    reason,
    confidence: 0.45,
    fallback: true,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseGatewayResponse(
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
  const provider = request.provider ?? PI_RUNTIME_AI_PROVIDERS.opencode;
  const model = request.model ?? PI_RUNTIME_AI_MODELS.zen;
  const runtimeEnv = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env;
  const gatewayUrl = runtimeEnv?.PI_RUNTIME_GATEWAY_URL?.trim();
  const apiKey = runtimeEnv?.AI_GATEWAY_API_KEY?.trim();

  if (!gatewayUrl || !apiKey) {
    return createFallbackResult(
      request,
      "AI gateway unavailable, using rules score."
    );
  }

  try {
    const response = await fetch(`${gatewayUrl}/v1/importance/classify`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        provider,
        model,
        summary: request.summary,
        context: request.context,
        preview: request.preview,
        ruleScore: clampScore(request.ruleScore),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return createFallbackResult(
        request,
        `AI gateway request failed (${response.status}), using rules score.`
      );
    }

    const parsed = parseGatewayResponse(await response.json());
    if (!parsed) {
      return createFallbackResult(
        request,
        "AI gateway returned an invalid payload, using rules score."
      );
    }

    return {
      provider,
      model,
      score: parsed.score,
      tier: parsed.tier,
      reason: parsed.reason,
      confidence: parsed.confidence,
      fallback: false,
    };
  } catch {
    return createFallbackResult(
      request,
      "AI gateway request errored, using rules score."
    );
  }
}
