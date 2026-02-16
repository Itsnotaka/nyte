import { errAsync, okAsync, Result, ResultAsync } from "neverthrow";

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

function resultToResultAsync<T, E>(result: Result<T, E>): ResultAsync<T, E> {
  return result.isOk() ? okAsync(result.value) : errAsync(result.error);
}

export function readJsonBody<T>(
  request: Request,
): ResultAsync<T, InvalidJsonBodyError | UnsupportedMediaTypeError> {
  if (!isJsonContentType(request)) {
    return errAsync(new UnsupportedMediaTypeError());
  }

  const parseJson = Result.fromThrowable(JSON.parse, () => new InvalidJsonBodyError());
  return ResultAsync.fromPromise(request.text(), () => new InvalidJsonBodyError()).andThen((raw) =>
    resultToResultAsync(parseJson(stripUtf8Bom(raw))).map((value) => value as T),
  );
}

export function readOptionalJsonBody<T>(
  request: Request,
  fallback: T,
): ResultAsync<T, InvalidJsonBodyError | UnsupportedMediaTypeError> {
  const parseJson = Result.fromThrowable(JSON.parse, () => new InvalidJsonBodyError());
  return ResultAsync.fromPromise(request.text(), () => new InvalidJsonBodyError()).andThen(
    (requestBody) => {
      const raw = stripUtf8Bom(requestBody);
      if (!raw.trim()) {
        return okAsync(fallback);
      }

      if (!isJsonContentType(request)) {
        return errAsync(new UnsupportedMediaTypeError());
      }

      return resultToResultAsync(parseJson(raw)).map((value) => value as T);
    },
  );
}

export function createJsonBodyErrorResponse(
  error: InvalidJsonBodyError | UnsupportedMediaTypeError,
) {
  if (error instanceof UnsupportedMediaTypeError) {
    return Response.json({ error: error.message }, { status: 415 });
  }

  return Response.json({ error: error.message }, { status: 400 });
}
