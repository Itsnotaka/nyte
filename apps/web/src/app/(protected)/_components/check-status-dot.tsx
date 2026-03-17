"use client";

import { Skeleton } from "@sachikit/ui/components/skeleton";
import { cn } from "@sachikit/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/lib/trpc/client";

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
  owner,
  repo,
  headSha,
}: {
  owner: string;
  repo: string;
  headSha: string;
}) {
  const trpc = useTRPC();
  const summaryQuery = useQuery(
    trpc.github.getCheckSummary.queryOptions(
      { owner, repo, ref: headSha },
      { staleTime: 60_000 }
    )
  );

  if (summaryQuery.isLoading) {
    return <Skeleton className="size-2 rounded-full" />;
  }

  if (summaryQuery.isError) {
    return (
      <span
        className="inline-block size-2 shrink-0 rounded-full bg-red-300"
        title="Failed to load check status"
      />
    );
  }

  const summary = summaryQuery.data;
  if (!summary || summary.total === 0) return null;

  const color =
    summary.conclusion === "success"
      ? "bg-green-500"
      : summary.conclusion === "failure"
        ? "bg-red-500"
        : summary.conclusion === "pending"
          ? "bg-amber-400"
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
