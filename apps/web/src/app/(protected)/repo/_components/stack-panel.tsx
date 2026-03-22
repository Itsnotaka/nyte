import { Badge } from "@sachikit/ui/components/badge";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { cn } from "@sachikit/ui/lib/utils";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

import { useTRPC } from "~/lib/trpc/react";

import type { PullRequestQueryInput } from "./types";

export function SidebarListFallback() {
  return (
    <div className="space-y-2 py-1">
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-8 w-5/6 rounded-md" />
    </div>
  );
}

export function PullRequestStackPanel({ queryInput }: { queryInput: PullRequestQueryInput }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const stackQuery = useSuspenseQuery(
    trpc.github.getPullRequestStack.queryOptions(queryInput, {
      staleTime: 60_000,
    }),
  );
  const stack = stackQuery.data;

  function warm(entryNumber: number) {
    void qc.prefetchQuery(
      trpc.github.getPullRequestPage.queryOptions(
        {
          owner: queryInput.owner,
          repo: queryInput.repo,
          pullNumber: entryNumber,
        },
        {
          staleTime: 60_000,
        },
      ),
    );
  }

  if (stack.length === 0) {
    return (
      <p className="py-2 text-xs text-sachi-fg-muted">This pull request is not part of a stack.</p>
    );
  }

  return (
    <div className="space-y-1.5 py-1">
      {stack.map((entry) => (
        <Link
          key={entry.number}
          href={`/repo/${queryInput.owner}/${queryInput.repo}/pull/${String(entry.number)}`}
          prefetch={false}
          onMouseEnter={() => warm(entry.number)}
          onFocus={() => warm(entry.number)}
          className={cn(
            "flex items-start justify-between gap-2 rounded-md px-2 py-2 transition-colors hover:bg-sachi-fill",
            entry.isCurrent ? "bg-sachi-fill" : undefined,
          )}
        >
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-xs font-medium text-sachi-fg">
              #{String(entry.number)} {entry.title}
            </p>
            <p className="truncate text-[11px] text-sachi-fg-muted">
              {entry.baseRef} {"->"} {entry.headRef}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0">
            {entry.state}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
