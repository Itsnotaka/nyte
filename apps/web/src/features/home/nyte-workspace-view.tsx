"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";

import { NeedsYouList } from "~/components/needs-you-list";
import { WorkflowComposer } from "~/components/workflow-composer";

type NyteWorkspaceViewProps = {
  command: string;
  connected: boolean;
  isSessionPending: boolean;
  isSyncing: boolean;
  syncError: string | null;
  notice: string | null;
  lastSyncedAt: string | null;
  visibleItems: WorkItemWithAction[];
  onCommandChange: (value: string) => void;
  onSubmit: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onApprove: (item: WorkItemWithAction) => void;
  onDismiss: (item: WorkItemWithAction) => void;
};

export function NyteWorkspaceView({
  command,
  connected,
  isSessionPending,
  isSyncing,
  syncError,
  notice,
  lastSyncedAt,
  visibleItems,
  onCommandChange,
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
          command={command}
          connected={connected}
          isSyncing={isSyncing}
          isSessionPending={isSessionPending}
          onCommandChange={onCommandChange}
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
          <p className="mt-2 text-xs text-white/90">
            Last synced {new Date(lastSyncedAt).toLocaleTimeString()}
          </p>
        ) : null}

        {!connected ? (
          <div className="mt-6 rounded-xl border border-white/40 bg-white/85 px-4 py-3 text-sm text-zinc-700">
            Connect Google to load real Gmail and Calendar cards.
          </div>
        ) : null}

        {connected && visibleItems.length === 0 && !isSyncing ? (
          <div className="mt-6 rounded-xl border border-white/40 bg-white/85 px-4 py-3 text-sm text-zinc-700">
            No action cards right now.
          </div>
        ) : null}

        <NeedsYouList items={visibleItems} onApprove={onApprove} onDismiss={onDismiss} />
      </div>
    </main>
  );
}
