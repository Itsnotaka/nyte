"use client";

import {
  IconBlockSortAscending,
  IconBlockSortDescending,
  IconChevronDownMedium,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconMerged,
  IconSortArrowUpDown,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import { DEFAULT_INBOX_SECTION_ORDER } from "@sachikit/db/schema/settings";
import type { InboxSectionId } from "@sachikit/github";
import { Alert, AlertDescription } from "@sachikit/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sachikit/ui/components/avatar";
import { Badge } from "@sachikit/ui/components/badge";
import { Card, CardContent } from "@sachikit/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@sachikit/ui/components/empty";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Table } from "@sachikit/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { compareAsc, compareDesc, parseISO } from "date-fns";
import Link from "next/link";
import * as React from "react";

import type {
  InboxData,
  InboxPullRequestRow,
  InboxSectionData,
} from "~/lib/github/server";
import { formatRelativeTime } from "~/lib/time";
import { useTRPC } from "~/lib/trpc/react";

import { CheckStatusDot } from "./check-status-dot";
import { ReviewStatusIcon } from "./review-status-icon";

type SortField = "title" | "changes" | "updated";
type SortDirection = "asc" | "desc";

function sortItems(
  items: InboxPullRequestRow[],
  field: SortField,
  direction: SortDirection
): InboxPullRequestRow[] {
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

function useDeferredVisibility<T extends Element>() {
  const ref = React.useRef<T | null>(null);
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false);

  React.useEffect(() => {
    if (hasBeenVisible) {
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setHasBeenVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasBeenVisible]);

  return { hasBeenVisible, ref };
}

function PullRequestRow({ pr }: { pr: InboxPullRequestRow }) {
  const trpc = useTRPC();
  const { hasBeenVisible, ref } = useDeferredVisibility<HTMLDivElement>();
  const isOpen = pr.state === "open" && !pr.merged;
  const checkSummaryQuery = useQuery(
    trpc.github.getCheckSummary.queryOptions(
      {
        owner: pr.repoOwner,
        repo: pr.repoName,
        ref: pr.head.sha,
      },
      {
        enabled: isOpen && hasBeenVisible,
        staleTime: 60_000,
      }
    )
  );

  return (
    <Table.Row>
      <Table.Cell className="w-full min-w-0">
        <div ref={ref}>
          <Link
            href={`/repo/${pr.repoOwner}/${pr.repoName}/pull/${String(pr.number)}`}
            prefetch={true}
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
                {pr.user.login} &middot; {pr.repoFullName} #{pr.number}
              </span>
            </div>
          </Link>
        </div>
      </Table.Cell>

      <Table.Cell className="w-8 text-center">
        <ReviewStatusIcon reviewDecision={pr.reviewDecision} />
      </Table.Cell>

      <Table.Cell className="w-8 text-center">
        <CheckStatusDot
          hasError={checkSummaryQuery.isError}
          isLoading={checkSummaryQuery.isLoading && isOpen}
          summary={checkSummaryQuery.data}
        />
      </Table.Cell>

      <Table.Cell className="w-8 text-center">
        {pr.merged ? (
          <IconMerged className="mx-auto size-3.5 text-sachi-accent" />
        ) : pr.state === "open" ? (
          <IconCircleDashed className="mx-auto size-3.5 text-sachi-success" />
        ) : (
          <IconCircleX className="mx-auto size-3.5 text-destructive" />
        )}
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

function InboxSectionView({ section }: { section: InboxSectionData }) {
  const [open, setOpen] = React.useState(section.items.length > 0);
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

  const sortedItems = React.useMemo(
    () => sortItems(section.items, sortField, sortDirection),
    [section.items, sortField, sortDirection]
  );

  return (
    <Card className="bg-sachi-card gap-0 border-sachi-line-subtle py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center border-b border-sachi-line-subtle/50 px-4 py-2.5">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left text-sm">
            <IconChevronDownMedium
              className={`size-4 shrink-0 text-sachi-fg-faint transition-transform ${open ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center rounded-full bg-sachi-fill px-1.5 text-xs font-medium tabular-nums"
            >
              {section.items.length}
            </Badge>
            <span className="font-medium text-sachi-fg">{section.label}</span>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <CardContent className="px-0">
            {sortedItems.length > 0 ? (
              <Table layout="fixed">
                <Table.Header variant="compact">
                  <Table.Row>
                    <SortableHead
                      field="title"
                      label="Title"
                      activeField={sortField}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="w-full pl-4"
                    />
                    <Table.Head className="w-8 text-center">
                      <IconCircleCheck className="mx-auto size-3.5 text-sachi-fg-faint" />
                    </Table.Head>
                    <Table.Head className="w-8 text-center">
                      <IconCircleDashed className="mx-auto size-3.5 text-sachi-fg-faint" />
                    </Table.Head>
                    <Table.Head className="w-8 text-center">
                      <IconMerged className="mx-auto size-3.5 text-sachi-fg-faint" />
                    </Table.Head>
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
                  {sortedItems.map((pr) => (
                    <PullRequestRow key={pr.id} pr={pr} />
                  ))}
                </Table.Body>
              </Table>
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-sachi-fg-muted">
                No pull requests
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function InboxDiagnosticsBanner({
  diagnostics,
}: {
  diagnostics: InboxData["diagnostics"];
}) {
  if (
    diagnostics.partialFailures.length === 0 &&
    diagnostics.unclassifiedCount === 0
  ) {
    return null;
  }

  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <AlertDescription>
        {diagnostics.partialFailures.length > 0 && (
          <span>
            Some repositories could not be reached (
            {diagnostics.partialFailures.length} failed).
          </span>
        )}
        {diagnostics.unclassifiedCount > 0 && (
          <span>
            {" "}
            {diagnostics.unclassifiedCount} pull request
            {diagnostics.unclassifiedCount === 1 ? "" : "s"} could not be
            classified.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

function InboxEmptyState({
  diagnostics,
}: {
  diagnostics: InboxData["diagnostics"];
}) {
  if (
    diagnostics.syncedRepoCount === 0 &&
    diagnostics.accessibleRepoCount > 0
  ) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>No repos synced yet</EmptyTitle>
          <EmptyDescription>
            You have access to {diagnostics.accessibleRepoCount} repositories.
            Use the sidebar to choose which repos to sync.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (
    diagnostics.fetchedCount === 0 &&
    diagnostics.partialFailures.length > 0
  ) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>Unable to load pull requests</EmptyTitle>
          <EmptyDescription>
            All repository fetches failed. Check your GitHub App installation
            and try again.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyTitle>No open pull requests</EmptyTitle>
        <EmptyDescription>
          There are no open pull requests across your synced repositories right
          now.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function useOrderedSections(sections: InboxSectionData[]): InboxSectionData[] {
  const trpc = useTRPC();
  const orderQuery = useQuery(
    trpc.settings.getInboxSectionOrder.queryOptions()
  );
  const order = (orderQuery.data ??
    DEFAULT_INBOX_SECTION_ORDER) as InboxSectionId[];

  const byId = new Map(sections.map((s) => [s.id, s]));
  const ordered: InboxSectionData[] = [];
  for (const id of order) {
    const section = byId.get(id);
    if (section) ordered.push(section);
  }
  for (const section of sections) {
    if (!order.includes(section.id as InboxSectionId)) {
      ordered.push(section);
    }
  }
  return ordered;
}

export function InboxView() {
  const trpc = useTRPC();
  const inboxQuery = useQuery({
    ...trpc.github.getInbox.queryOptions(),
    staleTime: 2 * 60_000,
  });
  const data = inboxQuery.data;
  if (!data) {
    return null;
  }
  const { sections, diagnostics } = data;
  const orderedSections = useOrderedSections(sections);
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <ScrollArea className="h-full min-h-0 bg-sachi-base">
      <InboxDiagnosticsBanner diagnostics={diagnostics} />

      {totalItems === 0 ? (
        <InboxEmptyState diagnostics={diagnostics} />
      ) : (
        <div className="mx-auto max-w-5xl space-y-4 p-6">
          {orderedSections.map((section) => (
            <InboxSectionView key={section.id} section={section} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
