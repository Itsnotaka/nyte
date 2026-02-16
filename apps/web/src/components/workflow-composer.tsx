"use client";

import { AtSignIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

import { commandPrefix } from "~/lib/needs-you/presenters";

const GHOST_BUTTON_CLASS =
  "group/button focus-visible:ring-neutral-strong relative inline-flex shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-2 h-7 px-1.5";

const PRIMARY_BUTTON_CLASS =
  "group/button focus-visible:ring-neutral-strong relative inline-flex shrink-0 cursor-pointer rounded-lg whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-2 h-7 px-1.5";

type WorkflowComposerProps = {
  command: string;
  connected: boolean;
  isSyncing: boolean;
  isSessionPending: boolean;
  onCommandChange: (value: string) => void;
  onSubmit: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function WorkflowComposer({
  command,
  connected,
  isSyncing,
  isSessionPending,
  onCommandChange,
  onSubmit,
  onConnect,
  onDisconnect,
}: WorkflowComposerProps) {
  const [isEditorFocused, setIsEditorFocused] = React.useState(false);
  const editorRef = React.useRef<HTMLDivElement | null>(null);

  const details = React.useMemo(() => commandPrefix(command), [command]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if ((editor.textContent ?? "") !== command) {
      editor.textContent = command;
    }
  }, [command]);

  const editorEmpty = command.trim().length === 0;

  return (
    <section className="bg-surface-subtle hover:ring-bg-surface-strong ease-out-expo w-full rounded-[14px] bg-card/70 transition-shadow duration-200 hover:ring-2 hover:ring-black/10">
      <div className="rounded-[14px] p-0.5 shadow-lg" tabIndex={-1}>
        <div className="bg-surface flex flex-col rounded-xl bg-background shadow-md">
          <div className="flex w-full items-center">
            <div className="relative flex flex-1 cursor-text transition-colors [--lh:1lh]">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Specify a workflow to handle..."
                className="w-full min-h-[32px] resize-none whitespace-pre-wrap border-0 bg-transparent py-2 pl-3.5 pr-2 text-sm text-transparent caret-black outline-none focus:ring-0"
                onFocus={() => setIsEditorFocused(true)}
                onBlur={() => setIsEditorFocused(false)}
                onInput={(event) => {
                  onCommandChange(event.currentTarget.textContent ?? "");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (connected) {
                      onSubmit();
                    }
                  }
                }}
              />

              {!editorEmpty ? (
                <div
                  className={`pointer-events-none absolute left-3.5 top-2 items-center gap-1 text-sm ${
                    isEditorFocused ? "hidden" : "hidden sm:flex"
                  }`}
                  style={{
                    opacity: 1,
                    transform: "none",
                  }}
                >
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <span className="inline-flex size-4 items-center justify-center rounded-sm border border-border bg-white text-[10px]">
                      {details.app === "Google Calendar" ? "31" : "M"}
                    </span>
                    <span>{details.app}</span>
                  </span>
                  <span className="text-foreground">
                    {details.body || "Specify a workflow to handle..."}
                  </span>
                </div>
              ) : null}

              {editorEmpty ? (
                <div
                  className={`pointer-events-none absolute left-3.5 top-2 text-sm text-muted-foreground ${
                    isEditorFocused ? "hidden" : ""
                  }`}
                  style={{
                    opacity: 1,
                  }}
                >
                  Specify a workflow to handle...
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between overflow-hidden p-2">
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" className={GHOST_BUTTON_CLASS}>
              <span className="absolute inset-2 rounded-lg border border-transparent bg-muted opacity-0 blur-sm transition-transform group-hover/button:inset-0 group-hover/button:opacity-100 group-active/button:shadow-none" />
              <span className="relative z-10 flex items-center gap-1 text-sm text-muted-foreground group-hover/button:text-foreground">
                <AtSignIcon className="size-4" />
                <span className="px-0.5 leading-none">
                  <span className="hidden min-[400px]:inline">Add context</span>
                </span>
                <span className="flex items-center pr-1 sm:pr-2">
                  <span className="-mr-1.5 inline-flex size-4 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-semibold text-white ring-2 ring-background">
                    G
                  </span>
                  <span className="-mr-1.5 inline-flex size-4 items-center justify-center rounded-md bg-zinc-900 text-[10px] font-semibold text-white ring-2 ring-background">
                    S
                  </span>
                  <span className="inline-flex size-4 items-center justify-center rounded-md bg-indigo-500 text-[10px] font-semibold text-white ring-2 ring-background">
                    C
                  </span>
                </span>
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!connected ? (
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                onClick={onConnect}
                disabled={isSessionPending}
              >
                <span className="absolute inset-0 rounded-lg border border-transparent bg-muted opacity-0 transition group-hover/button:opacity-100" />
                <span className="relative z-10 flex items-center gap-1 text-sm text-foreground">
                  Connect
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={GHOST_BUTTON_CLASS}
                onClick={onDisconnect}
                disabled={isSessionPending}
              >
                <span className="absolute inset-0 rounded-lg border border-transparent bg-muted opacity-0 transition group-hover/button:opacity-100" />
                <span className="relative z-10 flex items-center gap-1 text-sm text-foreground">
                  Disconnect
                </span>
              </button>
            )}

            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={onSubmit}
              disabled={!connected || isSyncing}
            >
              <span className="absolute inset-0 rounded-lg border border-border bg-gradient-to-t from-background to-background shadow-xs transition group-hover/button:to-muted disabled:opacity-50" />
              <span className="relative z-10 flex items-center gap-1 text-sm text-foreground">
                <RefreshCwIcon className={`size-4 ${isSyncing ? "animate-spin" : ""}`} />
                <span className="px-0.5 leading-none">Go</span>
                <span className="hidden h-4 items-center rounded border border-border bg-muted px-1 text-[10px] text-muted-foreground shadow-xs sm:inline-flex">
                  ↵
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
