"use client";

import type { GitHubCheckSummary } from "@sachikit/github";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { cn } from "@sachikit/ui/lib/utils";

function summaryLabel(
  total: number,
  passing: number,
  failing: number,
  pending: number
): string {
  if (total === 0) return "No checks";
  const parts: string[] = [];
  if (passing > 0) parts.push(`${String(passing)} passing`);
  if (failing > 0) parts.push(`${String(failing)} failing`);
  if (pending > 0) parts.push(`${String(pending)} pending`);
  return parts.join(", ");
}

export function CheckStatusDot({
  hasError = false,
  isLoading = false,
  summary,
}: {
  hasError?: boolean;
  isLoading?: boolean;
  summary: GitHubCheckSummary | null | undefined;
}) {
  if (isLoading) {
    return <Skeleton className="size-2 rounded-full" />;
  }

  if (hasError) {
    return (
      <span
        className="inline-block size-2 shrink-0 rounded-full bg-destructive"
        title="Failed to load check status"
      />
    );
  }

  if (!summary || summary.total === 0) return null;

  const color =
    summary.conclusion === "success"
      ? "bg-sachi-success"
      : summary.conclusion === "failure"
        ? "bg-destructive"
        : summary.conclusion === "pending"
          ? "bg-sachi-warning"
          : "bg-sachi-fg-faint";

  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", color)}
      title={summaryLabel(
        summary.total,
        summary.passing,
        summary.failing,
        summary.pending
      )}
    />
  );
}
