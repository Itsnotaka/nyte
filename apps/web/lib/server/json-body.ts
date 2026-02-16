export class InvalidJsonBodyError extends Error {
  constructor(message = "Invalid JSON body.") {
    super(message);
    this.name = "InvalidJsonBodyError";
  }
}

export class UnsupportedMediaTypeError extends Error {
  constructor(message = "Content-Type must be application/json.") {
    super(message);
    this.name = "UnsupportedMediaTypeError";
  }
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type");
  if (typeof contentType !== "string") {
    return false;
  }

  const mimeType = contentType.split(";")[0]?.trim().toLowerCase();
  if (!mimeType) {
    return false;
  }

  return mimeType === "application/json" || mimeType.endsWith("+json");
}

function stripUtf8Bom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  if (!isJsonContentType(request)) {
    throw new UnsupportedMediaTypeError();
  }

  try {
    const raw = stripUtf8Bom(await request.text());
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export async function readOptionalJsonBody<T>(request: Request, fallback: T): Promise<T> {
  const raw = stripUtf8Bom(await request.text());
  if (!raw.trim()) {
    return fallback;
  }

  if (!isJsonContentType(request)) {
    throw new UnsupportedMediaTypeError();
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
