import type { QueueActionItem } from "@nyte/workflows";

export type ActionContentViewModel =
  | {
      mode: "draft";
      preview: string;
    }
  | {
      mode: "calendar";
      day: string;
      time: string;
    }
  | {
      mode: "refund";
      amount: number;
      customerName: string;
    };

export function primaryActionLabel(item: QueueActionItem) {
  if (item.type === "calendar") {
    return "Accept";
  }

  if (item.type === "refund") {
    return "Refund";
  }

  return "Review Reply";
}

export function secondaryActionLabel(item: QueueActionItem) {
  if (item.type === "calendar") {
    return "Decline";
  }

  return "Dismiss";
}

function splitCalendarDate(startsAt: string) {
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) {
    return {
      day: "Schedule",
      time: "Time pending",
    };
  }

  return {
    day: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(parsed),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed),
  };
}

function truncate(value: string, max = 140) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function actionContentViewModel(item: QueueActionItem): ActionContentViewModel {
  if (item.proposedAction.kind === "google-calendar.createEvent") {
    const { day, time } = splitCalendarDate(item.proposedAction.startsAt);
    return {
      mode: "calendar",
      day,
      time,
    };
  }

  if (item.proposedAction.kind === "billing.queueRefund") {
    return {
      mode: "refund",
      amount: item.proposedAction.amount,
      customerName: item.proposedAction.customerName,
    };
  }

  return {
    mode: "draft",
    preview: truncate(item.proposedAction.body),
  };
}

export function commandPrefix(command: string) {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      app: "Gmail",
      body: "",
    };
  }

  if (/^google\s+calendar\b/i.test(trimmed)) {
    return {
      app: "Google Calendar",
      body: trimmed.replace(/^google\s+calendar\s*/i, ""),
    };
  }

  if (/^gmail\b/i.test(trimmed)) {
    return {
      app: "Gmail",
      body: trimmed.replace(/^gmail\s*/i, ""),
    };
  }

  return {
    app: "Gmail",
    body: trimmed,
  };
}
