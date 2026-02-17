import { asRecord } from "~/lib/shared/value-guards";

export function asObjectPayload(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

export function parseRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

export function parseRequiredStringField(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  return parseRequiredString(payload[key]);
}

export function parseItemId(payload: Record<string, unknown>): string | null {
  return parseRequiredStringField(payload, "itemId");
}

export function parseOptionalString(
  value: unknown,
  options?: {
    requireNonEmpty?: boolean;
  },
): string | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return options?.requireNonEmpty ? null : undefined;
  }

  return normalized;
}

export function parseOptionalStringField(
  payload: Record<string, unknown>,
  key: string,
  options?: {
    requireNonEmpty?: boolean;
  },
): string | undefined | null {
  return parseOptionalString(payload[key], options);
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function parseEnumValue<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[],
): TValue | null {
  if (typeof value !== "string") {
    return null;
  }

  for (const allowedValue of allowedValues) {
    if (value === allowedValue) {
      return allowedValue;
    }
  }

  return null;
}
