"use client";

import { ActionList } from "~/components/action-list";
import { Composer } from "~/components/composer";
import { NEEDS_YOU_MESSAGES } from "~/lib/needs-you/messages";
import { useWorkspace } from "~/hooks/use-workspace";

export function Workspace() {
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

  return (
    <main className="relative min-h-dvh bg-[#050505] px-4 py-8 md:px-8 md:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[720px]">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-[0.3em] text-[#333] uppercase">
            Nyte
          </span>
          {lastSyncedAt ? (
            <div className="flex items-center gap-3 font-mono text-[10px] text-[#333]">
              {activeWatchKeywords.length > 0 ? (
                <span className="text-[#a3e635]/60">
                  ⌖ {activeWatchKeywords.join(", ")}
                </span>
              ) : null}
              <span>
                synced {new Date(lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ) : null}
        </div>

        <Composer
          connected={connected}
          isSyncing={isSyncing || isMutating}
          isSessionPending={isSessionPending}
          onSubmit={(cmd) => void runSync(cmd)}
          onConnect={() => void connectGoogle()}
          onDisconnect={() => void disconnectGoogle()}
        />

        {error ? (
          <div className="mt-3 border border-red-900/50 bg-red-950/30 px-4 py-2.5 font-mono text-xs text-red-400">
            ↳ {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-3 border border-[#a3e635]/20 bg-[#a3e635]/5 px-4 py-2.5 font-mono text-xs text-[#a3e635]">
            ✓ {notice}
          </div>
        ) : null}

        {!connected ? (
          <div className="mt-6 border border-[#1a1a1a] px-4 py-8 text-center font-mono text-xs text-[#333]">
            {NEEDS_YOU_MESSAGES.queueAuthRequired}
          </div>
        ) : null}

        {connected && items.length === 0 && !isSyncing ? (
          <div className="mt-6 border border-[#1a1a1a] px-4 py-8 text-center font-mono text-xs text-[#333]">
            {NEEDS_YOU_MESSAGES.noActionCards}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="mt-4 border border-[#1a1a1a]">
            <div className="flex items-center justify-between border-b border-[#141414] px-4 py-2">
              <span className="font-mono text-[10px] tracking-wider text-[#333] uppercase">
                Queue
              </span>
              <span className="font-mono text-[10px] text-[#252525]">
                {items.length} pending
              </span>
            </div>
            <ActionList
              items={items}
              onApprove={(item, override) => void markAction(item, "approved", override)}
              onDismiss={(item) => void markAction(item, "dismissed")}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
