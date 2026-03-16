"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
import Link from "next/link";
import * as React from "react";

import type { InboxData, InboxPullRequest } from "~/lib/github/server";

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

function classifyPullRequests(login: string, pullRequests: InboxPullRequest[]): InboxSection[] {
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
    const isRequestedReviewer = pr.requested_reviewers.some((r) => r.login.toLowerCase() === lower);

    if (isAuthor && pr.draft) {
      drafts.push(pr);
    } else if (!isAuthor && isRequestedReviewer) {
      needsReview.push(pr);
    } else if (isAuthor) {
      waitingReviewers.push(pr);
    }
  }

  return [
    { id: "needs_review", label: "Needs your review", items: needsReview },
    { id: "returned", label: "Returned to you", items: returned },
    { id: "approved", label: "Approved", items: approved },
    {
      id: "waiting_reviewers",
      label: "Waiting for reviewers",
      items: waitingReviewers,
    },
    { id: "drafts", label: "Drafts", items: drafts },
    { id: "merging", label: "Merging and recently merged", items: merging },
    { id: "waiting_author", label: "Waiting for author", items: waitingAuthor },
  ];
}

function formatUpdated(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "<1m";
  if (diffMinutes < 60) return `${String(diffMinutes)}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${String(diffHours)}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${String(diffDays)}d`;

  return `${String(Math.floor(diffDays / 30))}mo`;
}

function formatChanges(additions: number | null, deletions: number | null): React.ReactNode {
  if (additions == null || deletions == null) {
    return <span className="text-xs whitespace-nowrap text-sachi-fg-faint">—</span>;
  }

  return (
    <span className="text-xs whitespace-nowrap">
      <span className="text-green-600">+{additions}</span>
      {" / "}
      <span className="text-red-500">-{deletions}</span>
    </span>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PullRequestRow({ pr }: { pr: InboxPullRequest }) {
  return (
    <Link
      href={`/repo/${pr.repoOwner}/${pr.repoName}/pull/${String(pr.number)}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sachi-fill"
    >
      <Avatar size="sm">
        <AvatarImage src={pr.user.avatar_url} alt={pr.user.login} />
        <AvatarFallback>{pr.user.login.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-sachi-fg">{pr.title}</span>
        <span className="truncate text-xs text-sachi-fg-muted">
          {pr.user.login} &middot; {pr.repoFullName} #{pr.number}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        {formatChanges(pr.additions, pr.deletions)}
        <span className="w-8 text-right text-xs text-sachi-fg-faint">
          {formatUpdated(pr.updated_at)}
        </span>
      </div>
    </Link>
  );
}

function InboxSectionView({ section }: { section: InboxSection }) {
  const [open, setOpen] = React.useState(section.items.length > 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-sachi-fill">
        <ChevronDown
          className={`size-4 shrink-0 text-sachi-fg-faint transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <span className="font-medium text-sachi-fg-muted">{section.items.length}</span>
        <span className="font-medium text-sachi-fg">{section.label}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {section.items.length > 0 ? (
          <div className="divide-y divide-sachi-line-subtle">
            {section.items.map((pr) => (
              <PullRequestRow key={pr.id} pr={pr} />
            ))}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

type InboxViewProps = {
  data: InboxData;
};

export function InboxView({ data }: InboxViewProps) {
  const sections = React.useMemo(
    () => classifyPullRequests(data.login, data.pullRequests),
    [data.login, data.pullRequests],
  );

  return <InboxLayout sections={sections} />;
}

function InboxLayout({ sections }: { sections: InboxSection[] }) {
  return (
    <section className="flex h-full min-h-0">
      <nav className="hidden w-56 shrink-0 border-r border-sachi-line-subtle bg-sachi-sidebar py-3 lg:block">
        <ul className="space-y-0.5 px-2">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-sachi-fg-secondary hover:bg-sachi-fill"
              >
                <span className="truncate">{section.label}</span>
                <span className="text-xs text-sachi-fg-faint">{section.items.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-sachi-base">
        <div className="mx-auto w-full max-w-[960px]">
          <div className="divide-y divide-sachi-line-subtle">
            {sections.map((section) => (
              <InboxSectionView key={section.id} section={section} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
