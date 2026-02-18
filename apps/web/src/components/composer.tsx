"use client";

import { useForm } from "@tanstack/react-form";
import { RefreshCwIcon } from "lucide-react";

type ComposerProps = {
  connected: boolean;
  isSyncing: boolean;
  isSessionPending: boolean;
  onSubmit: (command: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function Composer({
  connected,
  isSyncing,
  isSessionPending,
  onSubmit,
  onConnect,
  onDisconnect,
}: ComposerProps) {
  const form = useForm({
    defaultValues: { command: "" },
    onSubmit: async ({ value }) => {
      if (!connected) return;
      onSubmit(value.command);
    },
  });

  return (
    <div className="border border-[#1a1a1a] bg-[#0d0d0d]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="flex items-center"
      >
        <span className="select-none pl-4 font-mono text-[11px] text-[#333]">›</span>
        <form.Field
          name="command"
          children={(field) => (
            <input
              id={field.name}
              name={field.name}
              aria-label="Watch keywords for sync"
              placeholder="Filter by keywords…"
              className="w-full min-h-[40px] bg-transparent px-3 font-mono text-sm text-[#a3a3a3] placeholder:text-[#2a2a2a] outline-none"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        />
      </form>

      <div className="flex items-center justify-between border-t border-[#141414] px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] tracking-wider text-[#222] uppercase">
            Nyte
          </span>
          <span className="mx-2 h-3 w-px bg-[#1a1a1a]" />
          <span className="size-1.5 rounded-full bg-[#a3e635] shadow-[0_0_4px_rgba(163,230,53,0.6)]" />
        </div>

        <div className="flex items-center gap-2">
          {!connected ? (
            <button
              type="button"
              onClick={onConnect}
              disabled={isSessionPending}
              className="h-7 inline-flex items-center px-3 font-mono text-[11px] tracking-wide text-[#a3e635] border border-[#a3e635]/30 transition-colors hover:border-[#a3e635] hover:bg-[#a3e635]/5 disabled:opacity-40"
            >
              Connect Google
            </button>
          ) : (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isSessionPending}
              className="h-7 inline-flex items-center px-3 font-mono text-[11px] tracking-wide text-[#525252] border border-[#1a1a1a] transition-colors hover:border-[#252525] hover:text-[#a3a3a3] disabled:opacity-40"
            >
              Disconnect
            </button>
          )}

          <button
            type="button"
            onClick={() => void form.handleSubmit()}
            disabled={!connected || isSyncing}
            className="h-7 inline-flex items-center gap-1.5 border border-[#1a1a1a] bg-[#111] px-3 font-mono text-[11px] tracking-wide text-[#a3a3a3] transition-colors hover:border-[#252525] hover:text-[#f0f0f0] disabled:opacity-40"
          >
            <RefreshCwIcon className={`size-3 ${isSyncing ? "animate-spin" : ""}`} />
            Sync
            <kbd className="hidden rounded border border-[#222] bg-[#0d0d0d] px-1 text-[9px] text-[#383838] sm:inline">
              ↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
