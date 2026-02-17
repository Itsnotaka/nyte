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

export function parseRequiredStringField<
  TPayload extends Record<string, unknown>,
  TKey extends keyof TPayload,
>(
  payload: TPayload,
  key: TKey,
): string | null {
  return parseRequiredString(payload[key]);
}

export function parseItemId(payload: Record<string, unknown>): string | null {
  return parseRequiredStringField(payload, "itemId");
}

export type ParsedBodyWithItemId = {
  body: Record<string, unknown>;
  itemId: string;
};

export function parseBodyWithItemId(value: unknown): ParsedBodyWithItemId | null {
  const body = asObjectPayload(value);
  if (!body) {
    return null;
  }

  const itemId = parseItemId(body);
  if (!itemId) {
    return null;
  }

  return {
    body,
    itemId,
  };
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

export function parseOptionalStringField<
  TPayload extends Record<string, unknown>,
  TKey extends keyof TPayload,
>(
  payload: TPayload,
  key: TKey,
  options?: {
    requireNonEmpty?: boolean;
  },
): string | undefined | null {
  return parseOptionalString(payload[key], options);
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function parseRequestPayload<TPayload>(
  request: Request,
  parser: (value: unknown) => TPayload | null,
): Promise<TPayload | null> {
  return parser(await parseJsonBody(request));
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
