"use client";

import type { WorkItemWithAction } from "@nyte/domain/actions";
import * as React from "react";

import { NeedsYouList } from "~/components/needs-you-list";
import { WorkflowComposer } from "~/components/workflow-composer";
import { authClient } from "~/lib/auth-client";
import { syncNeedsYou } from "~/lib/needs-you/sync-client";

const DEFAULT_COMMAND =
  "Gmail draft an email to our largest customer about the renewal timeline and next steps";

type WorkspaceClientProps = {
  initialConnected: boolean;
};

export function NyteWorkspaceClient({
  initialConnected,
}: WorkspaceClientProps) {
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
  const autoSyncedRef = React.useRef(false);

  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const connected = isSessionPending ? initialConnected : Boolean(session);

  const visibleItems = React.useMemo(
    () => items.filter((item) => handled[item.id] === undefined),
    [handled, items],
  );

  const runSync = React.useCallback(async () => {
    setSyncError(null);
    setNotice(null);
    setIsSyncing(true);

    try {
      const payload = await syncNeedsYou(cursorRef.current);
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
    if (!connected || autoSyncedRef.current) {
      return;
    }

    autoSyncedRef.current = true;
    void runSync();
  }, [connected, runSync]);

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
    autoSyncedRef.current = false;
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

      setNotice(
        status === "approved"
          ? "Action queued locally (placeholder execution)."
          : "Action dismissed locally.",
      );
    },
    [],
  );

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_10%_12%,#6aa5ff_0%,transparent_30%),radial-gradient(circle_at_88%_16%,#f18bd1_0%,transparent_36%),radial-gradient(circle_at_86%_86%,#ff8359_0%,transparent_38%),radial-gradient(circle_at_16%_82%,#45c8ff_0%,transparent_36%),linear-gradient(125deg,#4f46e5_0%,#0ea5e9_40%,#f97316_100%)] px-4 py-10 md:py-14">
      <div className="mx-auto max-w-[700px]">
        <WorkflowComposer
          command={command}
          connected={connected}
          isSyncing={isSyncing}
          isSessionPending={isSessionPending}
          onCommandChange={setCommand}
          onSubmit={() => void runSync()}
          onConnect={() => void connectGoogle()}
          onDisconnect={() => void disconnectGoogle()}
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

        <NeedsYouList
          items={visibleItems}
          onApprove={(item) => markAction(item, "approved")}
          onDismiss={(item) => markAction(item, "dismissed")}
        />
      </div>
    </main>
  );
}
