import type { RuntimeCommand, RuntimeCommandResult } from "@workspace/contracts";

function toIso(value: Date): string {
  return value.toISOString();
}

export function handleRuntimeCommand(
  command: RuntimeCommand,
  now = new Date(),
): RuntimeCommandResult {
  const receivedAt = toIso(now);

  if (command.type === "runtime.ingest") {
    return {
      status: "accepted",
      type: "runtime.ingest",
      requestId: command.context.requestId,
      receivedAt,
      result: {
        cursor: command.payload.cursor ?? receivedAt,
        queuedCount: 0,
      },
    };
  }

  if (command.type === "runtime.approve") {
    return {
      status: "accepted",
      type: "runtime.approve",
      requestId: command.context.requestId,
      receivedAt,
      result: {
        itemId: command.payload.itemId,
        idempotent: false,
      },
    };
  }

  if (command.type === "runtime.dismiss") {
    return {
      status: "accepted",
      type: "runtime.dismiss",
      requestId: command.context.requestId,
      receivedAt,
      result: {
        itemId: command.payload.itemId,
      },
    };
  }

  return {
    status: "accepted",
    type: "runtime.feedback",
    requestId: command.context.requestId,
    receivedAt,
    result: {
      itemId: command.payload.itemId,
      rating: command.payload.rating,
    },
  };
}
