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
  needsYou: WorkItemWithAction[];
  drafts: DraftEntry[];
  processed: ActivityEntry[];
  cursor: string;
};

type ApproveResponse = {
  execution: {
    status: "executed";
    destination: "gmail_drafts" | "google_calendar" | "refund_queue";
    providerReference: string;
    executedAt: string;
  };
};

type DismissResponse = {
  itemId: string;
  status: "dismissed";
  dismissedAt: string;
};

type WorkflowTimelineResponse = {
  itemId: string;
  timeline: Array<{
    runId: string;
    phase: string;
    status: string;
    at: string;
    events: Array<{
      kind: string;
      payload: Record<string, unknown>;
      at: string;
    }>;
  }>;
};

type MetricsResponse = {
  generatedAt: string;
  awaitingCount: number;
  completedCount: number;
  dismissedCount: number;
  interruptionPrecision: number;
  approvalRate: number;
  medianDecisionMinutes: number;
  gateHitCounts: {
    decision: number;
    time: number;
    relationship: number;
    impact: number;
    watch: number;
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
  const [isDismissingId, setIsDismissingId] = React.useState<string | null>(null);
  const [syncCursor, setSyncCursor] = React.useState<string | null>(null);
  const [workflowTimeline, setWorkflowTimeline] = React.useState<
    WorkflowTimelineResponse["timeline"]
  >([]);
  const [isTimelineLoading, setIsTimelineLoading] = React.useState(false);
  const [timelineError, setTimelineError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<MetricsResponse | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = React.useState(false);
  const [metricsError, setMetricsError] = React.useState<string | null>(null);
  const [watchRuleInput, setWatchRuleInput] = React.useState("");
  const [watchRules, setWatchRules] = React.useState<string[]>([]);
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

  const applyDashboard = React.useCallback(
    (dashboard: Pick<PollResponse, "needsYou" | "drafts" | "processed">) => {
      setQueueItems(dashboard.needsYou);
      setSavedDrafts(dashboard.drafts);
      setActivityFeed(dashboard.processed);
      setHandledIds(new Set());

      setActiveItem((current) => {
        if (!current) {
          return dashboard.needsYou.at(0) ?? null;
        }

        return dashboard.needsYou.find((item) => item.id === current.id) ?? null;
      });
    },
    [],
  );

  const refreshDashboard = React.useCallback(async () => {
    const response = await fetch("/api/dashboard");
    if (!response.ok) {
      throw new Error("Unable to refresh dashboard.");
    }

    const dashboard = (await response.json()) as Pick<
      PollResponse,
      "needsYou" | "drafts" | "processed"
    >;
    applyDashboard(dashboard);
  }, [applyDashboard]);

  const refreshMetrics = React.useCallback(async () => {
    setMetricsError(null);
    setIsMetricsLoading(true);
    try {
      const response = await fetch("/api/metrics");
      if (!response.ok) {
        throw new Error("Unable to refresh metrics.");
      }

      const snapshot = (await response.json()) as MetricsResponse;
      setMetrics(snapshot);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : "Unable to refresh metrics.");
    } finally {
      setIsMetricsLoading(false);
    }
  }, []);

  const openItem = React.useCallback((item: WorkItemWithAction) => {
    setActionError(null);
    setActiveItem(item);
    setEditableAction(clonePayload(item.proposedAction));
  }, []);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("nyte.watch-rules");
    if (!stored) {
      setWatchRules(["renewal", "board", "vip"]);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as string[];
      setWatchRules(Array.isArray(parsed) ? parsed : []);
    } catch {
      setWatchRules(["renewal", "board", "vip"]);
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem("nyte.watch-rules", JSON.stringify(watchRules));
  }, [watchRules]);

  React.useEffect(() => {
    if (!activeItem) {
      setEditableAction(null);
      return;
    }

    setEditableAction(clonePayload(activeItem.proposedAction));
  }, [activeItem]);

  React.useEffect(() => {
    if (!activeItem) {
      setWorkflowTimeline([]);
      setTimelineError(null);
      return;
    }

    let cancelled = false;

    const loadTimeline = async () => {
      setTimelineError(null);
      setIsTimelineLoading(true);
      try {
        const response = await fetch(`/api/workflows/${activeItem.id}`);
        if (!response.ok) {
          throw new Error("Unable to load workflow timeline.");
        }

        const data = (await response.json()) as WorkflowTimelineResponse;
        if (!cancelled) {
          setWorkflowTimeline(data.timeline);
        }
      } catch (error) {
        if (!cancelled) {
          setTimelineError(
            error instanceof Error ? error.message : "Unable to load workflow timeline.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsTimelineLoading(false);
        }
      }
    };

    void loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [activeItem]);

  const closeDrawer = React.useCallback(() => {
    setActiveItem(null);
    setEditableAction(null);
  }, []);

  const dismissItem = React.useCallback(
    async (item: WorkItemWithAction) => {
      setActionError(null);
      setIsDismissingId(item.id);
      try {
        const response = await fetch("/api/actions/dismiss", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            itemId: item.id,
          }),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorBody?.error ?? "Unable to dismiss item.");
        }

        (await response.json()) as DismissResponse;

        if (activeItem?.id === item.id) {
          closeDrawer();
        }
        await refreshDashboard();
        await refreshMetrics();
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Unable to dismiss item.");
      } finally {
        setIsDismissingId(null);
      }
    },
    [activeItem?.id, closeDrawer, refreshDashboard, refreshMetrics],
  );

  const approveActiveItem = React.useCallback(async () => {
    if (!activeItem || !editableAction) {
      return;
    }

    setActionError(null);
    setIsApproving(true);

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

      (await response.json()) as ApproveResponse;
      closeDrawer();
      await refreshDashboard();
      await refreshMetrics();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to approve action.");
    } finally {
      setIsApproving(false);
    }
  }, [activeItem, closeDrawer, editableAction, refreshDashboard, refreshMetrics]);

  const syncQueue = React.useCallback(async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      const url = syncCursor
        ? `/api/sync/poll?cursor=${encodeURIComponent(syncCursor)}`
        : "/api/sync/poll";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Unable to poll mailbox signals.");
      }

      const data = (await response.json()) as PollResponse;
      setSyncCursor(data.cursor);
      applyDashboard(data);
      await refreshMetrics();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Unable to sync queue.");
    } finally {
      setIsSyncing(false);
    }
  }, [applyDashboard, refreshMetrics, syncCursor]);

  React.useEffect(() => {
    void syncQueue();
    void refreshMetrics();
  }, [refreshMetrics, syncQueue]);

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

  const addWatchRule = React.useCallback(() => {
    const normalized = watchRuleInput.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    setWatchRules((current) =>
      current.includes(normalized) ? current : [normalized, ...current].slice(0, 12),
    );
    setWatchRuleInput("");
  }, [watchRuleInput]);

  const removeWatchRule = React.useCallback((rule: string) => {
    setWatchRules((current) => current.filter((entry) => entry !== rule));
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
                        <Button
                          variant="outline"
                          onClick={() => void dismissItem(item)}
                          disabled={isDismissingId === item.id}
                        >
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
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Supervisor metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isMetricsLoading ? (
                      <p className="text-muted-foreground text-sm">Loading metrics…</p>
                    ) : metricsError ? (
                      <p className="text-destructive text-sm">{metricsError}</p>
                    ) : metrics ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                            <p className="text-muted-foreground text-xs">Interruption precision</p>
                            <p className="text-lg font-semibold">
                              {metrics.interruptionPrecision}%
                            </p>
                          </div>
                          <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                            <p className="text-muted-foreground text-xs">Approval rate</p>
                            <p className="text-lg font-semibold">{metrics.approvalRate}%</p>
                          </div>
                          <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                            <p className="text-muted-foreground text-xs">Median decision time</p>
                            <p className="text-lg font-semibold">
                              {metrics.medianDecisionMinutes} min
                            </p>
                          </div>
                          <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                            <p className="text-muted-foreground text-xs">Awaiting decisions</p>
                            <p className="text-lg font-semibold">{metrics.awaitingCount}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-muted-foreground text-xs uppercase">
                            Gate hit distribution
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(metrics.gateHitCounts).map(([gate, count]) => (
                              <Badge key={gate} variant="secondary">
                                {gate}: {count}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">No metrics yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Watch gate tuning</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                      Add watch keywords to force escalation into Needs You whenever matching
                      signals appear.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={watchRuleInput}
                        onChange={(event) => setWatchRuleInput(event.currentTarget.value)}
                        placeholder="Add watch keyword (e.g. renewal)"
                      />
                      <Button variant="outline" onClick={addWatchRule}>
                        Add
                      </Button>
                    </div>
                    {watchRules.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {watchRules.map((rule) => (
                          <Button
                            key={rule}
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => removeWatchRule(rule)}
                          >
                            {rule}
                            <ChevronRightIcon className="size-3 rotate-90" />
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        No watch rules yet. Add one to tighten escalation.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
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

                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs uppercase">Workflow timeline</p>
                  {isTimelineLoading ? (
                    <p className="text-muted-foreground text-xs">Loading timeline...</p>
                  ) : timelineError ? (
                    <p className="text-destructive text-xs">{timelineError}</p>
                  ) : workflowTimeline.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      No workflow events recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {workflowTimeline.map((run) => (
                        <div
                          key={run.runId}
                          className="bg-muted/40 border-border rounded-lg border p-2"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline">{run.phase}</Badge>
                            <span className="text-muted-foreground">{run.status}</span>
                          </div>
                          <div className="mt-2 space-y-1">
                            {run.events.map((event) => (
                              <div
                                key={`${run.runId}:${event.kind}:${event.at}`}
                                className="text-xs"
                              >
                                <span className="font-medium">{event.kind}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  <Button
                    variant="outline"
                    onClick={() => void dismissItem(activeItem)}
                    disabled={isDismissingId === activeItem.id}
                  >
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
