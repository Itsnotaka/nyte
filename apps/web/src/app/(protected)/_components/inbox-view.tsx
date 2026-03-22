"use client";

import {
  IconBlockSortAscending,
  IconBlockSortDescending,
  IconChevronDownMedium,
  IconCircleCheck,
  IconCircleDashed,
  IconCircleX,
  IconMerged,
  IconSettingsGear1,
  IconSortArrowUpDown,
} from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import {
  DEFAULT_INBOX_SECTION_RULES,
  type GitHubCheckSummary,
  type InboxCondition,
  type InboxConditionPreset,
  type InboxSectionId,
  type InboxSectionRule,
} from "@sachikit/github";
import { Alert, AlertDescription } from "@sachikit/ui/components/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { Card, CardContent } from "@sachikit/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sachikit/ui/components/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@sachikit/ui/components/empty";
import { Input } from "@sachikit/ui/components/input";
import { Label } from "@sachikit/ui/components/label";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Skeleton } from "@sachikit/ui/components/skeleton";
import { Table } from "@sachikit/ui/components/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { compareAsc, compareDesc, parseISO } from "date-fns";
import Link from "next/link";
import * as React from "react";

import { getPullRequestDiffSummaryOptions } from "~/lib/github/pull-request-diff";
import type { InboxData, InboxProbeData, InboxPullRequestRow } from "~/lib/github/server";
import { formatRelativeTime } from "~/lib/time";
import { page, stack } from "~/lib/trpc/pr-batch";
import { useTRPC } from "~/lib/trpc/react";

import { CheckStatusDot } from "./check-status-dot";
import { prHref, writePr } from "./inbox-pr";
import { ReviewStatusIcon } from "./review-status-icon";
import { useDeferredVisibility } from "./use-deferred-visibility";

type SortField = "title" | "changes" | "updated";
type SortDirection = "asc" | "desc";

const DEFAULT_SECTION_ORDER: InboxSectionId[] = DEFAULT_INBOX_SECTION_RULES.map((rule) => rule.id);
const DEFAULT_RULES_BY_ID = new Map(DEFAULT_INBOX_SECTION_RULES.map((rule) => [rule.id, rule]));
const CONDITION_PRESET_LABELS: Record<InboxConditionPreset, string> = {
  has_active_review: "Has active reviews",
  has_approvals: "Has approvals",
  has_unaddressed_changes_requested: "Has unaddressed changes",
  is_active_reviewer: "You left a review",
  is_approver: "You approved",
  is_author: "You are the author",
  is_draft: "PR is draft",
  is_fully_approved: "Fully approved",
  is_merging: "Auto-merge enabled",
  is_open: "PR is open",
  is_recently_merged: "Recently merged",
  is_rerequested_reviewer: "Re-review requested",
  is_requested_reviewer: "Review requested from you",
};

type FlatCondition = {
  label: string;
  negated: boolean;
};

type FilterGroup = FlatCondition[];

type InboxSection = {
  id: string;
  label: string;
  items: InboxPullRequestRow[] | null;
};

type CheckRef = {
  owner: string;
  repo: string;
  ref: string;
};

type CheckMap = Record<string, GitHubCheckSummary | null>;

type InboxProbe = {
  data: InboxProbeData | null | undefined;
  error: { message: string } | null;
  id: string;
  isLoading: boolean;
  label: string;
  renderMs: number | null;
  source: "graphql" | "rest";
};

function flattenAndConditions(condition: InboxCondition): FlatCondition[] {
  switch (condition.type) {
    case "all":
      return condition.conditions.flatMap(flattenAndConditions);
    case "not":
      if (condition.condition.type === "preset") {
        return [
          {
            label:
              CONDITION_PRESET_LABELS[condition.condition.preset] ?? condition.condition.preset,
            negated: true,
          },
        ];
      }
      return flattenAndConditions(condition.condition).map((c) => ({
        ...c,
        negated: !c.negated,
      }));
    case "preset":
      return [
        {
          label: CONDITION_PRESET_LABELS[condition.preset] ?? condition.preset,
          negated: false,
        },
      ];
    case "any":
      return [{ label: "Any of multiple conditions", negated: false }];
  }
}

