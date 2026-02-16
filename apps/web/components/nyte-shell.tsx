"use client";

import * as React from "react";
import {
  withToolCalls,
  type GmailCreateDraftToolCall,
  type ToolCallPayload,
  type WorkItemWithAction,
} from "@workspace/domain/actions";
import { mockIntakeSignals } from "@workspace/domain/mock-intake";
import { createNeedsYouQueue, GATE_LABEL, type WorkItem } from "@workspace/domain/triage";
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
  ThumbsDownIcon,
  ThumbsUpIcon,
  TextSearchIcon,
  WalletIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";

import { authClient } from "@/lib/auth-client";
import { fetchJsonResult } from "@/lib/client/fetch-json-result";
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
  feedback: "positive" | "negative" | null;
};

type PollResponse = {
  needsYou: WorkItemWithAction[];
  drafts: DraftEntry[];
  processed: ActivityEntry[];
  cursor: string;
};

type ApproveResponse = {
  idempotent: boolean;
  execution: {
    status: "executed";
    destination: "gmail_drafts" | "google_calendar" | "refund_queue";
    providerReference: string;
    idempotencyKey: string;
    executedAt: string;
  };
};

type DismissResponse = {
  itemId: string;
  status: "dismissed";
  dismissedAt: string;
  idempotent: boolean;
};

type FeedbackResponse = {
  itemId: string;
  rating: "positive" | "negative";
  notedAt: string;
};

type PolicyRulesResponse = {
  watchKeywords: string[];
};

type GoogleConnectionResponse = {
  connected: boolean;
  provider: "google";
  providerAccountId: string | null;
  scopes: string[];
  connectedAt: string | null;
  updatedAt: string | null;
};

type RotateConnectionResponse = {
  rotated: boolean;
  status: GoogleConnectionResponse;
};

type WorkflowRetentionResponse = {
  days: number;
  source: "default" | "policy" | "env";
};

type WorkflowPruneResponse = {
  retentionDays: number | null;
  source: "default" | "policy" | "env" | null;
  prunedRuns: number;
  prunedAuditLogs: number;
  cutoff: string | null;
  performed: boolean;
  triggeredBy: "manual" | "auto";
};

type TrustReportResponse = {
  generatedAt: string;
  watchRuleCount: number;
  retention: WorkflowRetentionResponse;
  googleConnection: GoogleConnectionResponse;
  metrics: MetricsResponse;
  security: {
    authzEnforced: boolean;
    authSecretConfigured: boolean;
    authSecretSource: "env" | "dev-fallback";
    tokenEncryptionKeyConfigured: boolean;
    tokenEncryptionKeySource: "env" | "dev-fallback";
    hasPreviousTokenKey: boolean;
    rateLimitMode: "auto" | "memory" | "unkey";
    rateLimitProvider: "unkey" | "memory";
    unkeyRateLimitConfigured: boolean;
    unkeyRateLimitActive: boolean;
  };
  posture: {
    status: "ok" | "warning";
    warnings: string[];
  };
  audit: {
    recentCount: number;
    latestAction: string | null;
  };
};

