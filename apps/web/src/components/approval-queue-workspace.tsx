"use client";

import {
  IconBrokenChainLink2,
  IconCalendarClock,
  IconCalendarDays,
  IconEmail1,
  IconTodos,
  IconWallet1,
  IconX,
  IconZap,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import type { WorkItemWithAction } from "@nyte/domain/actions";
import { Alert, AlertDescription, AlertTitle } from "@nyte/ui/components/alert";
import { Badge } from "@nyte/ui/components/badge";
import { Button } from "@nyte/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nyte/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@nyte/ui/components/empty";
import { Input } from "@nyte/ui/components/input";
import { Textarea } from "@nyte/ui/components/textarea";
import * as React from "react";

import { ApprovalQueueControls } from "~/components/approval-queue-controls";
import { useWorkspace } from "~/hooks/use-workspace";
import { QUEUE_MESSAGES } from "~/lib/queue/messages";
import {
  actionContentViewModel,
  primaryActionLabel,
  secondaryActionLabel,
} from "~/lib/queue/presenters";

function itemLabel(item: WorkItemWithAction): string {
  if (item.type === "calendar") {
    return "Calendar";
  }

  if (item.type === "refund") {
    return "Refund";
  }

  return "Draft";
}

function QueueItemTypeBadge({ item }: { item: WorkItemWithAction }) {
  if (item.type === "calendar") {
    return (
      <span className="bg-primary/10 text-primary inline-flex size-8 items-center justify-center rounded-lg">
        <IconCalendarDays className="size-4" />
      </span>
    );
  }

  if (item.type === "refund") {
    return (
      <span className="bg-chart-4/10 text-chart-4 inline-flex size-8 items-center justify-center rounded-lg">
        <IconWallet1 className="size-4" />
      </span>
    );
  }

  return (
    <span className="bg-chart-2/10 text-chart-2 inline-flex size-8 items-center justify-center rounded-lg">
      <IconEmail1 className="size-4" />
    </span>
  );
}

function QueueItemSummary({ item }: { item: WorkItemWithAction }) {
  const viewModel = actionContentViewModel(item);

  if (viewModel.mode === "calendar") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs/5 text-muted-foreground">
        <IconCalendarDays className="text-primary size-3.5" />
        <Badge variant="secondary">{viewModel.day}</Badge>
        <Badge variant="outline">{viewModel.time}</Badge>
      </div>
    );
  }

  if (viewModel.mode === "refund") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs/5 text-muted-foreground">
        <IconWallet1 className="text-primary size-3.5" />
        <Badge variant="secondary">${viewModel.amount.toFixed(2)}</Badge>
        <span>{viewModel.customerName}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs/5 text-muted-foreground">
      <IconEmail1 className="text-primary size-3.5 shrink-0" />
      <span className="truncate">{viewModel.preview}</span>
    </div>
  );
}

function resolvePayloadOverride(
  item: WorkItemWithAction,
  draftBodyByItemId: Record<string, string>,
  calendarTitleByItemId: Record<string, string>,
  refundReasonByItemId: Record<string, string>
): WorkItemWithAction["proposedAction"] {
  if (item.proposedAction.kind === "gmail.createDraft") {
    const body = draftBodyByItemId[item.id];
    if (body === undefined) {
      return item.proposedAction;
    }

    return { ...item.proposedAction, body };
  }

  if (item.proposedAction.kind === "google-calendar.createEvent") {
    const title = calendarTitleByItemId[item.id];
    if (title === undefined) {
      return item.proposedAction;
    }

    return { ...item.proposedAction, title };
  }

  if (item.proposedAction.kind === "billing.queueRefund") {
    const reason = refundReasonByItemId[item.id];
    if (reason === undefined) {
      return item.proposedAction;
    }

    return { ...item.proposedAction, reason };
  }

  return item.proposedAction;
}

