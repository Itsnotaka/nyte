"use client";

import * as React from "react";
import {
  BellDotIcon,
  CalendarCheck2Icon,
  CalendarClockIcon,
  ChevronRightIcon,
  Clock3Icon,
  DraftingCompassIcon,
  InboxIcon,
  Layers2Icon,
  MailIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TextSearchIcon,
  WalletIcon,
} from "lucide-react";

import {
  withToolCalls,
  type GmailCreateDraftToolCall,
  type ToolCallPayload,
  type WorkItemWithAction,
} from "@/lib/domain/actions";
import { authClient } from "@/lib/auth-client";
import { mockIntakeSignals } from "@/lib/domain/mock-intake";
import { createNeedsYouQueue, GATE_LABEL, type WorkItem } from "@/lib/domain/triage";
import { Badge } from "@workspace/ui/@/components/ui/badge";
import { Button } from "@workspace/ui/@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/@/components/ui/card";
import { Input } from "@workspace/ui/@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@workspace/ui/@/components/ui/sidebar";
import { Textarea } from "@workspace/ui/@/components/ui/textarea";

const REFERENCE_NOW = new Date("2026-01-20T12:00:00.000Z");

type NavId = "needs-you" | "drafts" | "processed" | "connections" | "rules";
type DraftEntry = GmailCreateDraftToolCall & { id: string; actor: string };
type ActivityEntry = {
  id: string;
  itemId: string;
  actor: string;
  action: string;
  status: "executed" | "dismissed";
  detail: string;
  at: string;
};

type PollResponse = {
  cursor: string;
  needsYou: WorkItem[];
};

type ApproveResponse = {
  execution: {
    status: "executed";
    destination: "gmail_drafts" | "google_calendar" | "refund_queue";
    providerReference: string;
    executedAt: string;
  };
};

const navBlueprint = [
  { id: "needs-you", label: "Needs You", icon: BellDotIcon },
  { id: "drafts", label: "Drafts", icon: DraftingCompassIcon },
  { id: "processed", label: "Processed", icon: Layers2Icon },
  { id: "connections", label: "Connections", icon: RefreshCwIcon },
  { id: "rules", label: "Rules", icon: ShieldAlertIcon },
] as const;

function sourceIcon(type: WorkItem["type"]) {
  if (type === "calendar") {
    return <CalendarClockIcon className="size-4" />;
  }

  if (type === "refund") {
    return <WalletIcon className="size-4" />;
  }

  return <MailIcon className="size-4" />;
}

function clonePayload<T extends ToolCallPayload>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}

