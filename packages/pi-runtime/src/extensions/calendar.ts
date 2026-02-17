import type {
  CalendarCreateEventRequest,
  CalendarCreateEventResult,
  CalendarUpdateEventRequest,
  CalendarUpdateEventResult,
} from "../contracts";
import { deterministicHash } from "../hash";

export async function calendarCreateEvent(
  request: CalendarCreateEventRequest,
): Promise<CalendarCreateEventResult> {
  return {
    name: "calendar.createEvent",
    status: "executed",
    idempotencyKey: request.idempotencyKey,
    output: {
      providerEventId: `event_${deterministicHash(request.idempotencyKey)}`,
      startsAt: request.input.startsAt,
      endsAt: request.input.endsAt,
    },
    executedAt: new Date().toISOString(),
  };
}

export async function calendarUpdateEvent(
  request: CalendarUpdateEventRequest,
): Promise<CalendarUpdateEventResult> {
  return {
    name: "calendar.updateEvent",
    status: "executed",
    idempotencyKey: request.idempotencyKey,
    output: {
      providerEventId: request.input.eventId,
      updated: true,
    },
    executedAt: new Date().toISOString(),
  };
}
