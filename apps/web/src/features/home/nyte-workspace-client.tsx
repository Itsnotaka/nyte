"use client";

import { NyteWorkspaceView } from "./nyte-workspace-view";
import { useNyteWorkspace } from "./use-nyte-workspace";

type WorkspaceClientProps = {
  initialConnected: boolean;
};

export function NyteWorkspaceClient({ initialConnected }: WorkspaceClientProps) {
  const {
    command,
    connected,
    isSessionPending,
    isSyncing,
    syncError,
    notice,
    lastSyncedAt,
    visibleItems,
    setCommand,
    runSync,
    connectGoogle,
    disconnectGoogle,
    markAction,
  } = useNyteWorkspace({ initialConnected });

  return (
    <NyteWorkspaceView
      command={command}
      connected={connected}
      isSessionPending={isSessionPending}
      isSyncing={isSyncing}
      syncError={syncError}
      notice={notice}
      lastSyncedAt={lastSyncedAt}
      visibleItems={visibleItems}
      onCommandChange={setCommand}
      onSubmit={() => void runSync()}
      onConnect={() => void connectGoogle()}
      onDisconnect={() => void disconnectGoogle()}
      onApprove={(item) => markAction(item, "approved")}
      onDismiss={(item) => markAction(item, "dismissed")}
    />
  );
}
