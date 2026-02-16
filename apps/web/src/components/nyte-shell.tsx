"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";

import { Badge } from "@nyte/ui/components/badge";
import { Button } from "@nyte/ui/components/button";
import { Input } from "@nyte/ui/components/input";
import {
  AtSignIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  MailIcon,
  PenLineIcon,
  RefreshCwIcon,
  WalletCardsIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";

import { authClient } from "~/lib/auth-client";

const DEFAULT_COMMAND =
  "Google Calendar schedule a 30-min board prep review with the exec team next week";

type SyncPollResponse = {
  cursor: string;
  needsYou: WorkItemWithAction[];
};

function formatCalendarLine(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Time pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getActionLine(item: WorkItemWithAction) {
  if (item.proposedAction.kind === "google-calendar.createEvent") {
    return formatCalendarLine(item.proposedAction.startsAt);
  }

  if (item.proposedAction.kind === "billing.queueRefund") {
    return `Refund $${item.proposedAction.amount} to ${item.proposedAction.customerName}`;
  }

  return `Draft ${item.proposedAction.body}`;
}

function getPrimaryActionLabel(item: WorkItemWithAction) {
  if (item.type === "calendar") {
    return "Accept";
  }

  if (item.type === "refund") {
    return "Refund";
  }

  return "Review Reply";
}

function getSecondaryActionLabel(item: WorkItemWithAction) {
  if (item.type === "calendar") {
    return "Decline";
  }

  return "Dismiss";
}

function getActionIcon(item: WorkItemWithAction) {
  if (item.type === "calendar") {
    return <CalendarClockIcon className="size-5" />;
  }

  if (item.type === "refund") {
    return <WalletCardsIcon className="size-5" />;
  }

  return <PenLineIcon className="size-5" />;
}

async function readSyncPayload(response: Response): Promise<SyncPollResponse> {
  const payload = (await response.json()) as Partial<SyncPollResponse> & {
    error?: unknown;
  };

  if (!response.ok) {
    const fallback = "Unable to sync Gmail + Calendar right now.";
    const message =
      typeof payload.error === "string" && payload.error.trim().length > 0
        ? payload.error
        : fallback;
    throw new Error(message);
  }

  if (!Array.isArray(payload.needsYou) || typeof payload.cursor !== "string") {
    throw new Error("Sync payload is invalid.");
  }

  return {
    cursor: payload.cursor,
    needsYou: payload.needsYou,
  };
}

export function NyteShell() {
  const [command, setCommand] = React.useState(DEFAULT_COMMAND);
  const [items, setItems] = React.useState<WorkItemWithAction[]>([]);
  const [handled, setHandled] = React.useState<
    Record<string, "approved" | "dismissed">
  >({});
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string | null>(null);
  const cursorRef = React.useRef<string | null>(null);

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const visibleItems = React.useMemo(
    () => items.filter((item) => handled[item.id] === undefined),
    [handled, items]
  );

  const syncSignals = React.useCallback(async () => {
    setSyncError(null);
    setIsSyncing(true);

    try {
      const url = cursorRef.current
        ? `/api/sync/poll?cursor=${encodeURIComponent(cursorRef.current)}`
        : "/api/sync/poll";
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      });

      const payload = await readSyncPayload(response);
      cursorRef.current = payload.cursor;
      setItems(payload.needsYou);
      setHandled({});
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to sync Gmail + Calendar right now.";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!session) {
      return;
    }

    void syncSignals();
  }, [session, syncSignals]);

  const connectGoogle = React.useCallback(async () => {
    setSyncError(null);
    setNotice(null);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  }, []);

  const disconnectGoogle = React.useCallback(async () => {
    await authClient.signOut();
    cursorRef.current = null;
    setItems([]);
    setHandled({});
    setNotice("Disconnected Google session.");
    setSyncError(null);
    setLastSyncedAt(null);
  }, []);

  const markAction = React.useCallback(
    (item: WorkItemWithAction, status: "approved" | "dismissed") => {
      setHandled((current) => ({
        ...current,
        [item.id]: status,
      }));

      const actionLabel =
        status === "approved"
          ? getPrimaryActionLabel(item)
          : getSecondaryActionLabel(item);
      const note =
        status === "approved"
          ? `${actionLabel} queued locally (placeholder execution).`
          : `${actionLabel} applied locally.`;

      setNotice(note);
    },
    []
  );

  return (
    <main className="bg-background text-foreground min-h-dvh">
      <div className="relative isolate min-h-dvh overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,#60a5fa_0%,transparent_42%),radial-gradient(circle_at_88%_18%,#f472b6_0%,transparent_42%),radial-gradient(circle_at_80%_84%,#fb7185_0%,transparent_45%),radial-gradient(circle_at_18%_82%,#22d3ee_0%,transparent_40%),linear-gradient(130deg,#111827,#312e81_45%,#1f2937)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-10 md:px-6 lg:py-14">
          <section className="rounded-3xl border border-white/35 bg-white/78 p-3 shadow-2xl shadow-black/25 backdrop-blur-xl md:p-5">
            <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white/85 px-3 py-2 md:px-4">
              <CalendarDaysIcon className="size-5 text-blue-600" />
              <Input
                value={command}
                onChange={(event) => setCommand(event.currentTarget.value)}
                className="h-10 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                aria-label="Command input"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-muted-foreground flex min-h-11 items-center gap-2 text-sm">
                <AtSignIcon className="size-4" />
                <span>Add context</span>
                <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
                  Gmail
                </Badge>
                <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
                  Calendar
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {session ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void disconnectGoogle()}
                    disabled={isSessionPending}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void connectGoogle()}
                    disabled={isSessionPending}
                  >
                    Connect Google
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void syncSignals()}
                  disabled={!session || isSyncing}
                >
                  <RefreshCwIcon className={isSyncing ? "animate-spin" : ""} />
                  Go
                </Button>
              </div>
            </div>
          </section>

          {syncError ? (
            <section className="rounded-2xl border border-red-300/60 bg-red-50/90 px-4 py-3 text-sm text-red-700 backdrop-blur">
              {syncError}
            </section>
          ) : null}

          {notice ? (
            <section className="rounded-2xl border border-emerald-300/60 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 backdrop-blur">
              {notice}
            </section>
          ) : null}

          {lastSyncedAt ? (
            <p className="text-white/90 text-xs">
              Last sync {new Date(lastSyncedAt).toLocaleTimeString()}
            </p>
          ) : null}

          {!session ? (
            <section className="rounded-3xl border border-white/35 bg-white/80 p-6 text-sm text-zinc-700 shadow-xl backdrop-blur">
              Connect Google to ingest real Gmail and Calendar signals.
            </section>
          ) : null}

          {session && visibleItems.length === 0 && !isSyncing ? (
            <section className="rounded-3xl border border-white/35 bg-white/80 p-6 text-sm text-zinc-700 shadow-xl backdrop-blur">
              No action cards right now.
            </section>
          ) : null}

          {visibleItems.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-white/40 bg-zinc-100/88 p-2 shadow-2xl shadow-black/20 backdrop-blur"
            >
              <div className="rounded-2xl border border-black/10 bg-white/82 px-4 py-4 text-[1.02rem] text-zinc-700 md:text-[1.12rem]">
                <span className="mr-2 inline-flex rounded-xl border border-black/10 bg-white px-3 py-1.5 font-medium text-zinc-900">
                  {item.actor}
                </span>
                <span className="mr-2 text-zinc-500">from</span>
                <span className="mr-2 inline-flex rounded-xl border border-black/10 bg-white px-3 py-1.5 font-medium text-zinc-900">
                  {item.source}
                </span>
                <span>{item.summary}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 md:px-4">
                <div className="flex min-h-11 min-w-0 items-center gap-2 text-zinc-800">
                  {getActionIcon(item)}
                  <span className="truncate text-[1.05rem]">
                    {getActionLine(item)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => markAction(item, "dismissed")}
                  >
                    <XIcon className="size-4" />
                    {getSecondaryActionLabel(item)}
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => markAction(item, "approved")}
                  >
                    {item.type === "draft" ? (
                      <MailIcon className="size-4" />
                    ) : null}
                    {item.type === "calendar" ? (
                      <CalendarDaysIcon className="size-4" />
                    ) : null}
                    {item.type === "refund" ? (
                      <WalletCardsIcon className="size-4" />
                    ) : null}
                    {getPrimaryActionLabel(item)}
                  </Button>
                </div>
              </div>
            </article>
          ))}

          {session && visibleItems.length > 0 ? (
            <p className="text-white/90 flex items-center gap-1 text-xs">
              <CheckIcon className="size-3.5" />
              Real Gmail + Calendar ingestion enabled. Card actions are local
              placeholders.
              <ChevronRightIcon className="size-3.5" />
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
