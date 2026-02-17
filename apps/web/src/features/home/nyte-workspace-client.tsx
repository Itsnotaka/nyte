"use client";

import { NyteWorkspaceView } from "./nyte-workspace-view";
import { useNyteWorkspace } from "./use-nyte-workspace";

export function NyteWorkspaceClient() {
  const {
    connected,
    isSessionPending,
    isSyncing,
    isMutating,
    syncError,
    notice,
    lastSyncedAt,
    activeWatchKeywords,
    visibleItems,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  } = useNyteWorkspace();

  return (
    <NyteWorkspaceView
      connected={connected}
      isSessionPending={isSessionPending}
      isSyncing={isSyncing || isMutating}
      syncError={syncError}
      notice={notice}
      lastSyncedAt={lastSyncedAt}
      activeWatchKeywords={activeWatchKeywords}
      visibleItems={visibleItems}
      onSubmit={(command) => void runSync(command)}
      onConnect={() => void connectGoogle()}
      onDisconnect={() => void disconnectGoogle()}
      onApprove={(item, payloadOverride) =>
        void markAction(item, "approved", payloadOverride)
      }
      onDismiss={(item) => void markAction(item, "dismissed")}
    />
  );
}
