import { isToolCallPayload, type ToolCallPayload } from "@nyte/domain/actions";
import { Result } from "neverthrow";

function parseJson(payloadJson: string): unknown {
  const parsedPayload = Result.fromThrowable(JSON.parse, () => null)(payloadJson);
  if (parsedPayload.isErr()) {
    return null;
  }

  return parsedPayload.value as unknown;
}

export function parseRecordPayload(payloadJson: string): Record<string, unknown> {
  const parsed = parseJson(payloadJson);
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }

  if (parsed === null) {
    return {
      parseError: true,
      rawPayload: payloadJson,
    };
  }

  return {
    value: parsed,
  };
}

export function parseToolCallPayload(payloadJson: string): ToolCallPayload | null {
  const parsed = parseJson(payloadJson);
  if (!isToolCallPayload(parsed)) {
    return null;
  }

  return parsed;
}
