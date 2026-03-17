"use client";

import {
  IconBlockSortAscending,
  IconBlockSortDescending,
  IconChevronDownMedium,
  IconFilter1,
  IconSettingsGear1,
  IconSortArrowUpDown,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sachikit/ui/components/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
import { Table } from "@sachikit/ui/components/table";
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
} from "date-fns";
import Link from "next/link";
import * as React from "react";

import type { InboxData, InboxPullRequest } from "~/lib/github/server";

import { ReviewStatusIcon } from "./review-status-icon";

const CheckStatusDot = React.lazy(() =>
  import("./check-status-dot").then((mod) => ({ default: mod.CheckStatusDot }))
);

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------

type SectionId =
  | "needs_review"
  | "returned"
  | "approved"
  | "waiting_reviewers"
  | "drafts"
  | "merging"
  | "waiting_author";

type InboxSection = {
  id: SectionId;
  label: string;
  items: InboxPullRequest[];
};

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classifyPullRequests(
  login: string,
  pullRequests: InboxPullRequest[]
): InboxSection[] {
  const needsReview: InboxPullRequest[] = [];
  const waitingReviewers: InboxPullRequest[] = [];
  const drafts: InboxPullRequest[] = [];
  const returned: InboxPullRequest[] = [];
  const approved: InboxPullRequest[] = [];
  const merging: InboxPullRequest[] = [];
  const waitingAuthor: InboxPullRequest[] = [];

  const lower = login.toLowerCase();

  for (const pr of pullRequests) {
    const isAuthor = pr.user.login.toLowerCase() === lower;
    const isRequestedReviewer = pr.requested_reviewers.some(
      (r) => r.login.toLowerCase() === lower
    );

    if (pr.merged) {
      merging.push(pr);
    } else if (isAuthor && pr.draft) {
      drafts.push(pr);
    } else if (isAuthor && pr.reviewDecision === "approved") {
      approved.push(pr);
    } else if (isAuthor && pr.reviewDecision === "changes_requested") {
      returned.push(pr);
    } else if (!isAuthor && isRequestedReviewer) {
      needsReview.push(pr);
    } else if (!isAuthor && pr.reviewDecision === "changes_requested") {
      // This reviewer requested changes and is waiting for the author to address them
      waitingAuthor.push(pr);
    } else if (isAuthor) {
      waitingReviewers.push(pr);
    }
  }

  return [
    { id: "needs_review", label: "Needs your review", items: needsReview },
    { id: "returned", label: "Returned to you", items: returned },
    { id: "approved", label: "Approved", items: approved },
    { id: "merging", label: "Merging and recently merged", items: merging },
    { id: "waiting_author", label: "Waiting for author", items: waitingAuthor },
    { id: "drafts", label: "Drafts", items: drafts },
    {
      id: "waiting_reviewers",
      label: "Waiting for reviewers",
      items: waitingReviewers,
    },
  ];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatUpdated(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return `${hours}h`;

  const days = differenceInDays(now, date);
  if (days < 30) return `${days}d`;

  const months = differenceInMonths(now, date);
  return `${months}mo`;
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortField = "title" | "changes" | "updated";
type SortDirection = "asc" | "desc";

function sortItems(
  items: InboxPullRequest[],
  field: SortField,
  direction: SortDirection
): InboxPullRequest[] {
  const sorted = [...items].sort((a, b) => {
    let cmp = 0;
    if (field === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (field === "changes") {
      const aTotal = (a.additions ?? 0) + (a.deletions ?? 0);
      const bTotal = (b.additions ?? 0) + (b.deletions ?? 0);
      cmp = aTotal - bTotal;
    } else {
      cmp = a.updated_at.localeCompare(b.updated_at);
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
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

// ---------------------------------------------------------------------------
// PR row
// ---------------------------------------------------------------------------

function PullRequestRow({ pr }: { pr: InboxPullRequest }) {
  const changesCell =
    pr.additions != null && pr.deletions != null ? (
      <span className="text-xs whitespace-nowrap">
        <span className="text-green-600">+{pr.additions}</span>
        <span className="text-sachi-fg-faint"> / </span>
        <span className="text-red-500">-{pr.deletions}</span>
      </span>
    ) : (
      <span className="text-xs text-sachi-fg-faint">—</span>
    );

  return (
    <Table.Row>
      <Table.Cell className="w-full min-w-0">
        <Link
          href={`/repo/${pr.repoOwner}/${pr.repoName}/pull/${String(pr.number)}`}
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
      </Table.Cell>

      <Table.Cell className="w-20">
        <div className="flex items-center gap-2">
          <React.Suspense fallback={null}>
            <CheckStatusDot
              owner={pr.repoOwner}
              repo={pr.repoName}
              headSha={pr.head.sha}
            />
          </React.Suspense>
          <ReviewStatusIcon reviewDecision={pr.reviewDecision} />
        </div>
      </Table.Cell>

      <Table.Cell className="w-28 text-right">{changesCell}</Table.Cell>

      <Table.Cell className="w-16 text-right text-xs text-sachi-fg-faint">
        {formatUpdated(pr.updated_at)}
      </Table.Cell>
    </Table.Row>
  );
}

// ---------------------------------------------------------------------------
// Section view
// ---------------------------------------------------------------------------

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

function InboxSectionView({
  section,
  sectionRef,
}: {
  section: InboxSection;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}) {
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
    <div ref={sectionRef}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center border-b border-sachi-line-subtle">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sachi-fill">
            <IconChevronDownMedium
              className={`size-4 shrink-0 text-sachi-fg-faint transition-transform ${open ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
            <span className="font-medium text-sachi-fg-muted">
              {section.items.length}
            </span>
            <span className="font-medium text-sachi-fg">{section.label}</span>
          </CollapsibleTrigger>

          <div className="flex items-center gap-1 pr-3">
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-sachi-fg-faint transition-colors hover:bg-sachi-fill hover:text-sachi-fg"
              aria-label="Filter section"
            >
              <IconFilter1 className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="flex size-6 items-center justify-center rounded text-sachi-fg-faint transition-colors hover:bg-sachi-fill hover:text-sachi-fg"
              aria-label="Section settings"
            >
              <IconSettingsGear1 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <CollapsibleContent>
          {sortedItems.length > 0 && (
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
                  <Table.Head className="w-20" />
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
                    className="w-16 text-right"
                  />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedItems.map((pr) => (
                  <PullRequestRow key={pr.id} pr={pr} />
                ))}
              </Table.Body>
            </Table>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inbox layout
// ---------------------------------------------------------------------------

type InboxViewProps = {
  data: InboxData;
};

export function InboxView({ data }: InboxViewProps) {
  const sections = React.useMemo(
    () => classifyPullRequests(data.login, data.pullRequests),
    [data.login, data.pullRequests]
  );

  const [activeSectionId, setActiveSectionId] = React.useState<SectionId>(
    () => sections.find((s) => s.items.length > 0)?.id ?? sections[0]!.id
  );

  const sectionRefs = React.useRef<
    Map<SectionId, React.RefObject<HTMLDivElement | null>>
  >(
    new Map(
      (
        [
          "needs_review",
          "returned",
          "approved",
          "merging",
          "waiting_author",
          "drafts",
          "waiting_reviewers",
        ] as SectionId[]
      ).map((id) => [id, React.createRef<HTMLDivElement | null>()])
    )
  );

  const handleSidebarClick = (id: SectionId) => {
    setActiveSectionId(id);
    const ref = sectionRefs.current.get(id);
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="flex h-full min-h-0">
      {/* Sidebar */}
      <nav className="hidden w-56 shrink-0 border-r border-sachi-line-subtle bg-sachi-sidebar py-3 lg:block">
        <ul className="space-y-0.5 px-2">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => handleSidebarClick(section.id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sachi-fill ${
                  activeSectionId === section.id
                    ? "bg-sachi-fill text-sachi-fg"
                    : "text-sachi-fg-secondary"
                }`}
              >
                <span className="truncate">{section.label}</span>
                <span className="text-xs text-sachi-fg-faint">
                  {section.items.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-sachi-base">
        <div className="mx-auto w-full max-w-[960px]">
          {sections.map((section) => (
            <InboxSectionView
              key={section.id}
              section={section}
              sectionRef={sectionRefs.current.get(section.id)!}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