type AuditLogEntry = {
  id: string;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type AuditLogsResponse = {
  count: number;
  totalCount: number;
  hasMore: boolean;
  limit: number;
  offset: number;
  rows: AuditLogEntry[];
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
  feedbackCount: number;
  positiveFeedbackRate: number;
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

function createAsyncActionError(error: unknown, fallback: string): Error {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error;
  }

  return new Error(fallback);
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
  const [googleConnection, setGoogleConnection] = React.useState<GoogleConnectionResponse | null>(
    null,
  );
  const [isConnectionLoading, setIsConnectionLoading] = React.useState(false);
  const [isRotatingConnectionSecrets, setIsRotatingConnectionSecrets] = React.useState(false);
  const [connectionNotice, setConnectionNotice] = React.useState<string | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isApproving, setIsApproving] = React.useState(false);
  const [isDismissingId, setIsDismissingId] = React.useState<string | null>(null);
  const [isSubmittingFeedbackId, setIsSubmittingFeedbackId] = React.useState<string | null>(null);
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
  const [isRulesLoading, setIsRulesLoading] = React.useState(false);
  const [rulesError, setRulesError] = React.useState<string | null>(null);
  const [retentionDays, setRetentionDays] = React.useState<number>(30);
  const [retentionSource, setRetentionSource] =
    React.useState<WorkflowRetentionResponse["source"]>("default");
  const [isRetentionLoading, setIsRetentionLoading] = React.useState(false);
  const [retentionError, setRetentionError] = React.useState<string | null>(null);
  const [pruneResult, setPruneResult] = React.useState<WorkflowPruneResponse | null>(null);
  const [trustReport, setTrustReport] = React.useState<TrustReportResponse | null>(null);
  const [isTrustReportLoading, setIsTrustReportLoading] = React.useState(false);
  const [trustReportError, setTrustReportError] = React.useState<string | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogEntry[]>([]);
  const [auditLogsTotalCount, setAuditLogsTotalCount] = React.useState(0);
  const [isAuditLogsLoading, setIsAuditLogsLoading] = React.useState(false);
  const [auditLogsError, setAuditLogsError] = React.useState<string | null>(null);
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
    const result = await fetchJsonResult<Pick<PollResponse, "needsYou" | "drafts" | "processed">>(
      "/api/dashboard",
      undefined,
      "Unable to refresh dashboard.",
    );

    if (result.isOk()) {
      applyDashboard(result.value);
    }

    return result;
  }, [applyDashboard]);

  const refreshMetrics = React.useCallback(async () => {
    setMetricsError(null);
    setIsMetricsLoading(true);
    const result = await fetchJsonResult<MetricsResponse>(
      "/api/metrics",
      undefined,
      "Unable to refresh metrics.",
    );

    if (result.isOk()) {
      setMetrics(result.value);
    } else {
      setMetricsError(result.error.message);
    }

    setIsMetricsLoading(false);
    return result;
  }, []);

  const refreshWatchRules = React.useCallback(async () => {
    setRulesError(null);
    setIsRulesLoading(true);
    const result = await fetchJsonResult<PolicyRulesResponse>(
      "/api/policy-rules",
      undefined,
      "Unable to load watch rules.",
    );

    if (result.isOk()) {
      setWatchRules(result.value.watchKeywords);
    } else {
      setRulesError(result.error.message);
    }

    setIsRulesLoading(false);
    return result;
  }, []);

  const refreshGoogleConnection = React.useCallback(async () => {
    setConnectionError(null);
    setConnectionNotice(null);
    setIsConnectionLoading(true);
    const result = await fetchJsonResult<GoogleConnectionResponse>(
      "/api/connections/google",
      undefined,
      "Unable to load Google connection.",
    );

    if (result.isOk()) {
      setGoogleConnection(result.value);
    } else {
      setConnectionError(result.error.message);
    }

    setIsConnectionLoading(false);
    return result;
  }, []);

  const refreshWorkflowRetention = React.useCallback(async () => {
    setRetentionError(null);
    setIsRetentionLoading(true);
    const result = await fetchJsonResult<WorkflowRetentionResponse>(
      "/api/workflows/retention",
      undefined,
      "Unable to load workflow retention.",
    );

    if (result.isOk()) {
      setRetentionDays(result.value.days);
      setRetentionSource(result.value.source);
    } else {
      setRetentionError(result.error.message);
    }

    setIsRetentionLoading(false);
    return result;
  }, []);

  const refreshTrustReport = React.useCallback(async () => {
    setTrustReportError(null);
    setIsTrustReportLoading(true);
    const result = await fetchJsonResult<TrustReportResponse>(
      "/api/admin/trust",
      undefined,
      "Unable to load trust report.",
    );

    if (result.isOk()) {
      setTrustReport(result.value);
    } else {
      setTrustReportError(result.error.message);
    }

    setIsTrustReportLoading(false);
    return result;
  }, []);

  const refreshAuditLogs = React.useCallback(
    async ({ offset = 0, append = false }: { offset?: number; append?: boolean } = {}) => {
      setAuditLogsError(null);
      setIsAuditLogsLoading(true);
      const result = await fetchJsonResult<AuditLogsResponse>(
        `/api/admin/audit?limit=12&offset=${offset}`,
        undefined,
        "Unable to load audit logs.",
      );

      if (result.isOk()) {
        setAuditLogsTotalCount(result.value.totalCount);
        setAuditLogs((current) =>
          append ? [...current, ...result.value.rows] : result.value.rows,
        );
      } else {
        setAuditLogsError(result.error.message);
      }

      setIsAuditLogsLoading(false);
      return result;
    },
    [],
  );

  const openItem = React.useCallback((item: WorkItemWithAction) => {
    setActionError(null);
    setActiveItem(item);
    setEditableAction(clonePayload(item.proposedAction));
  }, []);

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
      const result = await fetchJsonResult<WorkflowTimelineResponse>(
        `/api/workflows/${activeItem.id}`,
        undefined,
        "Unable to load workflow timeline.",
      );

      if (!cancelled) {
        if (result.isOk()) {
          setWorkflowTimeline(result.value.timeline);
        } else {
          setTimelineError(result.error.message);
        }
        setIsTimelineLoading(false);
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
      const dismissResult = await fetchJsonResult<DismissResponse>(
        "/api/actions/dismiss",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            itemId: item.id,
          }),
        },
        "Unable to dismiss item.",
      );

      if (dismissResult.isErr()) {
        setActionError(dismissResult.error.message);
        setIsDismissingId(null);
        return;
      }

      if (activeItem?.id === item.id) {
        closeDrawer();
      }

      const dashboardResult = await refreshDashboard();
      if (dashboardResult.isErr()) {
        setActionError(dashboardResult.error.message);
        setIsDismissingId(null);
        return;
      }

      const metricsResult = await refreshMetrics();
      if (metricsResult.isErr()) {
        setActionError(metricsResult.error.message);
        setIsDismissingId(null);
        return;
      }

      const trustResult = await refreshTrustReport();
      if (trustResult.isErr()) {
        setActionError(trustResult.error.message);
      }

      setIsDismissingId(null);
    },
    [activeItem?.id, closeDrawer, refreshDashboard, refreshMetrics, refreshTrustReport],
  );

  const approveActiveItem = React.useCallback(async () => {
    if (!activeItem || !editableAction) {
      return;
    }

    setActionError(null);
    setIsApproving(true);
    const idempotencyKey = `approve:${activeItem.id}`;
    const approveResult = await fetchJsonResult<ApproveResponse>(
      "/api/actions/approve",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          itemId: activeItem.id,
          idempotencyKey,
        }),
      },
      "Unable to approve action.",
    );

    if (approveResult.isErr()) {
      setActionError(approveResult.error.message);
      setIsApproving(false);
      return;
    }

    closeDrawer();

    const dashboardResult = await refreshDashboard();
    if (dashboardResult.isErr()) {
      setActionError(dashboardResult.error.message);
      setIsApproving(false);
      return;
    }

    const metricsResult = await refreshMetrics();
    if (metricsResult.isErr()) {
      setActionError(metricsResult.error.message);
      setIsApproving(false);
      return;
    }

    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      setActionError(trustResult.error.message);
    }

    setIsApproving(false);
  }, [
    activeItem,
    closeDrawer,
    editableAction,
    refreshDashboard,
    refreshMetrics,
    refreshTrustReport,
  ]);

  const syncQueue = React.useCallback(async () => {
    setSyncError(null);
    setIsSyncing(true);
    const url = syncCursor
      ? `/api/sync/poll?cursor=${encodeURIComponent(syncCursor)}`
      : "/api/sync/poll";
    const result = await fetchJsonResult<PollResponse>(
      url,
      undefined,
      "Unable to poll mailbox signals.",
    );

    if (result.isOk()) {
      setSyncCursor(result.value.cursor);
      applyDashboard(result.value);
      void refreshMetrics();
      void refreshTrustReport();
    } else {
      setSyncError(result.error.message);
    }

    setIsSyncing(false);
    return result;
  }, [applyDashboard, refreshMetrics, refreshTrustReport, syncCursor]);

  React.useEffect(() => {
    void syncQueue();
    void refreshMetrics();
    void refreshWatchRules();
    void refreshGoogleConnection();
    void refreshWorkflowRetention();
    void refreshTrustReport();
    void refreshAuditLogs();
  }, [
    refreshAuditLogs,
    refreshGoogleConnection,
    refreshMetrics,
    refreshTrustReport,
    refreshWatchRules,
    refreshWorkflowRetention,
    syncQueue,
  ]);

  const persistGoogleConnection = React.useCallback(async () => {
    const result = await fetchJsonResult<GoogleConnectionResponse>(
      "/api/connections/google",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      },
      "Unable to persist Google connection.",
    );

    if (result.isErr()) {
      return result;
    }

    setGoogleConnection(result.value);
    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      return trustResult.map(() => result.value);
    }

    return result;
  }, [refreshTrustReport]);

  React.useEffect(() => {
    if (!session || googleConnection?.connected) {
      return;
    }

    void persistGoogleConnection().then((result) => {
      if (result.isErr()) {
        setConnectionError(result.error.message);
      }
    });
  }, [googleConnection?.connected, persistGoogleConnection, session]);

  const trustReportGeneratedAt = trustReport?.generatedAt;

  React.useEffect(() => {
    if (!trustReportGeneratedAt) {
      return;
    }

    void refreshAuditLogs();
  }, [refreshAuditLogs, trustReportGeneratedAt]);

  const connectGoogle = React.useCallback(async () => {
    setConnectionError(null);
    setConnectionNotice(null);
    const result = await ResultAsync.fromPromise(
      authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      }),
      (error) => createAsyncActionError(error, "Unable to connect Google account."),
    );

    if (result.isErr()) {
      setConnectionError(result.error.message);
    }
  }, []);

  const disconnectGoogle = React.useCallback(async () => {
    setConnectionError(null);
    setConnectionNotice(null);
    const disconnectResult = await fetchJsonResult<GoogleConnectionResponse>(
      "/api/connections/google",
      {
        method: "DELETE",
      },
      "Unable to disconnect Google connection.",
    );

    if (disconnectResult.isErr()) {
      setConnectionError(disconnectResult.error.message);
      return;
    }

    setGoogleConnection(disconnectResult.value);
    const signOutResult = await ResultAsync.fromPromise(authClient.signOut(), (error) =>
      createAsyncActionError(error, "Unable to disconnect Google account."),
    );
    if (signOutResult.isErr()) {
      setConnectionError(signOutResult.error.message);
      return;
    }

    setConnectionNotice("Disconnected Google OAuth and cleared encrypted credentials.");
    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      setConnectionError(trustResult.error.message);
    }
  }, [refreshTrustReport]);

  const rotateConnectionSecrets = React.useCallback(async () => {
    setConnectionError(null);
    setConnectionNotice(null);
    setIsRotatingConnectionSecrets(true);
    const rotateResult = await fetchJsonResult<RotateConnectionResponse>(
      "/api/connections/google/rotate",
      {
        method: "POST",
      },
      "Unable to rotate encrypted secrets.",
    );

    if (rotateResult.isErr()) {
      setConnectionError(rotateResult.error.message);
      setIsRotatingConnectionSecrets(false);
      return;
    }

    setGoogleConnection(rotateResult.value.status);
    setConnectionNotice(
      rotateResult.value.rotated
        ? "Encrypted connection secrets were re-keyed using current key material."
        : "No connection secrets were found to rotate.",
    );
    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      setConnectionError(trustResult.error.message);
    }

    setIsRotatingConnectionSecrets(false);
  }, [refreshTrustReport]);

  const addWatchRule = React.useCallback(async () => {
    const normalized = watchRuleInput.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    setRulesError(null);
    setIsRulesLoading(true);
    const addResult = await fetchJsonResult<PolicyRulesResponse>(
      "/api/policy-rules",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          keyword: normalized,
        }),
      },
      "Unable to add watch rule.",
    );

    if (addResult.isErr()) {
      setRulesError(addResult.error.message);
      setIsRulesLoading(false);
      return;
    }

    setWatchRuleInput("");
    const watchRulesResult = await refreshWatchRules();
    if (watchRulesResult.isErr()) {
      setRulesError(watchRulesResult.error.message);
      setIsRulesLoading(false);
      return;
    }

    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      setRulesError(trustResult.error.message);
    }

    setIsRulesLoading(false);
  }, [refreshTrustReport, refreshWatchRules, watchRuleInput]);

  const removeWatchRule = React.useCallback(
    async (rule: string) => {
      setRulesError(null);
      setIsRulesLoading(true);
      const removeResult = await fetchJsonResult<PolicyRulesResponse>(
        "/api/policy-rules",
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            keyword: rule,
          }),
        },
        "Unable to remove watch rule.",
      );

      if (removeResult.isErr()) {
        setRulesError(removeResult.error.message);
        setIsRulesLoading(false);
        return;
      }

      const watchRulesResult = await refreshWatchRules();
      if (watchRulesResult.isErr()) {
        setRulesError(watchRulesResult.error.message);
        setIsRulesLoading(false);
        return;
      }

      const trustResult = await refreshTrustReport();
      if (trustResult.isErr()) {
        setRulesError(trustResult.error.message);
      }

      setIsRulesLoading(false);
    },
    [refreshTrustReport, refreshWatchRules],
  );

  const saveWorkflowRetention = React.useCallback(async () => {
    setRetentionError(null);
    setIsRetentionLoading(true);
    const saveResult = await fetchJsonResult<WorkflowRetentionResponse>(
      "/api/workflows/retention",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          days: retentionDays,
        }),
      },
      "Unable to update workflow retention.",
    );

    if (saveResult.isErr()) {
      setRetentionError(saveResult.error.message);
      setIsRetentionLoading(false);
      return;
    }

    setRetentionDays(saveResult.value.days);
    setRetentionSource(saveResult.value.source);
    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      setRetentionError(trustResult.error.message);
    }

    setIsRetentionLoading(false);
  }, [refreshTrustReport, retentionDays]);

  const pruneWorkflowHistoryNow = React.useCallback(async () => {
    setRetentionError(null);
    setIsRetentionLoading(true);
    const pruneResult = await fetchJsonResult<WorkflowPruneResponse>(
      "/api/workflows/prune",
      {
        method: "POST",
      },
      "Unable to prune workflow history.",
    );

    if (pruneResult.isErr()) {
      setRetentionError(pruneResult.error.message);
      setIsRetentionLoading(false);
      return;
    }

    setPruneResult(pruneResult.value);
    if (pruneResult.value.retentionDays !== null) {
      setRetentionDays(pruneResult.value.retentionDays);
    }
    if (pruneResult.value.source !== null) {
      setRetentionSource(pruneResult.value.source);
    }

    const metricsResult = await refreshMetrics();
    if (metricsResult.isErr()) {
      setRetentionError(metricsResult.error.message);
      setIsRetentionLoading(false);
      return;
    }

    const dashboardResult = await refreshDashboard();
    if (dashboardResult.isErr()) {
      setRetentionError(dashboardResult.error.message);
      setIsRetentionLoading(false);
      return;
    }

    const trustResult = await refreshTrustReport();
    if (trustResult.isErr()) {
      setRetentionError(trustResult.error.message);
    }

    setIsRetentionLoading(false);
  }, [refreshDashboard, refreshMetrics, refreshTrustReport]);

  const submitFeedback = React.useCallback(
    async (itemId: string, rating: "positive" | "negative") => {
      setActionError(null);
      setIsSubmittingFeedbackId(itemId);
      setActivityFeed((current) =>
        current.map((entry) => (entry.itemId === itemId ? { ...entry, feedback: rating } : entry)),
      );

      const feedbackResult = await fetchJsonResult<FeedbackResponse>(
        "/api/feedback",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            itemId,
            rating,
          }),
        },
        "Unable to record feedback.",
      );

      if (feedbackResult.isErr()) {
        setActionError(feedbackResult.error.message);
        void refreshDashboard();
        setIsSubmittingFeedbackId(null);
        return;
      }

      const dashboardResult = await refreshDashboard();
      if (dashboardResult.isErr()) {
        setActionError(dashboardResult.error.message);
        setIsSubmittingFeedbackId(null);
        return;
      }

      const metricsResult = await refreshMetrics();
      if (metricsResult.isErr()) {
        setActionError(metricsResult.error.message);
        setIsSubmittingFeedbackId(null);
        return;
      }

      const trustResult = await refreshTrustReport();
      if (trustResult.isErr()) {
        setActionError(trustResult.error.message);
      }

      setIsSubmittingFeedbackId(null);
    },
    [refreshDashboard, refreshMetrics, refreshTrustReport],
  );

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
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={entry.status === "executed" ? "secondary" : "outline"}
                              >
                                {entry.status}
                              </Badge>
                              <span className="font-medium">{entry.actor}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={entry.feedback === "positive" ? "secondary" : "outline"}
                                disabled={isSubmittingFeedbackId === entry.itemId}
                                onClick={() => void submitFeedback(entry.itemId, "positive")}
                              >
                                <ThumbsUpIcon />
                              </Button>
                              <Button
                                size="sm"
                                variant={entry.feedback === "negative" ? "secondary" : "outline"}
                                disabled={isSubmittingFeedbackId === entry.itemId}
                                onClick={() => void submitFeedback(entry.itemId, "negative")}
                              >
                                <ThumbsDownIcon />
                              </Button>
                            </div>
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
                    Google auth is configured for Gmail (read + draft) and Calendar event creation.
                    Connection credentials are persisted server-side with encrypted token storage.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={session ? "secondary" : "outline"}>
                      {session ? "OAuth session active" : "OAuth session inactive"}
                    </Badge>
                    <Badge variant={googleConnection?.connected ? "secondary" : "outline"}>
                      {googleConnection?.connected
                        ? "Token vault connected"
                        : "Token vault inactive"}
                    </Badge>
                    <Button
                      disabled={isSessionPending || isConnectionLoading}
                      onClick={session ? disconnectGoogle : connectGoogle}
                    >
                      {session ? "Disconnect Google" : "Connect Google"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isConnectionLoading}
                      onClick={() => void refreshGoogleConnection()}
                    >
                      Refresh status
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isRotatingConnectionSecrets || !googleConnection?.connected}
                      onClick={() => void rotateConnectionSecrets()}
                    >
                      Rotate encrypted secrets
                    </Button>
                  </div>
                  {isConnectionLoading ? (
                    <p className="text-muted-foreground text-xs">Refreshing connection status…</p>
                  ) : null}
                  {isRotatingConnectionSecrets ? (
                    <p className="text-muted-foreground text-xs">Rotating encrypted secrets…</p>
                  ) : null}
                  {googleConnection?.connected ? (
                    <div className="bg-muted/40 border-border rounded-lg border px-3 py-2 text-xs">
                      <p className="font-medium">
                        Connected account: {googleConnection.providerAccountId}
                      </p>
                      <p className="text-muted-foreground">
                        Scopes: {googleConnection.scopes.join(", ")}
                      </p>
                    </div>
                  ) : null}
                  {connectionError ? (
                    <p className="text-destructive text-xs">{connectionError}</p>
                  ) : null}
                  {connectionNotice ? (
                    <p className="text-muted-foreground text-xs">{connectionNotice}</p>
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
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                            <p className="text-muted-foreground text-xs">Feedback coverage</p>
                            <p className="text-lg font-semibold">{metrics.feedbackCount}</p>
                          </div>
                          <div className="bg-muted/40 border-border rounded-lg border px-3 py-2">
                            <p className="text-muted-foreground text-xs">Positive feedback rate</p>
                            <p className="text-lg font-semibold">{metrics.positiveFeedbackRate}%</p>
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
                        disabled={isRulesLoading}
                      />
                      <Button
                        variant="outline"
                        onClick={() => void addWatchRule()}
                        disabled={isRulesLoading}
                      >
                        Add
                      </Button>
                    </div>
                    {rulesError ? <p className="text-destructive text-xs">{rulesError}</p> : null}
                    {isRulesLoading ? (
                      <p className="text-muted-foreground text-xs">Updating watch rules…</p>
                    ) : null}
                    {watchRules.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {watchRules.map((rule) => (
                          <Button
                            key={rule}
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={isRulesLoading}
                            onClick={() => void removeWatchRule(rule)}
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

                <Card>
                  <CardHeader>
                    <CardTitle>Trust report snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        disabled={isTrustReportLoading}
                        onClick={() => void refreshTrustReport()}
                      >
                        Refresh trust report
                      </Button>
                      {trustReport ? (
                        <Badge variant="secondary">
                          generated {new Date(trustReport.generatedAt).toLocaleTimeString()}
                        </Badge>
                      ) : null}
                      {trustReport ? (
                        <Badge
                          variant={trustReport.posture.status === "ok" ? "secondary" : "outline"}
                        >
                          posture: {trustReport.posture.status}
                        </Badge>
                      ) : null}
                    </div>
                    {isTrustReportLoading ? (
                      <p className="text-muted-foreground text-xs">Loading trust report…</p>
                    ) : null}
                    {trustReportError ? (
                      <p className="text-destructive text-xs">{trustReportError}</p>
                    ) : null}
                    {trustReport ? (
                      <div className="bg-muted/40 border-border space-y-2 rounded-lg border px-3 py-2 text-xs">
                        <p>watch rules: {trustReport.watchRuleCount}</p>
                        <p>
                          retention: {trustReport.retention.days} day(s) (
                          {trustReport.retention.source})
                        </p>
                        <p>
                          google vault:{" "}
                          {trustReport.googleConnection.connected ? "connected" : "disconnected"}
                        </p>
                        <p>
                          authz mode: {trustReport.security.authzEnforced ? "enforced" : "relaxed"}
                        </p>
                        <p>
                          secret posture: auth ({trustReport.security.authSecretSource}) / token (
                          {trustReport.security.tokenEncryptionKeySource})
                        </p>
                        <p>
                          previous token key available:{" "}
                          {trustReport.security.hasPreviousTokenKey ? "yes" : "no"}
                        </p>
                        <p>
                          rate-limit mode/provider: {trustReport.security.rateLimitMode}/
                          {trustReport.security.rateLimitProvider} (
                          {trustReport.security.unkeyRateLimitConfigured
                            ? "configured"
                            : "fallback"}
                          )
                        </p>
                        <p>
                          unkey limiter active:{" "}
                          {trustReport.security.unkeyRateLimitActive ? "yes" : "no"}
                        </p>
                        <p>recent audit events: {trustReport.audit.recentCount}</p>
                        <p>latest audit action: {trustReport.audit.latestAction ?? "none"}</p>
                        {trustReport.posture.warnings.length > 0 ? (
                          <div className="space-y-1">
                            <p className="font-medium">warnings</p>
                            <ul className="list-disc space-y-1 pl-4">
                              {trustReport.posture.warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Workflow retention</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                      Configure how long workflow run/event payloads are retained for auditability.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={retentionDays}
                        onChange={(event) =>
                          setRetentionDays(
                            Number.isNaN(Number(event.currentTarget.value))
                              ? 1
                              : Number(event.currentTarget.value),
                          )
                        }
                        disabled={isRetentionLoading}
                      />
                      <Button
                        variant="outline"
                        onClick={() => void saveWorkflowRetention()}
                        disabled={isRetentionLoading}
                      >
                        Save days
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">source: {retentionSource}</Badge>
                      <Button
                        variant="outline"
                        onClick={() => void pruneWorkflowHistoryNow()}
                        disabled={isRetentionLoading}
                      >
                        Prune now
                      </Button>
                    </div>
                    {retentionError ? (
                      <p className="text-destructive text-xs">{retentionError}</p>
                    ) : null}
                    {pruneResult ? (
                      <p className="text-muted-foreground text-xs">
                        Pruned {pruneResult.prunedRuns} run(s) and {pruneResult.prunedAuditLogs}{" "}
                        audit event(s) older than {pruneResult.cutoff}.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent audit log</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-xs">
                      Showing {auditLogs.length} of {auditLogsTotalCount} events.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        disabled={isAuditLogsLoading}
                        onClick={() => void refreshAuditLogs()}
                      >
                        Refresh audit log
                      </Button>
                      {auditLogs.length < auditLogsTotalCount ? (
                        <Button
                          variant="outline"
                          disabled={isAuditLogsLoading}
                          onClick={() =>
                            void refreshAuditLogs({
                              offset: auditLogs.length,
                              append: true,
                            })
                          }
                        >
                          Load older
                        </Button>
                      ) : null}
                    </div>
                    {isAuditLogsLoading ? (
                      <p className="text-muted-foreground text-xs">Loading audit log…</p>
                    ) : null}
                    {auditLogsError ? (
                      <p className="text-destructive text-xs">{auditLogsError}</p>
                    ) : null}
                    {auditLogs.length > 0 ? (
                      <div className="space-y-2">
                        {auditLogs.map((entry) => (
                          <div
                            key={entry.id}
                            className="bg-muted/40 border-border rounded-lg border px-3 py-2 text-xs"
                          >
                            <p className="font-medium">{entry.action}</p>
                            <p className="text-muted-foreground">
                              {entry.targetType}:{entry.targetId}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">No audit events captured yet.</p>
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
