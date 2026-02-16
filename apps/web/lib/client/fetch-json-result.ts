import { errAsync, okAsync, ResultAsync } from "neverthrow";

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function createRequestError(error: unknown, fallback: string): Error {
  return new Error(toErrorMessage(error, fallback));
}

function parseErrorMessage(response: Response, fallback: string) {
  return ResultAsync.fromPromise(response.json() as Promise<unknown>, () => fallback)
    .map((payload) => {
      if (typeof payload !== "object" || payload === null) {
        return fallback;
      }

      const message = Reflect.get(payload, "error");
      if (typeof message !== "string" || message.trim().length === 0) {
        return fallback;
      }

      return message;
    })
    .orElse(() => okAsync(fallback));
}

export function fetchJsonResult<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallbackMessage: string,
  fetchImpl: typeof fetch = fetch,
): ResultAsync<T, Error> {
  return ResultAsync.fromPromise(fetchImpl(input, init), (error) =>
    createRequestError(error, fallbackMessage),
  ).andThen((response) => {
    if (!response.ok) {
      return parseErrorMessage(response, fallbackMessage).andThen((message) =>
        errAsync(new Error(message)),
      );
    }

    return ResultAsync.fromPromise(response.json() as Promise<T>, (error) =>
      createRequestError(error, fallbackMessage),
    );
  });
}