export function NyteShell() {
  const seededItems = React.useMemo(
    () => withToolCalls(createNeedsYouQueue(mockIntakeSignals, REFERENCE_NOW)),
    [],
  );
  const [queueItems, setQueueItems] = React.useState<WorkItemWithAction[]>(seededItems);
  const [activeNav, setActiveNav] = React.useState<NavId>("needs-you");
  const [handledIds, setHandledIds] = React.useState<Set<string>>(new Set());
  const [savedDrafts, setSavedDrafts] = React.useState<DraftEntry[]>([]);
  const [activityFeed, setActivityFeed] = React.useState<ActivityEntry[]>([]);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [activeItem, setActiveItem] = React.useState<WorkItemWithAction | null>(
    queueItems.at(0) ?? null,
  );
  const [editableAction, setEditableAction] = React.useState<ToolCallPayload | null>(
    activeItem ? clonePayload(activeItem.proposedAction) : null,
  );
  const { data: session, isPending: isSessionPending } = authClient.useSession();

  const needsYouItems = React.useMemo(
    () => queueItems.filter((item) => !handledIds.has(item.id)),
    [handledIds, queueItems],
  );
  const needsYouCount = needsYouItems.length;
  const processedCount = activityFeed.length;

  const navItems = React.useMemo(
    () =>
      navBlueprint.map((item) => ({
        ...item,
        count:
          item.id === "needs-you"
            ? needsYouCount
            : item.id === "drafts"
              ? savedDrafts.length
              : item.id === "processed"
                ? processedCount
                : undefined,
      })),
    [needsYouCount, processedCount, savedDrafts.length],
  );

  const openItem = React.useCallback((item: WorkItemWithAction) => {
    setActionError(null);
    setActiveItem(item);
    setEditableAction(clonePayload(item.proposedAction));
  }, []);

  const closeDrawer = React.useCallback(() => {
    setActiveItem(null);
    setEditableAction(null);
  }, []);

  const dismissItem = React.useCallback(
    (itemId: string) => {
      setActionError(null);
      setHandledIds((current) => new Set(current).add(itemId));
      const item = queueItems.find((entry) => entry.id === itemId);
      if (item) {
        setActivityFeed((current) => [
          {
            id: `${itemId}:dismissed`,
            itemId,
            actor: item.actor,
            action: item.actionLabel,
            status: "dismissed",
            detail: "Dismissed from Needs You queue.",
            at: new Date().toISOString(),
          },
          ...current,
        ]);
      }
      if (activeItem?.id === itemId) {
        closeDrawer();
      }
    },
    [activeItem?.id, closeDrawer, queueItems],
  );

  const approveActiveItem = React.useCallback(async () => {
    if (!activeItem || !editableAction) {
      return;
    }

    setActionError(null);
    setIsApproving(true);

    if (editableAction.kind === "gmail.createDraft") {
      setSavedDrafts((current) => [
        {
          ...editableAction,
          id: activeItem.id,
          actor: activeItem.actor,
        },
        ...current.filter((entry) => entry.id !== activeItem.id),
      ]);
    }

    try {
      const response = await fetch("/api/actions/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          itemId: activeItem.id,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error ?? "Unable to approve action.");
      }

      const result = (await response.json()) as ApproveResponse;
      setActivityFeed((current) => [
        {
          id: `${activeItem.id}:${result.execution.providerReference}`,
          itemId: activeItem.id,
          actor: activeItem.actor,
          action: activeItem.actionLabel,
          status: result.execution.status,
          detail: `${result.execution.destination} • ${result.execution.providerReference}`,
          at: result.execution.executedAt,
        },
        ...current,
      ]);
      setHandledIds((current) => new Set(current).add(activeItem.id));
      closeDrawer();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to approve action.");
    } finally {
      setIsApproving(false);
    }
  }, [activeItem, closeDrawer, editableAction]);

  const syncQueue = React.useCallback(async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      const response = await fetch("/api/sync/poll");
      if (!response.ok) {
        throw new Error("Unable to poll mailbox signals.");
      }

      const data = (await response.json()) as PollResponse;
      const syncedQueue = withToolCalls(data.needsYou);
      setQueueItems(syncedQueue);
      setHandledIds(new Set());
      if (activeItem) {
        const refreshedItem = syncedQueue.find((item) => item.id === activeItem.id);
        if (refreshedItem) {
          setActiveItem(refreshedItem);
          setEditableAction(clonePayload(refreshedItem.proposedAction));
        } else {
          closeDrawer();
        }
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Unable to sync queue.");
    } finally {
      setIsSyncing(false);
    }
  }, [activeItem, closeDrawer]);

  React.useEffect(() => {
    void syncQueue();
  }, [syncQueue]);

  const connectGoogle = React.useCallback(async () => {
    setConnectionError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Unable to connect Google account.",
      );
    }
  }, []);

  const disconnectGoogle = React.useCallback(async () => {
    setConnectionError(null);
    try {
      await authClient.signOut();
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Unable to disconnect Google account.",
      );
    }
  }, []);

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <Button variant="ghost" className="justify-start">
            <SparklesIcon />
            <span>Nyte</span>
          </Button>
          <div className="px-2">
            <Input defaultValue="Gmail draft an email to our largest customer about renewal timeline and next steps" />
          </div>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Supervisor Console</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeNav === item.id}
                        onClick={() => setActiveNav(item.id)}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {item.count !== undefined ? (
                        <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Card size="sm" className="bg-sidebar-accent/60 border-sidebar-border gap-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">v1 policy</CardTitle>
            </CardHeader>
            <CardContent className="text-sidebar-foreground/80 text-xs">
              Email is read-only + draft-only. Calendar creates events only after your explicit
              approval.
            </CardContent>
          </Card>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col gap-6 p-4 md:p-6">
          <header className="bg-card ring-border/70 flex items-center gap-3 rounded-xl p-3 ring-1">
            <SidebarTrigger />
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <Input defaultValue="Gmail draft an email to our largest customer about the renewal timeline and next steps" />
                <Button variant="outline" onClick={() => void syncQueue()} disabled={isSyncing}>
                  <RefreshCwIcon className={isSyncing ? "animate-spin" : ""} />
                  Sync
                </Button>
                <Button>Go</Button>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span>@ Add context</span>
                <Badge variant="secondary">Gmail</Badge>
                <Badge variant="secondary">Calendar</Badge>
              </div>
              {syncError ? <p className="text-destructive text-xs">{syncError}</p> : null}
            </div>
          </header>
          <ToolIntentLegend />

          <section className="space-y-3">
            {activeNav === "needs-you" ? (
              needsYouItems.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>All clear</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    No work items are currently passing the strict needs-you gates.
                  </CardContent>
                </Card>
              ) : (
                needsYouItems.map((item) => (
                  <Card key={item.id} className="gap-3">
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <Badge variant="outline">{item.actor}</Badge>
                        <span className="text-muted-foreground text-sm">from {item.source}</span>
                      </CardTitle>
                      <p className="text-muted-foreground text-sm">{item.summary}</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{item.context}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.gates.map((gate) => (
                          <Badge key={gate} variant="secondary">
                            {GATE_LABEL[gate]}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="justify-between">
                      <Button
                        variant="ghost"
                        className="justify-start px-0 text-sm"
                        onClick={() => openItem(item)}
                      >
                        {sourceIcon(item.type)}
                        <span>{item.actionLabel}</span>
                        <ChevronRightIcon className="size-4" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => dismissItem(item.id)}>
                          {item.secondaryLabel}
                        </Button>
                        <Button onClick={() => openItem(item)}>
                          {item.type === "calendar" ? (
                            <CalendarCheck2Icon />
                          ) : item.type === "refund" ? (
                            <WalletIcon />
                          ) : (
                            <InboxIcon />
                          )}
                          {item.cta}
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                ))
              )
            ) : null}

            {activeNav === "drafts" ? (
              savedDrafts.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No saved drafts yet</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    Approving a draft action immediately saves it to Gmail Drafts.
                  </CardContent>
                </Card>
              ) : (
                savedDrafts.map((draft) => (
                  <Card key={draft.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Badge>{draft.actor}</Badge>
                        <span className="text-muted-foreground text-sm">gmail draft</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm">{draft.subject}</p>
                      <p className="text-muted-foreground text-xs">to {draft.to.join(", ")}</p>
                      <p className="text-muted-foreground line-clamp-2 text-xs">{draft.body}</p>
                    </CardContent>
                  </Card>
                ))
              )
            ) : null}

            {activeNav === "processed" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Processed activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    {processedCount} items were processed from the triage queue this session.
                  </p>
                  {activityFeed.length > 0 ? (
                    <div className="space-y-2">
                      {activityFeed.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-muted/40 border-border rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant={entry.status === "executed" ? "secondary" : "outline"}>
                              {entry.status}
                            </Badge>
                            <span className="font-medium">{entry.actor}</span>
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">{entry.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No actions have been processed yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {activeNav === "connections" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Connections</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    Google auth foundation is configured for Gmail (read + draft) and Calendar event
                    creation.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={session ? "secondary" : "outline"}>
                      {session ? "Connected" : "Not connected"}
                    </Badge>
                    <Button
                      disabled={isSessionPending}
                      onClick={session ? disconnectGoogle : connectGoogle}
                    >
                      {session ? "Disconnect Google" : "Connect Google"}
                    </Button>
                  </div>
                  {connectionError ? (
                    <p className="text-destructive text-xs">{connectionError}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {activeNav === "rules" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Rules</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-sm">
                  Watch rules and strict gate tuning surface is next in roadmap.
                </CardContent>
              </Card>
            ) : null}
          </section>
        </div>
      </SidebarInset>

      <Sheet
        open={Boolean(activeItem)}
        onOpenChange={(open) => (!open ? closeDrawer() : undefined)}
      >
        <SheetContent side="right" className="sm:max-w-lg">
          {activeItem && editableAction ? (
            <>
              <SheetHeader>
                <SheetTitle>{activeItem.actionLabel}</SheetTitle>
                <SheetDescription>{activeItem.preview}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs uppercase">Tool intent</p>
                  <Badge variant="outline">{editableAction.kind}</Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs uppercase">Actor</p>
                  <Input value={activeItem.actor} readOnly />
                </div>

                {editableAction.kind === "gmail.createDraft" ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">To</p>
                      <Input
                        value={editableAction.to.join(", ")}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            to: event.currentTarget.value
                              .split(",")
                              .map((entry) => entry.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Subject</p>
                      <Input
                        value={editableAction.subject}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            subject: event.currentTarget.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Draft body</p>
                      <Textarea
                        value={editableAction.body}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            body: event.currentTarget.value,
                          })
                        }
                        className="min-h-44"
                      />
                    </div>
                  </>
                ) : null}

                {editableAction.kind === "google-calendar.createEvent" ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Title</p>
                      <Input
                        value={editableAction.title}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            title: event.currentTarget.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs uppercase">Starts at</p>
                        <Input
                          value={editableAction.startsAt}
                          onChange={(event) =>
                            setEditableAction({
                              ...editableAction,
                              startsAt: event.currentTarget.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs uppercase">Ends at</p>
                        <Input
                          value={editableAction.endsAt}
                          onChange={(event) =>
                            setEditableAction({
                              ...editableAction,
                              endsAt: event.currentTarget.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Attendees</p>
                      <Input
                        value={editableAction.attendees.join(", ")}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            attendees: event.currentTarget.value
                              .split(",")
                              .map((entry) => entry.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Description</p>
                      <Textarea
                        value={editableAction.description}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            description: event.currentTarget.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}

                {editableAction.kind === "billing.queueRefund" ? (
                  <>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Customer</p>
                      <Input value={editableAction.customerName} readOnly />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs uppercase">Amount</p>
                        <Input
                          value={String(editableAction.amount)}
                          onChange={(event) =>
                            setEditableAction({
                              ...editableAction,
                              amount: Number(event.currentTarget.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs uppercase">Currency</p>
                        <Input value={editableAction.currency} readOnly />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs uppercase">Reason</p>
                      <Textarea
                        value={editableAction.reason}
                        onChange={(event) =>
                          setEditableAction({
                            ...editableAction,
                            reason: event.currentTarget.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <SheetFooter className="sm:flex-row sm:justify-between">
                <div className="space-y-1">
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Clock3Icon className="size-3.5" />
                    strict-gate validated
                  </div>
                  {actionError ? <p className="text-destructive text-xs">{actionError}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => dismissItem(activeItem.id)}>
                    Dismiss
                  </Button>
                  <Button onClick={() => void approveActiveItem()} disabled={isApproving}>
                    {isApproving ? "Approving..." : activeItem.cta}
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}

function ToolIntentLegend() {
  return (
    <Card className="gap-2 border-dashed">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Tool-call rendered UI</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground flex items-start gap-2 text-xs">
        <TextSearchIcon className="mt-0.5 size-3.5 shrink-0" />
        Model emits typed payloads, UI renders structured controls, and one-click approval executes
        action.
      </CardContent>
    </Card>
  );
}
