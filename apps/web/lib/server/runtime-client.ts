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
  runtimeAuthToken?: string;
  timeoutMs?: number;
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

function normalizeRuntimeAuthToken(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function resolveRuntimeTimeoutMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 15_000;
  }

  const normalized = Math.trunc(value);
  if (normalized < 250) {
    return 250;
  }

  if (normalized > 60_000) {
    return 60_000;
  }

  return normalized;
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

function performRuntimeFetch(
  fetchImpl: typeof fetch,
  runtimeEndpoint: string,
  headers: Record<string, string>,
  command: RuntimeCommand,
  timeoutMs: number,
) {
  return ResultAsync.fromPromise(
    new Promise<Response>((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      void fetchImpl(runtimeEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(command),
        signal: controller.signal,
      })
        .then(resolve, reject)
        .finally(() => {
          clearTimeout(timeout);
        });
    }),
    (error) => {
      if (error instanceof Error && error.name === "AbortError") {
        return new RuntimeCommandDispatchError(
          `Runtime service request timed out after ${timeoutMs}ms.`,
        );
      }

      return new RuntimeCommandDispatchError(toMessage(error, "Failed to reach runtime service."));
    },
  );
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
    const runtimeAuthToken = normalizeRuntimeAuthToken(
      options.runtimeAuthToken ?? process.env.NYTE_RUNTIME_AUTH_TOKEN,
    );
    const timeoutMs = resolveRuntimeTimeoutMs(options.timeoutMs);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (runtimeAuthToken) {
      headers.authorization = `Bearer ${runtimeAuthToken}`;
    }

    return performRuntimeFetch(fetchImpl, runtimeEndpoint, headers, command, timeoutMs).andThen(
      (response) => {
        if (!response.ok) {
          return readErrorMessage(response, "Runtime service rejected command.").andThen(
            (message) => errAsync(new RuntimeCommandDispatchError(message)),
          );
        }

        return ResultAsync.fromPromise(response.json() as Promise<unknown>, (error) => {
          return new RuntimeCommandDispatchError(
            toMessage(error, "Runtime service returned an unreadable payload."),
          );
        }).andThen((payload) => {
          if (!isRuntimeCommandResult(payload)) {
            return errAsync(
              new RuntimeCommandDispatchError(
                "Runtime service returned an invalid command result.",
              ),
            );
          }

          return okAsync(payload);
        });
      },
    );
  });
}
