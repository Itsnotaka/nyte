import {
  isRuntimeCommandResult,
  type RuntimeCommand,
  type RuntimeCommandResult,
} from "@workspace/contracts";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

export class RuntimeClientConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeClientConfigurationError";
  }
}

export class RuntimeCommandDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeCommandDispatchError";
  }
}

type RuntimeClientOptions = {
  runtimeBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

function runtimeCommandPath(type: RuntimeCommand["type"]) {
  if (type === "runtime.ingest") {
    return "/runtime/ingest";
  }

  if (type === "runtime.approve") {
    return "/runtime/approve";
  }

  if (type === "runtime.dismiss") {
    return "/runtime/dismiss";
  }

  return "/runtime/feedback";
}

function normalizeRuntimeBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized.replace(/\/+$/, "");
}

function resolveRuntimeBaseUrl(
  runtimeBaseUrl: string | undefined,
): ResultAsync<string, RuntimeClientConfigurationError> {
  const normalized = normalizeRuntimeBaseUrl(runtimeBaseUrl ?? process.env.NYTE_RUNTIME_URL);
  if (!normalized) {
    return errAsync(
      new RuntimeClientConfigurationError("NYTE_RUNTIME_URL is required for runtime delegation."),
    );
  }

  return okAsync(normalized);
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function readErrorMessage(response: Response, fallback: string) {
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

export function dispatchRuntimeCommand(
  command: RuntimeCommand,
  options: RuntimeClientOptions = {},
): ResultAsync<
  RuntimeCommandResult,
  RuntimeClientConfigurationError | RuntimeCommandDispatchError
> {
  return resolveRuntimeBaseUrl(options.runtimeBaseUrl).andThen((baseUrl) => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const runtimeEndpoint = `${baseUrl}${runtimeCommandPath(command.type)}`;

    return ResultAsync.fromPromise(
      fetchImpl(runtimeEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(command),
      }),
      (error) =>
        new RuntimeCommandDispatchError(toMessage(error, "Failed to reach runtime service.")),
    ).andThen((response) => {
      if (!response.ok) {
        return readErrorMessage(response, "Runtime service rejected command.").andThen((message) =>
          errAsync(new RuntimeCommandDispatchError(message)),
        );
      }

      return ResultAsync.fromPromise(response.json() as Promise<unknown>, (error) => {
        return new RuntimeCommandDispatchError(
          toMessage(error, "Runtime service returned an unreadable payload."),
        );
      }).andThen((payload) => {
        if (!isRuntimeCommandResult(payload)) {
          return errAsync(
            new RuntimeCommandDispatchError("Runtime service returned an invalid command result."),
          );
        }

        return okAsync(payload);
      });
    });
  });
}
