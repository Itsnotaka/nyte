"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";

import { NeedsYouList } from "~/components/needs-you-list";
import { WorkflowComposer } from "~/components/workflow-composer";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";

type NyteWorkspaceViewProps = {
  connected: boolean;
  isSessionPending: boolean;
  isSyncing: boolean;
  syncError: string | null;
  notice: string | null;
  lastSyncedAt: string | null;
  activeWatchKeywords: string[];
  visibleItems: WorkItemWithAction[];
  onSubmit: (command: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onApprove: (
    item: WorkItemWithAction,
    payloadOverride?: WorkItemWithAction["proposedAction"]
  ) => void;
  onDismiss: (item: WorkItemWithAction) => void;
};

export function NyteWorkspaceView({
  connected,
  isSessionPending,
  isSyncing,
  syncError,
  notice,
  lastSyncedAt,
  activeWatchKeywords,
  visibleItems,
  onSubmit,
  onConnect,
  onDisconnect,
  onApprove,
  onDismiss,
}: NyteWorkspaceViewProps) {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_10%_12%,#6aa5ff_0%,transparent_30%),radial-gradient(circle_at_88%_16%,#f18bd1_0%,transparent_36%),radial-gradient(circle_at_86%_86%,#ff8359_0%,transparent_38%),radial-gradient(circle_at_16%_82%,#45c8ff_0%,transparent_36%),linear-gradient(125deg,#4f46e5_0%,#0ea5e9_40%,#f97316_100%)] px-4 py-10 md:py-14">
      <div className="mx-auto max-w-[700px]">
        <WorkflowComposer
          connected={connected}
          isSyncing={isSyncing}
          isSessionPending={isSessionPending}
          onSubmit={onSubmit}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
        />

        {syncError ? (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {syncError}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        ) : null}

        {lastSyncedAt ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/90">
            <p>Last synced {new Date(lastSyncedAt).toLocaleTimeString()}</p>
            {activeWatchKeywords.length > 0 ? (
              <p>Watch: {activeWatchKeywords.join(", ")}</p>
            ) : null}
          </div>
        ) : null}

        {!connected ? (
          <div className="mt-6 rounded-xl border border-white/40 bg-white/85 px-4 py-3 text-sm text-zinc-700">
            {NEEDS_YOU_MESSAGES.queueAuthRequired}
          </div>
        ) : null}

        {connected && visibleItems.length === 0 && !isSyncing ? (
          <div className="mt-6 rounded-xl border border-white/40 bg-white/85 px-4 py-3 text-sm text-zinc-700">
            {NEEDS_YOU_MESSAGES.noActionCards}
          </div>
        ) : null}

        <NeedsYouList
          items={visibleItems}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      </div>
    </main>
  );
}
