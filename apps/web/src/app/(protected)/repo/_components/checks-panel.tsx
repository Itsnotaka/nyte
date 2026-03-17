"use client";

import type { GitHubCheckRun } from "@sachikit/github";
import { Badge } from "@sachikit/ui/components/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
import { cn } from "@sachikit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { useTRPC } from "~/lib/trpc/client";

type ChecksPanelProps = {
  owner: string;
  repo: string;
  headSha: string;
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return "<1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${String(minutes)}m ${String(remaining)}s` : `${String(minutes)}m`;
}

function StatusIcon({ run }: { run: GitHubCheckRun }) {
  if (run.status !== "completed") {
    return (
      <span className="flex size-4 items-center justify-center">
        <span className="size-2 animate-pulse rounded-full bg-amber-400" />
      </span>
    );
  }

  if (run.conclusion === "success") {
    return (
      <svg className="size-4 text-green-600" viewBox="0 0 16 16" fill="none">
        <path
          d="M4 8.5L6.5 11L12 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (
    run.conclusion === "failure" ||
    run.conclusion === "timed_out" ||
    run.conclusion === "action_required"
  ) {
    return (
      <svg className="size-4 text-red-500" viewBox="0 0 16 16" fill="none">
        <path
          d="M5 5L11 11M11 5L5 11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (run.conclusion === "skipped" || run.conclusion === "neutral") {
    return (
      <span className="flex size-4 items-center justify-center">
        <span className="size-2 rounded-full bg-sachi-fg-faint" />
      </span>
    );
  }

  return (
    <span className="flex size-4 items-center justify-center">
      <span className="size-2 rounded-full bg-sachi-fg-faint" />
    </span>
  );
}

function summaryLabel(
  total: number,
  passing: number,
  failing: number,
  pending: number,
): string {
  if (total === 0) return "No checks";
  const parts: string[] = [];
  if (passing > 0) parts.push(`${String(passing)} passing`);
  if (failing > 0) parts.push(`${String(failing)} failing`);
  if (pending > 0) parts.push(`${String(pending)} pending`);
  return parts.join(", ");
}

function summaryVariant(conclusion: string): "outline" | "destructive" | "default" {
  if (conclusion === "failure") return "destructive";
  return "outline";
}

export function ChecksPanel({ owner, repo, headSha }: ChecksPanelProps) {
  const trpc = useTRPC();
  const [open, setOpen] = React.useState(false);

  const checksQuery = useQuery(
    trpc.github.getCheckRuns.queryOptions(
      { owner, repo, ref: headSha },
      { staleTime: 60_000 },
    ),
  );

  const summaryQuery = useQuery(
    trpc.github.getCheckSummary.queryOptions(
      { owner, repo, ref: headSha },
      { staleTime: 60_000 },
    ),
  );

  const summary = summaryQuery.data;
  const checks = checksQuery.data ?? [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-sachi-fill">
        <span className="font-medium text-sachi-fg">Checks</span>
        {summary ? (
          <Badge variant={summaryVariant(summary.conclusion)}>
            {summaryLabel(summary.total, summary.passing, summary.failing, summary.pending)}
          </Badge>
        ) : (
          <span className="text-xs text-sachi-fg-faint">Loading...</span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        {checks.length === 0 ? (
          <p className="px-3 py-2 text-xs text-sachi-fg-muted">
            {checksQuery.isLoading ? "Loading checks..." : "No status checks."}
          </p>
        ) : (
          <div className="space-y-0.5 px-1 pb-2">
            {checks.map((run) => (
              <a
                key={run.id}
                href={run.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sachi-fill",
                )}
              >
                <StatusIcon run={run} />
                <span className="min-w-0 flex-1 truncate text-sachi-fg-secondary">
                  {run.name}
                </span>
                {run.app ? (
                  <span className="shrink-0 text-[10px] text-sachi-fg-faint">
                    {run.app.name}
                  </span>
                ) : null}
                {run.started_at && run.completed_at ? (
                  <span className="shrink-0 text-[10px] text-sachi-fg-faint">
                    {formatDuration(run.started_at, run.completed_at)}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// CheckStatusDot is in ~/app/(protected)/_components/check-status-dot.tsx