export function ApprovalQueueWorkspace() {
  const {
    connected,
    isSessionPending,
    isSyncing,
    isMutating,
    error,
    notice,
    lastSyncedAt,
    activeWatchKeywords,
    items,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  } = useWorkspace();

  const [draftBodyByItemId, setDraftBodyByItemId] = React.useState<
    Record<string, string>
  >({});
  const [calendarTitleByItemId, setCalendarTitleByItemId] = React.useState<
    Record<string, string>
  >({});
  const [refundReasonByItemId, setRefundReasonByItemId] = React.useState<
    Record<string, string>
  >({});

  const syncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not synced yet";

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-background via-background to-muted/40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -right-24 size-96 rounded-full bg-radial from-primary/25 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-20 size-96 rounded-full bg-radial from-chart-3/20 to-transparent blur-3xl"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 lg:py-8">
        <Card className="animate-in fade-in slide-in-from-top-2 border-border/70 bg-card/70 shadow-xs backdrop-blur-xl duration-300">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <IconZap className="size-3" />
                  Nyte Queue
                </Badge>
                <Badge variant={connected ? "default" : "outline"}>
                  {connected ? "Google connected" : "Google disconnected"}
                </Badge>
              </div>

              <span className="inline-flex items-center gap-1 text-xs/5 text-muted-foreground">
                <IconCalendarClock className="size-3" />
                {syncLabel}
              </span>
            </div>

            <CardTitle className="text-2xl/9">
              Approval queue workspace
            </CardTitle>
            <CardDescription className="text-sm/6 text-muted-foreground">
              Review queued actions from Gmail and Calendar, then approve or
              dismiss with full context.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap items-center gap-2 pt-0">
            <Badge variant="outline">{items.length} pending</Badge>
            {activeWatchKeywords.length > 0 ? (
              <Badge variant="outline" className="max-w-80 truncate">
                Filters: {activeWatchKeywords.join(", ")}
              </Badge>
            ) : (
              <Badge variant="outline">No keyword filters</Badge>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive" className="animate-in fade-in">
                <AlertTitle>Queue operation failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {notice ? (
              <Alert className="animate-in fade-in border-border/70 bg-card/80">
                <AlertTitle>Queue updated</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            {!connected ? (
              <Empty className="animate-in fade-in border-border bg-card/70 backdrop-blur-xl">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconBrokenChainLink2 className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>Connect Google to start</EmptyTitle>
                  <EmptyDescription>
                    {QUEUE_MESSAGES.queueAuthRequired}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {connected && items.length === 0 && !isSyncing ? (
              <Empty className="animate-in fade-in border-border bg-card/70 backdrop-blur-xl">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconTodos className="size-4" />
                  </EmptyMedia>
                  <EmptyTitle>All clear</EmptyTitle>
                  <EmptyDescription>
                    {QUEUE_MESSAGES.noActionCards}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {items.length > 0 ? (
              <Card className="animate-in fade-in slide-in-from-bottom-3 border-border/70 bg-card/70 backdrop-blur-xl duration-300">
                <CardHeader className="gap-2 border-b pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base/7">
                      Pending approvals
                    </CardTitle>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <CardDescription className="text-xs/5 text-muted-foreground">
                    Prioritized by urgency and decision impact.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex flex-col gap-3">
                    {items.map((item) => {
                      const payloadOverride = resolvePayloadOverride(
                        item,
                        draftBodyByItemId,
                        calendarTitleByItemId,
                        refundReasonByItemId
                      );

                      return (
                        <article
                          key={item.id}
                          className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                          <Card className="border-border/70 bg-card/70 transition duration-200 hover:-translate-y-0.5 hover:ring-foreground/20">
                            <CardHeader className="gap-3 pb-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-2.5">
                                  <QueueItemTypeBadge item={item} />
                                  <div className="flex min-w-0 flex-col gap-0.5">
                                    <p className="truncate text-sm/6 font-medium">
                                      {item.summary}
                                    </p>
                                    <p className="text-xs/5 text-muted-foreground">
                                      {item.actor}
                                      <span className="mx-1">·</span>
                                      {item.source}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex max-w-48 flex-wrap items-center justify-end gap-1.5">
                                  <Badge variant="outline">
                                    {itemLabel(item)}
                                  </Badge>
                                  {item.gates.slice(0, 2).map((gate) => (
                                    <Badge
                                      key={`${item.id}:${gate}`}
                                      variant="secondary"
                                    >
                                      {gate}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <QueueItemSummary item={item} />
                            </CardHeader>

                            <CardContent className="flex flex-col gap-3 pt-1">
                              <p className="text-xs/5 text-muted-foreground">
                                {item.context}
                              </p>

                              {item.proposedAction.kind ===
                              "gmail.createDraft" ? (
                                <Textarea
                                  aria-label={`Draft body for ${item.summary}`}
                                  className="min-h-24 text-sm/6"
                                  value={
                                    draftBodyByItemId[item.id] ??
                                    item.proposedAction.body
                                  }
                                  onChange={(event) =>
                                    setDraftBodyByItemId((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                />
                              ) : null}

                              {item.proposedAction.kind ===
                              "google-calendar.createEvent" ? (
                                <Input
                                  aria-label={`Calendar title for ${item.summary}`}
                                  value={
                                    calendarTitleByItemId[item.id] ??
                                    item.proposedAction.title
                                  }
                                  onChange={(event) =>
                                    setCalendarTitleByItemId((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                />
                              ) : null}

                              {item.proposedAction.kind ===
                              "billing.queueRefund" ? (
                                <Input
                                  aria-label={`Refund reason for ${item.summary}`}
                                  value={
                                    refundReasonByItemId[item.id] ??
                                    item.proposedAction.reason
                                  }
                                  onChange={(event) =>
                                    setRefundReasonByItemId((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                />
                              ) : null}
                            </CardContent>

                            <CardFooter className="justify-end gap-2 bg-card/30">
                              <Button
                                type="button"
                                variant="outline"
                                disabled={isMutating}
                                onClick={() =>
                                  void markAction(item, "dismissed")
                                }
                              >
                                <IconX className="size-3.5" />
                                {secondaryActionLabel(item)}
                              </Button>

                              <Button
                                type="button"
                                disabled={isMutating}
                                onClick={() =>
                                  void markAction(
                                    item,
                                    "approved",
                                    payloadOverride
                                  )
                                }
                              >
                                {primaryActionLabel(item)}
                              </Button>
                            </CardFooter>
                          </Card>
                        </article>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>

          <aside className="flex flex-col gap-4">
            <ApprovalQueueControls
              connected={connected}
              isSyncing={isSyncing || isMutating}
              isSessionPending={isSessionPending}
              activeWatchKeywords={activeWatchKeywords}
              onSubmit={runSync}
              onConnect={connectGoogle}
              onDisconnect={disconnectGoogle}
            />

            <Card className="animate-in fade-in slide-in-from-bottom-2 border-border/70 bg-card/70 backdrop-blur-xl duration-300">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-sm/6">Queue health</CardTitle>
                <CardDescription className="text-xs/5 text-muted-foreground">
                  Live status for this workspace session.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-xs/5 text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span>Sync state</span>
                  <Badge
                    variant={isSyncing || isMutating ? "secondary" : "outline"}
                  >
                    {isSyncing || isMutating ? "Running" : "Idle"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Action cards</span>
                  <span className="text-sm/6 font-medium text-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Connection</span>
                  <span className="text-foreground">
                    {connected ? "Google linked" : "Connect required"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
