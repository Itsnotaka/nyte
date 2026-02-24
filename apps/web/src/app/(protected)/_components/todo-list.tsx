"use client";

import { useQuery } from "convex/react";

import { api } from "~/lib/convex";

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

export function TodoList() {
  const data = useQuery(api.commandCenter.todoList, { limit: 20 });
  if (!data) {
    return (
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-4 text-sm text-[var(--color-text-secondary)]">
        Loading todo list...
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Active command runs
        </p>
        {data.runs.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            No command runs yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.runs.map((run: (typeof data.runs)[number]) => (
              <li
                key={run.runId}
                className="rounded-lg border border-[var(--color-border-subtle)] px-2 py-1.5"
              >
                <p className="text-sm text-[var(--color-text-primary)]">
                  {run.inputText}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {run.status} • risk {run.riskLevel}
                  {run.followUpQuestion ? ` • ${run.followUpQuestion}` : ""}
                  {run.lastError ? ` • error: ${run.lastError}` : ""}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                  {formatTime(run.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-main-bg)] p-3">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Registered flows
        </p>
        {data.flows.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            No flows configured.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.flows.map((flow: (typeof data.flows)[number]) => (
              <li
                key={flow.flowId}
                className="text-sm text-[var(--color-text-primary)]"
              >
                {flow.name} • {flow.triggerType} •{" "}
                {flow.isActive ? "active" : "paused"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
