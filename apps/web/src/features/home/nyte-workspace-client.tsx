"use client";

import { NyteWorkspaceView } from "./nyte-workspace-view";
import { useNyteWorkspace } from "./use-nyte-workspace";

type WorkspaceClientProps = {
  initialConnected: boolean;
};

export function NyteWorkspaceClient({ initialConnected }: WorkspaceClientProps) {
  const {
    connected,
    isSessionPending,
    isSyncing,
    isMutating,
    syncError,
    notice,
    lastSyncedAt,
    visibleItems,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  } = useNyteWorkspace({ initialConnected });

  return (
    <NyteWorkspaceView
      connected={connected}
      isSessionPending={isSessionPending}
      isSyncing={isSyncing || isMutating}
      syncError={syncError}
      notice={notice}
      lastSyncedAt={lastSyncedAt}
      visibleItems={visibleItems}
      onSubmit={(command) => void runSync(command)}
      onConnect={() => void connectGoogle()}
      onDisconnect={() => void disconnectGoogle()}
      onApprove={(item, payloadOverride) => void markAction(item, "approved", payloadOverride)}
      onDismiss={(item) => void markAction(item, "dismissed")}
    />
  );
}
