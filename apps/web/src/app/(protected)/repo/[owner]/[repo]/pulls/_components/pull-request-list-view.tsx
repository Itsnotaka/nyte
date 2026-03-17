"use client";

import {
  IconBlockSortAscending,
  IconBlockSortDescending,
  IconSortArrowUpDown,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import type { GitHubRepository } from "@sachikit/github";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sachikit/ui/components/avatar";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@sachikit/ui/components/empty";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Table } from "@sachikit/ui/components/table";
import { compareAsc, compareDesc, parseISO } from "date-fns";
import Link from "next/link";
import * as React from "react";

import { CheckStatusDot } from "~/app/(protected)/_components/check-status-dot";
import { ReviewStatusIcon } from "~/app/(protected)/_components/review-status-icon";
import type { InboxPullRequest, ReviewDecision } from "~/lib/github/server";
import { formatRelativeTime } from "~/lib/time";

type SortField = "title" | "changes" | "updated";
type SortDirection = "asc" | "desc";

function sortItems(
  items: InboxPullRequest[],
  field: SortField,
  direction: SortDirection
): InboxPullRequest[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (field === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (field === "changes") {
      cmp =
        (a.additions ?? 0) +
        (a.deletions ?? 0) -
        ((b.additions ?? 0) + (b.deletions ?? 0));
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
    return (
      <IconBlockSortAscending
        className={cls}
        aria-label={`Sort by ${field} ascending`}
      />
    );
  if (active && direction === "desc")
    return (
      <IconBlockSortDescending
        className={cls}
        aria-label={`Sort by ${field} descending`}
      />
    );
  return (
    <IconSortArrowUpDown className={cls} aria-label={`Sort by ${field}`} />
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
        <SortIcon
          field={field}
          active={activeField === field}
          direction={direction}
        />
      </button>
    </Table.Head>
  );
}

function PullRequestRow({
  pr,
  owner,
  repo,
}: {
  pr: InboxPullRequest & { reviewDecision: ReviewDecision };
  owner: string;
  repo: string;
}) {
  return (
    <Table.Row>
      <Table.Cell className="w-full min-w-0">
        <Link
          href={`/repo/${owner}/${repo}/pull/${String(pr.number)}`}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar size="sm">
            <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
            <AvatarFallback>
              {pr.user.login.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-sachi-fg">
              {pr.title}
            </span>
            <span className="truncate text-xs text-sachi-fg-muted">
              {pr.user.login} &middot; #{pr.number}
            </span>
          </div>
        </Link>
      </Table.Cell>

      <Table.Cell className="w-24">
        <div className="flex items-center gap-2">
          <React.Suspense fallback={null}>
            <CheckStatusDot owner={owner} repo={repo} headSha={pr.head.sha} />
          </React.Suspense>
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

export function PullRequestListView({
  repository,
  pullRequests,
}: PullRequestListViewProps) {
  const [sortField, setSortField] = React.useState<SortField>("updated");
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>("desc");

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
    [pullRequests, sortField, sortDirection]
  );

  const owner = repository.owner.login;
  const repo = repository.name;

  return (
    <ScrollArea className="h-full bg-sachi-base">
      {pullRequests.length === 0 ? (
        <Empty className="h-full flex-1">
          <EmptyHeader>
            <EmptyTitle>No open pull requests</EmptyTitle>
            <EmptyDescription>
              There are no open pull requests in this repository.
            </EmptyDescription>
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
                <PullRequestRow key={pr.id} pr={pr} owner={owner} repo={repo} />
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </ScrollArea>
  );
}
