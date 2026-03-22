"use client";

import {
  IconBlockSortAscending,
  IconBlockSortDescending,
  IconSortArrowUpDown,
} from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import type { GitHubCheckSummary } from "@sachikit/github";
import type { GitHubRepository } from "@sachikit/github";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@sachikit/ui/components/empty";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { Table } from "@sachikit/ui/components/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { compareAsc, compareDesc, parseISO } from "date-fns";
import Link from "next/link";
import * as React from "react";

import { CheckStatusDot } from "~/app/(protected)/_components/check-status-dot";
import { ReviewStatusIcon } from "~/app/(protected)/_components/review-status-icon";
import type { InboxPullRequest, ReviewDecision } from "~/lib/github/server";
import { formatRelativeTime } from "~/lib/time";
import { page } from "~/lib/trpc/pr-batch";
import { useTRPC } from "~/lib/trpc/react";

type SortField = "title" | "changes" | "updated";
type SortDirection = "asc" | "desc";
type CheckSummaryMap = Record<string, GitHubCheckSummary | null>;

function checkSummaryKey(owner: string, repo: string, ref: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}@${ref}`;
}

function sortItems(
  items: InboxPullRequest[],
  field: SortField,
  direction: SortDirection,
): InboxPullRequest[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (field === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (field === "changes") {
      cmp = (a.additions ?? 0) + (a.deletions ?? 0) - ((b.additions ?? 0) + (b.deletions ?? 0));
    } else {
      cmp =
        direction === "asc"
          ? compareAsc(parseISO(a.updated_at), parseISO(b.updated_at))
          : compareDesc(parseISO(a.updated_at), parseISO(b.updated_at));
    }
    return field === "updated" || direction === "asc" ? cmp : -cmp;
  });
}

function SortIcon({
  field,
  active,
  direction,
}: {
  field: string;
  active: boolean;
  direction: SortDirection;
}) {
  const cls = `size-3 ${active ? "text-sachi-fg-secondary" : "text-sachi-fg-faint"}`;
  if (active && direction === "asc")
    return <IconBlockSortAscending className={cls} aria-label={`Sort by ${field} ascending`} />;
  if (active && direction === "desc")
    return <IconBlockSortDescending className={cls} aria-label={`Sort by ${field} descending`} />;
  return <IconSortArrowUpDown className={cls} aria-label={`Sort by ${field}`} />;
}

export function PullRequestListSkeleton() {
  return (
    <ScrollArea className="h-full bg-sachi-base">
      <div className="mx-auto w-full max-w-[960px] px-4 pt-4">
        <Table layout="fixed">
          <Table.Header>
            <Table.Row>
              <Table.Head className="w-full">Title</Table.Head>
              <Table.Head className="w-24">Status</Table.Head>
              <Table.Head className="w-28 text-right">Changes</Table.Head>
              <Table.Head className="w-24 text-right">Updated</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {Array.from({ length: 8 }).map((_, i) => (
              <Table.Row key={i}>
                <Table.Cell className="w-full min-w-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className="w-24">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-3 rounded-full" />
                    <Skeleton className="size-3 rounded-full" />
                  </div>
                </Table.Cell>
                <Table.Cell className="w-28 text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </Table.Cell>
                <Table.Cell className="w-24 text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </ScrollArea>
  );
}

function SortableHead({
  field,
  label,
  activeField,
  direction,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  return (
    <Table.Head className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex items-center gap-1 transition-colors hover:text-sachi-fg"
      >
        {label}
        <SortIcon field={field} active={activeField === field} direction={direction} />
      </button>
    </Table.Head>
  );
}

function PullRequestRow({
  checksError,
  checksLoading,
  checkSummaries,
  pr,
  owner,
  repo,
}: {
  checksError: boolean;
  checksLoading: boolean;
  checkSummaries: CheckSummaryMap;
  pr: InboxPullRequest & { reviewDecision: ReviewDecision };
  owner: string;
  repo: string;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const checkSummary = checkSummaries[checkSummaryKey(owner, repo, pr.head.sha)];

  function warm() {
    const q = page(
      {
        owner,
        repo,
        pullNumber: pr.number,
      },
      { staleTime: 60_000 },
    );
    void qc.prefetchQuery(trpc.github.getPullRequestPage.queryOptions(q.input, q.opts));
  }

  return (
    <Table.Row>
      <Table.Cell className="w-full min-w-0">
        <Link
          href={`/repo/${owner}/${repo}/pull/${String(pr.number)}`}
          onFocus={warm}
          onMouseEnter={warm}
          prefetch={true}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar size="sm">
            <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
            <AvatarFallback>{pr.user.login.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-sachi-fg">{pr.title}</span>
            <span className="truncate text-xs text-sachi-fg-muted">
              {pr.user.login} &middot; #{pr.number}
            </span>
          </div>
        </Link>
      </Table.Cell>

      <Table.Cell className="w-24">
        <div className="flex items-center gap-2">
          <CheckStatusDot hasError={checksError} isLoading={checksLoading} summary={checkSummary} />
          <ReviewStatusIcon reviewDecision={pr.reviewDecision} />
        </div>
      </Table.Cell>

      <Table.Cell className="w-28 text-right">
        {pr.additions != null && pr.deletions != null ? (
          <span className="text-xs whitespace-nowrap tabular-nums">
            <span className="text-sachi-success">+{pr.additions}</span>
            <span className="text-sachi-fg-faint"> / </span>
            <span className="text-destructive">-{pr.deletions}</span>
          </span>
        ) : (
          <span className="text-xs text-sachi-fg-faint">&mdash;</span>
        )}
      </Table.Cell>

      <Table.Cell className="w-24 text-right text-xs whitespace-nowrap text-sachi-fg-faint">
        {formatRelativeTime(pr.updated_at, { addSuffix: false })}
      </Table.Cell>
    </Table.Row>
  );
}

type PullRequestListViewProps = {
  repository: GitHubRepository;
  pullRequests: (InboxPullRequest & { reviewDecision: ReviewDecision })[];
};

export function PullRequestListView({ repository, pullRequests }: PullRequestListViewProps) {
  const trpc = useTRPC();
  const [sortField, setSortField] = React.useState<SortField>("updated");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedPulls = React.useMemo(
    () => sortItems(pullRequests, sortField, sortDirection),
    [pullRequests, sortField, sortDirection],
  );

  const owner = repository.owner.login;
  const repo = repository.name;
  const checkSummaryInputs = React.useMemo(
    () =>
      pullRequests.map((pr) => ({
        owner,
        repo,
        ref: pr.head.sha,
      })),
    [owner, pullRequests, repo],
  );
  const checkSummariesQuery = useQuery(
    trpc.github.getCheckSummaries.queryOptions(checkSummaryInputs, {
      enabled: checkSummaryInputs.length > 0,
      staleTime: 60_000,
    }),
  );
  const checkSummaries = checkSummariesQuery.data ?? {};

  return (
    <ScrollArea className="h-full bg-sachi-base">
      {pullRequests.length === 0 ? (
        <Empty className="h-full flex-1">
          <EmptyHeader>
            <EmptyTitle>No open pull requests</EmptyTitle>
            <EmptyDescription>There are no open pull requests in this repository.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="mx-auto w-full max-w-[960px] px-4 pt-4">
          <Table layout="fixed">
            <Table.Header>
              <Table.Row>
                <SortableHead
                  field="title"
                  label="Title"
                  activeField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="w-full"
                />
                <Table.Head className="w-24">Status</Table.Head>
                <SortableHead
                  field="changes"
                  label="Changes"
                  activeField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="w-28 text-right"
                />
                <SortableHead
                  field="updated"
                  label="Updated"
                  activeField={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="w-24 text-right"
                />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sortedPulls.map((pr) => (
                <PullRequestRow
                  key={pr.id}
                  checksError={checkSummariesQuery.isError}
                  checksLoading={checkSummariesQuery.isLoading}
                  checkSummaries={checkSummaries}
                  pr={pr}
                  owner={owner}
                  repo={repo}
                />
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </ScrollArea>
  );
}
