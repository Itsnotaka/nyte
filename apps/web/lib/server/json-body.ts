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
