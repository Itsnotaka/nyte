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

function isJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type");
  return typeof contentType === "string" && contentType.toLowerCase().includes("application/json");
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  if (!isJsonContentType(request)) {
    throw new UnsupportedMediaTypeError();
  }

  try {
    return (await request.json()) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export async function readOptionalJsonBody<T>(request: Request, fallback: T): Promise<T> {
  const raw = await request.text();
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
