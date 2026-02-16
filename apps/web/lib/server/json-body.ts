export class InvalidJsonBodyError extends Error {
  constructor(message = "Invalid JSON body.") {
    super(message);
    this.name = "InvalidJsonBodyError";
  }
}

export async function readJsonBody<T>(request: Request): Promise<T> {
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

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}
