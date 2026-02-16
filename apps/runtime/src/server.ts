import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Result, ResultAsync } from "neverthrow";
import {
  isRuntimeCommand,
  type RuntimeCommand,
  type RuntimeCommandResult,
  type RuntimeCommandType,
} from "@nyte/contracts";

import { handleRuntimeCommand } from "./command-handler.js";

function writeJson(
  response: ServerResponse<IncomingMessage>,
  status: number,
  payload: Record<string, unknown>,
  requestId?: string,
) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  if (requestId) {
    response.setHeader("x-request-id", requestId);
  }
  response.end(JSON.stringify(payload));
}

function readBody(request: IncomingMessage) {
  return ResultAsync.fromPromise(
    new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];

      request.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    }),
    () => new Error("Unable to read request body."),
  );
}

function parseJson(body: string) {
  return Result.fromThrowable(JSON.parse, () => new Error("Unable to parse JSON body."))(body);
}

function resolvePort(value: string | undefined): number {
  if (!value) {
    return 4001;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 4001;
  }

  return parsed;
}

function normalizeRuntimeAuthToken(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function getRuntimeAuthHeaderToken(request: IncomingMessage) {
  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer") {
    return null;
  }

  const normalizedToken = token?.trim();
  if (!normalizedToken) {
    return null;
  }

  return normalizedToken;
}

const RUNTIME_COMMAND_ENDPOINTS: Record<RuntimeCommandType, string> = {
  "runtime.ingest": "/runtime/ingest",
  "runtime.approve": "/runtime/approve",
  "runtime.dismiss": "/runtime/dismiss",
  "runtime.feedback": "/runtime/feedback",
};

type HandleRuntimeCommand = (
  command: RuntimeCommand,
) => RuntimeCommandResult | Promise<RuntimeCommandResult>;

type RuntimeServerOptions = {
  handleCommand?: HandleRuntimeCommand;
};

function resolveRouteType(url: string | undefined): RuntimeCommandType | "runtime.command" | null {
  if (!url) {
    return null;
  }

  const pathname = new URL(url, "http://127.0.0.1").pathname;
  if (pathname === "/runtime/command") {
    return "runtime.command";
  }

  for (const [commandType, endpoint] of Object.entries(RUNTIME_COMMAND_ENDPOINTS)) {
    if (pathname === endpoint) {
      return commandType as RuntimeCommandType;
    }
  }

  return null;
}

export function createRuntimeServer() {
  return createRuntimeServerWithOptions();
}

export function createRuntimeServerWithOptions(options: RuntimeServerOptions = {}) {
  const handleCommand = options.handleCommand ?? handleRuntimeCommand;

  return createServer((request, response) => {
    const routeType = request.method === "POST" ? resolveRouteType(request.url) : null;
    if (!routeType) {
      writeJson(response, 404, { error: "Not found." });
      return;
    }

    const requiredAuthToken = normalizeRuntimeAuthToken(process.env.NYTE_RUNTIME_AUTH_TOKEN);
    if (requiredAuthToken && getRuntimeAuthHeaderToken(request) !== requiredAuthToken) {
      writeJson(response, 401, { error: "Unauthorized runtime command request." });
      return;
    }

    void readBody(request).then((bodyResult) => {
      if (bodyResult.isErr()) {
        writeJson(response, 400, { error: bodyResult.error.message });
        return;
      }

      const parsedBody = parseJson(bodyResult.value);
      if (parsedBody.isErr()) {
        writeJson(response, 400, { error: parsedBody.error.message });
        return;
      }

      if (!isRuntimeCommand(parsedBody.value)) {
        writeJson(response, 400, { error: "Request body must satisfy RuntimeCommand contract." });
        return;
      }

      const requestId = parsedBody.value.context.requestId;

      if (routeType !== "runtime.command" && parsedBody.value.type !== routeType) {
        writeJson(
          response,
          400,
          {
            error: "Runtime command type does not match endpoint.",
          },
          requestId,
        );
        return;
      }

      void ResultAsync.fromPromise(
        Promise.resolve(handleCommand(parsedBody.value)),
        () => new Error("Failed to process runtime command."),
      ).match(
        (commandResult) => {
          writeJson(response, 200, commandResult as Record<string, unknown>, requestId);
        },
        () => {
          writeJson(response, 500, { error: "Failed to process runtime command." }, requestId);
        },
      );
    });
  });
}

export function startRuntimeServer(port = resolvePort(process.env.PORT)) {
  const server = createRuntimeServer();
  server.listen(port);
  return server;
}
