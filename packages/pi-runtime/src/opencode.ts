type RuntimeEnv = {
  OPENCODE_API_KEY?: string;
  PI_RUNTIME_MODEL?: string;
};

type OpenCodeMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenCodeOptions = {
  messages: OpenCodeMessage[];
  temperature?: number;
};

type OpenCodeCompletion = {
  model: string;
  content: string;
};

const OPENCODE_CHAT_COMPLETIONS_URL =
  "https://api.opencode.ai/v1/chat/completions";

function readRuntimeEnv(): RuntimeEnv {
  const processLike = globalThis as {
    process?: {
      env?: RuntimeEnv;
    };
  };
  return processLike.process?.env ?? {};
}

function requiredEnv(name: keyof RuntimeEnv): string {
  const raw = readRuntimeEnv()[name];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    throw new Error(`${name} is required for pi-runtime LLM calls.`);
  }
  return value;
}

function readResponseTextContent(content: unknown): string | null {
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const chunks: string[] = [];
  for (const item of content) {
    if (
      typeof item === "object" &&
      item !== null &&
      "type" in item &&
      (item as { type: unknown }).type === "text" &&
      "text" in item &&
      typeof (item as { text: unknown }).text === "string"
    ) {
      chunks.push((item as { text: string }).text);
    }
  }

  const combined = chunks.join("\n").trim();
  return combined.length > 0 ? combined : null;
}

function parseJsonFromModelText(modelText: string): unknown {
  const trimmed = modelText.trim();
  if (trimmed.length === 0) {
    throw new Error("OpenCode returned an empty response.");
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("OpenCode response was not valid JSON.");
  }
}

export async function openCodeJsonCompletion(
  options: OpenCodeOptions
): Promise<OpenCodeCompletion & { json: unknown }> {
  const apiKey = requiredEnv("OPENCODE_API_KEY");
  const model = requiredEnv("PI_RUNTIME_MODEL");
  const temperature = options.temperature ?? 0.1;

  const response = await fetch(OPENCODE_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: options.messages,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    const details = body.trim().slice(0, 300);
    throw new Error(
      `OpenCode request failed (${response.status}): ${details || "no response body"}`
    );
  }

  const raw: unknown = await response.json();
  if (typeof raw !== "object" || raw === null || !("choices" in raw)) {
    throw new Error("OpenCode response missing choices.");
  }
  const choices = (raw as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("OpenCode response had no choices.");
  }

  const firstChoice =
    typeof choices[0] === "object" && choices[0] !== null
      ? (choices[0] as { message?: unknown })
      : null;
  const message =
    firstChoice &&
    typeof firstChoice.message === "object" &&
    firstChoice.message !== null
      ? (firstChoice.message as { content?: unknown })
      : null;
  const text = readResponseTextContent(message?.content);
  if (!text) {
    throw new Error("OpenCode response had no text content.");
  }

  return {
    model,
    content: text,
    json: parseJsonFromModelText(text),
  };
}