function flattenToFilterGroups(condition: InboxCondition): FilterGroup[] {
  switch (condition.type) {
    case "any":
      return condition.conditions.map((c) => flattenAndConditions(c));
    case "all":
    case "not":
    case "preset":
      return [flattenAndConditions(condition)];
  }
}

function sortItems(
  items: InboxPullRequestRow[],
  field: SortField,
  direction: SortDirection,
): InboxPullRequestRow[] {
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

function checkKey(input: CheckRef): string {
  return `${input.owner.toLowerCase()}/${input.repo.toLowerCase()}@${input.ref}`;
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

function PullRequestRow({
  active,
  checks,
  checksErr,
  checksLoad,
  onOpen,
  onSeen,
  pr,
}: {
  active: boolean;
  checks: CheckMap;
  checksErr: boolean;
  checksLoad: boolean;
  onOpen: (value: string) => void;
  onSeen: (input: CheckRef) => void;
  pr: InboxPullRequestRow;
}) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { hasBeenVisible, ref } = useDeferredVisibility<HTMLDivElement>();
  const isOpen = pr.state === "open" && !pr.merged;
  const value = writePr({ owner: pr.repoOwner, repo: pr.repoName, number: pr.number });
  const check = checkKey({
    owner: pr.repoOwner,
    repo: pr.repoName,
    ref: pr.head.sha,
  });
  const summary = checks[check];

  React.useEffect(() => {
    if (!hasBeenVisible || !isOpen) {
      return;
    }

    onSeen({ owner: pr.repoOwner, repo: pr.repoName, ref: pr.head.sha });
  }, [hasBeenVisible, isOpen, onSeen, pr.head.sha, pr.repoName, pr.repoOwner]);

  function warm() {
    const q = page(
      {
        owner: pr.repoOwner,
        repo: pr.repoName,
        pullNumber: pr.number,
      },
      { staleTime: 60_000 },
    );
    void qc.prefetchQuery(trpc.github.getPullRequestPage.queryOptions(q.input, q.opts));

    const s = stack(
      {
        owner: pr.repoOwner,
        repo: pr.repoName,
        pullNumber: pr.number,
      },
      { staleTime: 60_000 },
    );
    void qc.prefetchQuery(trpc.github.getPullRequestStack.queryOptions(s.input, s.opts));

    if (pr.head.sha && pr.base.sha) {
      void qc.prefetchQuery(
        getPullRequestDiffSummaryOptions({
          owner: pr.repoOwner,
          repo: pr.repoName,
          pullNumber: pr.number,
          headSha: pr.head.sha,
          baseSha: pr.base.sha,
        }),
      );
    }
  }

  function open(event: React.MouseEvent<HTMLAnchorElement>) {
    warm();
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    onOpen(value);
  }

  return (
    <Table.Row>
      <Table.Cell className="w-full min-w-0">
        <div ref={ref}>
          <Link
            href={prHref(value)}
            onClick={open}
            onFocus={warm}
            onMouseEnter={warm}
            prefetch={false}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 items-center gap-3 rounded-md px-1 py-1 ${active ? "bg-sachi-fill/70" : ""}`}
          >
            <Avatar size="sm">
              <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
              <AvatarFallback>{pr.user.login.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate text-sm font-medium text-sachi-fg">{pr.title}</span>
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
          hasError={checksErr && isOpen && hasBeenVisible}
          isLoading={checksLoad && isOpen && hasBeenVisible && summary === undefined}
          summary={summary}
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
        <SortIcon field={field} active={activeField === field} direction={direction} />
      </button>
    </Table.Head>
  );
}

function SectionFiltersDialog({ rule }: { rule: InboxSectionRule }) {
  const filterGroups = React.useMemo(() => flattenToFilterGroups(rule.condition), [rule.condition]);

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Section settings" />}
      >
        <IconSettingsGear1 className="size-4 text-sachi-fg-faint" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update &ldquo;{rule.label}&rdquo;</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-sachi-fg-muted">Section name</Label>
            <Input value={rule.label} readOnly />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-sachi-fg-muted">Filters</Label>
            <div className="space-y-3">
              {filterGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1.5">
                  {group.map((condition, condIdx) => {
                    let prefix: string | null = null;
                    if (groupIdx > 0 && condIdx === 0) prefix = "Or";
                    else if (condIdx > 0) prefix = "And";

                    return (
                      <div key={condIdx} className="flex items-center gap-2">
                        <span className="w-7 shrink-0 text-right text-xs font-medium text-sachi-fg-muted">
                          {prefix}
                        </span>
                        <div className="flex-1 rounded-lg border border-sachi-line-subtle px-3 py-1.5 text-sm text-sachi-fg">
                          {condition.negated && <span className="text-sachi-fg-muted">Not: </span>}
                          {condition.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function SectionBodySkeleton() {
  return (
    <CardContent className="space-y-3 px-4 py-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </CardContent>
  );
}

function PullRequestTable({
  checks,
  checksErr,
  checksLoad,
  items,
  onOpen,
  onSeen,
  selected,
  sortDirection,
  sortField,
  onSort,
}: {
  checks: CheckMap;
  checksErr: boolean;
  checksLoad: boolean;
  items: InboxPullRequestRow[];
  onOpen: (value: string) => void;
  onSeen: (input: CheckRef) => void;
  selected: string | null;
  sortDirection: SortDirection;
  sortField: SortField;
  onSort: (field: SortField) => void;
}) {
  return (
    <Table layout="fixed">
      <Table.Header variant="compact">
        <Table.Row>
          <SortableHead
            field="title"
            label="Title"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
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
            onSort={onSort}
            className="w-28 text-right"
          />
          <SortableHead
            field="updated"
            label="Updated"
            activeField={sortField}
            direction={sortDirection}
            onSort={onSort}
            className="w-24 text-right"
          />
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {items.map((pr) => (
          <PullRequestRow
            key={pr.id}
            active={
              selected === writePr({ owner: pr.repoOwner, repo: pr.repoName, number: pr.number })
            }
            checks={checks}
            checksErr={checksErr}
            checksLoad={checksLoad}
            onOpen={onOpen}
            onSeen={onSeen}
            pr={pr}
          />
        ))}
      </Table.Body>
    </Table>
  );
}

function ProbeBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge
      variant="secondary"
      className="h-5 rounded-full bg-sachi-fill px-2 text-[11px] font-medium tabular-nums"
    >
      {children}
    </Badge>
  );
}

function ProbeSectionView({
  checks,
  checksErr,
  checksLoad,
  onOpen,
  onSeen,
  probe,
  selected,
}: {
  checks: CheckMap;
  checksErr: boolean;
  checksLoad: boolean;
  onOpen: (value: string) => void;
  onSeen: (input: CheckRef) => void;
  probe: InboxProbe;
  selected: string | null;
}) {
  const [open, setOpen] = React.useState(true);
  const [sortField, setSortField] = React.useState<SortField>("updated");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const count = probe.data?.items.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("desc");
  };

  const sortedItems = React.useMemo(() => {
    if (probe.data) {
      return sortItems(probe.data.items, sortField, sortDirection);
    }

    return probe.isLoading ? null : [];
  }, [probe.data, probe.isLoading, sortDirection, sortField]);

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 border-b border-sachi-line-subtle/50 px-4 py-2.5">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
            <IconChevronDownMedium
              className={`size-4 shrink-0 text-sachi-fg-faint transition-transform ${open ? "" : "-rotate-90"}`}
              aria-hidden="true"
            />
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center rounded-full bg-sachi-fill px-1.5 text-xs font-medium tabular-nums"
            >
              {count == null ? <Skeleton className="h-3 w-3 rounded-full" /> : count}
            </Badge>
            <span className="truncate font-medium text-sachi-fg">{probe.label}</span>
          </CollapsibleTrigger>
          <div className="flex items-center gap-1.5">
            <ProbeBadge>{probe.source.toUpperCase()}</ProbeBadge>
            <ProbeBadge>
              server{" "}
              {probe.data?.diagnostics.serverMs != null
                ? `${probe.data.diagnostics.serverMs}ms`
                : "--"}
            </ProbeBadge>
            <ProbeBadge>render {probe.renderMs != null ? `${probe.renderMs}ms` : "--"}</ProbeBadge>
          </div>
        </div>

        <CollapsibleContent>
          {probe.error ? (
            <CardContent className="space-y-3 px-4 py-3">
              <Alert>
                <AlertDescription>{probe.error.message}</AlertDescription>
              </Alert>
            </CardContent>
          ) : probe.isLoading || sortedItems == null ? (
            <SectionBodySkeleton />
          ) : (
            <CardContent className="space-y-3 px-0 py-0">
              {probe.data && probe.data.diagnostics.partialFailures.length > 0 ? (
                <div className="px-4 pt-3 text-xs text-sachi-fg-muted">
                  {probe.data.diagnostics.partialFailures.length} repo fetch
                  {probe.data.diagnostics.partialFailures.length === 1 ? "" : "es"} had partial
                  failures.
                </div>
              ) : null}
              {sortedItems.length > 0 ? (
                <PullRequestTable
                  checks={checks}
                  checksErr={checksErr}
                  checksLoad={checksLoad}
                  items={sortedItems}
                  onOpen={onOpen}
                  onSeen={onSeen}
                  selected={selected}
                  sortDirection={sortDirection}
                  sortField={sortField}
                  onSort={handleSort}
                />
              ) : (
                <div className="flex h-24 items-center justify-center px-4 text-sm text-sachi-fg-muted">
                  No pull requests
                </div>
              )}
            </CardContent>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function InboxSectionView({
  checks,
  checksErr,
  checksLoad,
  onOpen,
  onSeen,
  section,
  selected,
}: {
  checks: CheckMap;
  checksErr: boolean;
  checksLoad: boolean;
  onOpen: (value: string) => void;
  onSeen: (input: CheckRef) => void;
  section: InboxSection;
  selected: string | null;
}) {
  const [open, setOpen] = React.useState(section.items == null || section.items.length > 0);
  const [sortField, setSortField] = React.useState<SortField>("updated");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const rule = DEFAULT_RULES_BY_ID.get(section.id as InboxSectionId);
  const count = section.items?.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedItems = React.useMemo(
    () => (section.items == null ? null : sortItems(section.items, sortField, sortDirection)),
    [section.items, sortField, sortDirection],
  );

  return (
    <Card>
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
              {count == null ? <Skeleton className="h-3 w-3 rounded-full" /> : count}
            </Badge>
            <span className="font-medium text-sachi-fg">{section.label}</span>
          </CollapsibleTrigger>
          {rule && <SectionFiltersDialog rule={rule} />}
        </div>

        <CollapsibleContent>
          {sortedItems == null ? (
            <SectionBodySkeleton />
          ) : (
            <CardContent className="px-0">
              {sortedItems.length > 0 ? (
                <PullRequestTable
                  checks={checks}
                  checksErr={checksErr}
                  checksLoad={checksLoad}
                  items={sortedItems}
                  onOpen={onOpen}
                  onSeen={onSeen}
                  selected={selected}
                  sortDirection={sortDirection}
                  sortField={sortField}
                  onSort={handleSort}
                />
              ) : (
                <div className="flex h-24 items-center justify-center text-sm text-sachi-fg-muted">
                  No pull requests
                </div>
              )}
            </CardContent>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function InboxDiagnosticsBanner({ diagnostics }: { diagnostics: InboxData["diagnostics"] }) {
  if (diagnostics.partialFailures.length === 0 && diagnostics.unclassifiedCount === 0) {
    return null;
  }

  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <AlertDescription>
        {diagnostics.partialFailures.length > 0 && (
          <span>
            Some repositories could not be reached ({diagnostics.partialFailures.length} failed).
          </span>
        )}
        {diagnostics.unclassifiedCount > 0 && (
          <span>
            {" "}
            {diagnostics.unclassifiedCount} pull request
            {diagnostics.unclassifiedCount === 1 ? "" : "s"} could not be classified.
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

function InboxEmptyState({ diagnostics }: { diagnostics: InboxData["diagnostics"] }) {
  if (diagnostics.syncedRepoCount === 0 && diagnostics.accessibleRepoCount > 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>No repos synced yet</EmptyTitle>
          <EmptyDescription>
            You have access to {diagnostics.accessibleRepoCount} repositories. Use the sidebar to
            choose which repos to sync.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (diagnostics.fetchedCount === 0 && diagnostics.partialFailures.length > 0) {
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyTitle>Unable to load pull requests</EmptyTitle>
          <EmptyDescription>
            All repository fetches failed. Check your GitHub App installation and try again.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return null;
}

function buildInboxSections(
  data: InboxData | undefined,
  canonicalOrder: readonly InboxSectionId[],
): InboxSection[] {
  const sections = data?.sections ?? [];
  const ready = data != null;
  const byId = new Map(sections.map((section) => [section.id, section]));
  const ordered = canonicalOrder.map((id) => {
    const section = byId.get(id);
    return {
      id,
      label: section?.label ?? DEFAULT_RULES_BY_ID.get(id)?.label ?? id,
      items: section?.items ?? (ready ? [] : null),
    };
  });

  return [
    ...ordered,
    ...sections
      .filter((section) => !canonicalOrder.includes(section.id as InboxSectionId))
      .map((section) => ({
        id: section.id,
        label: section.label,
        items: section.items,
      })),
  ];
}

export function InboxView({
  data,
  onOpen,
  probes,
  sectionOrder,
  selected,
}: {
  data: InboxData | undefined;
  onOpen: (value: string) => void;
  probes?: InboxProbe[];
  sectionOrder: string[] | null | undefined;
  selected: string | null;
}) {
  const trpc = useTRPC();
  const [refs, setRefs] = React.useState<CheckRef[]>([]);
  const checksQuery = useQuery(
    trpc.github.getCheckSummaries.queryOptions(refs, {
      enabled: refs.length > 0,
      staleTime: 60_000,
    }),
  );
  const checks = checksQuery.data ?? {};

  const onSeen = React.useCallback((input: CheckRef) => {
    const key = checkKey(input);
    setRefs((cur) => {
      if (cur.some((row) => checkKey(row) === key)) {
        return cur;
      }
      return [...cur, input];
    });
  }, []);

  const canonicalOrder = (sectionOrder ?? DEFAULT_SECTION_ORDER) as InboxSectionId[];
  const diagnostics = data?.diagnostics;
  const orderedSections = buildInboxSections(data, canonicalOrder);
  const totalItems = data?.sections.reduce((sum, section) => sum + section.items.length, 0) ?? 0;
  const hasProbes = (probes?.length ?? 0) > 0;
  const showBlockingEmpty =
    diagnostics != null &&
    totalItems === 0 &&
    !hasProbes &&
    ((diagnostics.syncedRepoCount === 0 && diagnostics.accessibleRepoCount > 0) ||
      (diagnostics.fetchedCount === 0 && diagnostics.partialFailures.length > 0));

  return (
    <ScrollArea className="h-full min-h-0 bg-sachi-base">
      {diagnostics ? <InboxDiagnosticsBanner diagnostics={diagnostics} /> : null}

      {showBlockingEmpty ? (
        <InboxEmptyState diagnostics={diagnostics} />
      ) : (
        <div className="mx-auto max-w-5xl space-y-4 p-6">
          {probes?.map((probe) => (
            <ProbeSectionView
              key={probe.id}
              checks={checks}
              checksErr={checksQuery.isError}
              checksLoad={checksQuery.isLoading}
              onOpen={onOpen}
              onSeen={onSeen}
              probe={probe}
              selected={selected}
            />
          ))}
          {orderedSections.map((section) => (
            <InboxSectionView
              key={section.id}
              checks={checks}
              checksErr={checksQuery.isError}
              checksLoad={checksQuery.isLoading}
              onOpen={onOpen}
              onSeen={onSeen}
              section={section}
              selected={selected}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
