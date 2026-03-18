"use client";

import { IconArrowDown, IconBell, IconBlockSortDescending, IconBox2, IconChart1, IconChevronDownMedium, IconCircleDotsCenter1, IconCircleQuestionmark, IconFilter1, IconMerged, IconQuickSearch, IconSend, IconSettingsGear1, IconSparkle } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import { Card, CardContent, CardHeader } from "@sachikit/ui/components/card";
import { Separator } from "@sachikit/ui/components/separator";
import { cn } from "@sachikit/ui/lib/utils";
import * as React from "react";

// Mock data matching Graphite's structure
const sections = [
  { id: "needs-review", name: "Needs your review", count: 0 },
  { id: "returned", name: "Returned to you", count: 0 },
  { id: "approved", name: "Approved", count: 0 },
  { id: "merging", name: "Merging and recently merged", count: 10 },
  { id: "waiting-author", name: "Waiting for author", count: 0 },
  { id: "drafts", name: "Drafts", count: 0 },
  { id: "waiting-reviewers", name: "Waiting for reviewers", count: 0 },
];

const prs = [
  {
    id: 1,
    title: "Update package dependencies to latest versions",
    subtitle: "Itsnotaka · Itsnotaka/sachi #5",
    author: { name: "Min Chun Fu", avatar: "https://avatars.githubusercontent.com/u/70210356?size=48" },
    status: { review: "approved", ci: "unknown", merge: "merged" },
    changes: { added: 7427, removed: 1022 },
    updated: "1d",
    unread: false,
  },
  {
    id: 2,
    title: "Redesign PR review UX: Graphite-style split button, merge action, cleaner layout",
    subtitle: "Itsnotaka · Itsnotaka/sachi #7",
    author: { name: "Min Chun Fu", avatar: "https://avatars.githubusercontent.com/u/70210356?size=48" },
    status: { review: "approved", ci: "unknown", merge: "merged" },
    changes: { added: 265, removed: 125 },
    updated: "1d",
    unread: false,
    graphite: true,
  },
  {
    id: 3,
    title: "feat(web): add auth-first landing with server suspense and error boundaries",
    subtitle: "Itsnotaka · Itsnotaka/sachi #3",
    author: { name: "Min Chun Fu", avatar: "https://avatars.githubusercontent.com/u/70210356?size=48" },
    status: { review: "approved", ci: "unknown", merge: "merged" },
    changes: { added: 147, removed: 14 },
    updated: "1d",
    unread: false,
    graphite: true,
  },
  {
    id: 4,
    title: "feat: feature parity with GitHub PR review + Graphite UX polish (5 phases)",
    subtitle: "Itsnotaka · Itsnotaka/sachi #10",
    author: { name: "Min Chun Fu", avatar: "https://avatars.githubusercontent.com/u/70210356?size=48" },
    status: { review: "approved", ci: "unknown", merge: "merged" },
    changes: { added: 3076, removed: 307 },
    updated: "1d",
    unread: false,
    graphite: true,
  },
  {
    id: 5,
    title: "Enhance application functionality and update dependencies",
    subtitle: "Itsnotaka · Itsnotaka/sachi #6",
    author: { name: "Min Chun Fu", avatar: "https://avatars.githubusercontent.com/u/70210356?size=48" },
    status: { review: "approved", ci: "unknown", merge: "merged" },
    changes: { added: 2373, removed: 2191 },
    updated: "2d",
    unread: false,
  },
];

// Graphite Logo SVG
function GraphiteLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path d="m20.704 7.123-9.27-2.484-6.788 6.793 2.482 9.276 9.27 2.484 6.788-6.793-2.482-9.276Z" />
      <path d="M17.644 0 3.73 3.729 0 17.644l10.187 10.187 13.915-3.729 3.73-13.915L17.643 0Zm2.27 24.312H7.917L1.92 13.915 7.917 3.518h11.997l5.998 10.397-5.998 10.397Z" />
    </svg>
  );
}

// Navigation Rail Item
function NavRailItem({
  icon: Icon,
  label,
  active,
  shortcut,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      className={cn(
        "group flex flex-col items-center justify-center gap-1 rounded-lg p-2 transition-colors",
        active
          ? "text-sachi-fg"
          : "text-sachi-fg-muted hover:bg-sachi-fill hover:text-sachi-fg"
      )}
      title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
    >
      <Icon className="size-5" />
    </button>
  );
}

// PR Status Icons
function StatusIcon({ type, state }: { type: "review" | "ci" | "merge"; state: string }) {
  const getIcon = () => {
    switch (type) {
      case "review":
        if (state === "approved") return <IconSparkle className="size-4 text-sachi-success" />;
        return <div className="size-4 rounded-full border border-sachi-line" />;
      case "ci":
        return <div className="h-px w-4 bg-sachi-fg-muted" />;
      case "merge":
        return <IconMerged className="size-4 text-sachi-accent" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center">
      {getIcon()}
    </div>
  );
}

// Section Card Component
function SectionCard({
  section,
  defaultExpanded = true,
}: {
  section: (typeof sections)[0];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <Card className="overflow-hidden border-sachi-line-subtle bg-sachi-card">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-sachi-line-subtle/50 px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-sachi-fg-muted"
          onClick={() => setExpanded(!expanded)}
        >
          <IconArrowDown
            className={cn("size-4 transition-transform", !expanded && "-rotate-90")}
          />
        </Button>

        <Badge
          variant="secondary"
          className="h-5 min-w-5 justify-center rounded-full bg-sachi-fill px-1.5 text-xs font-medium tabular-nums"
        >
          {section.count}
        </Badge>

        <h3 className="flex-1 text-sm font-medium text-sachi-fg">{section.name}</h3>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-6 text-sachi-fg-muted">
            <IconBlockSortDescending className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-6 text-sachi-fg-muted">
            <IconSettingsGear1 className="size-4" />
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sachi-line-subtle/50 text-left text-xs text-sachi-fg-muted">
                <th className="w-8 px-2 py-2 text-center">
                  <span className="sr-only">Unread</span>
                </th>
                <th className="w-10 px-2 py-2 text-center">
                  <IconBox2 className="mx-auto size-4" />
                </th>
                <th className="px-2 py-2 font-medium">Title</th>
                <th className="w-8 px-1 py-2 text-center">
                  <IconSparkle className="mx-auto size-4" />
                </th>
                <th className="w-8 px-1 py-2 text-center">
                  <div className="mx-auto size-4 rounded-full border border-current" />
                </th>
                <th className="w-8 px-1 py-2 text-center">
                  <IconMerged className="mx-auto size-4" />
                </th>
                <th className="w-24 px-2 py-2 text-right font-medium">Changes</th>
                <th className="w-16 px-4 py-2 text-right font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {section.count > 0 && prs.map((pr) => (
                <tr
                  key={pr.id}
                  className="group cursor-pointer border-b border-sachi-line-subtle/30 transition-colors hover:bg-sachi-fill/50"
                >
                  <td className="px-2 py-2.5 text-center">
                    {pr.unread && <div className="mx-auto size-2 rounded-full bg-sachi-accent" />}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <div className="relative mx-auto inline-block">
                      <Avatar className="size-6">
                        <AvatarImage src={pr.author.avatar} alt={pr.author.name} />
                        <AvatarFallback className="text-[10px]">
                          {pr.author.name[0]}
                        </AvatarFallback>
                      </Avatar>
                      {pr.graphite && (
                        <div className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-sachi-accent">
                          <IconSparkle className="size-2.5 text-white" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <a
                        href="#"
                        className="truncate text-sm font-medium text-sachi-fg hover:underline"
                      >
                        {pr.title}
                      </a>
                      <span className="text-xs text-sachi-fg-muted">{pr.subtitle}</span>
                    </div>
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <StatusIcon type="review" state={pr.status.review} />
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <StatusIcon type="ci" state={pr.status.ci} />
                  </td>
                  <td className="px-1 py-2.5 text-center">
                    <StatusIcon type="merge" state={pr.status.merge} />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2 font-mono text-xs tabular-nums">
                      <span className="text-sachi-success">+{pr.changes.added.toLocaleString()}</span>
                      <span className="text-sachi-danger">-{pr.changes.removed.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-xs text-sachi-fg-muted">{pr.updated}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {section.count === 0 && (
            <div className="flex h-24 items-center justify-center text-sm text-sachi-fg-muted">
              No pull requests
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function GraphiteDemoPage() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-sachi-shell text-sachi-fg">
      {/* Navigation Rail */}
      <nav className="flex w-14 flex-col items-center border-r border-sachi-line-subtle bg-sachi-sidebar py-3">
        {/* Top Items */}
        <div className="flex flex-col gap-1">
          <a
            href="#"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sachi-accent"
          >
            <GraphiteLogo className="size-7" />
          </a>

          <Separator className="my-2 bg-sachi-line-subtle" />

          <NavRailItem icon={IconBox2} label="PR Inbox" active shortcut="G then I" />
          <NavRailItem icon={IconSend} label="Agents" shortcut="" />
          <NavRailItem icon={IconMerged} label="Merge Queue" shortcut="G then M" />
          <NavRailItem icon={IconChart1} label="Insights" shortcut="G then T" />
          <NavRailItem icon={IconSparkle} label="AI Reviews" shortcut="G then R" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Items */}
        <div className="flex flex-col gap-1">
          <Separator className="my-2 bg-sachi-line-subtle" />

          <NavRailItem icon={IconBell} label="Notifications" />
          <NavRailItem icon={IconQuickSearch} label="Search" />
          <NavRailItem icon={IconCircleQuestionmark} label="Help" />
          <NavRailItem icon={IconSettingsGear1} label="Settings" shortcut="G then S" />

          <div className="flex justify-center pt-2">
            <Avatar className="size-7 cursor-pointer ring-2 ring-transparent transition-all hover:ring-sachi-line">
              <AvatarImage src="https://avatars.githubusercontent.com/u/70210356?size=48" alt="User" />
              <AvatarFallback>MC</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>

      {/* Collapsible Sidebar */}
      {sidebarOpen && (
        <aside className="flex w-[300px] flex-col border-r border-sachi-line-subtle bg-sachi-sidebar">
          <div className="flex flex-1 flex-col gap-1 p-4">
            <ul className="space-y-1">
              {sections.map((section) => (
                <li
                  key={section.id}
                  className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-sachi-fill"
                >
                  <span className="flex-1 text-sm text-sachi-fg">{section.name}</span>
                  <Badge
                    variant="secondary"
                    className="h-5 min-w-5 justify-center rounded-full bg-sachi-fill px-1.5 text-xs font-medium tabular-nums"
                  >
                    {section.count}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100"
                  >
                    <IconCircleDotsCenter1 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <Separator className="my-2 bg-sachi-line-subtle" />

            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sachi-fg-muted hover:text-sachi-fg"
            >
              <div className="flex size-5 items-center justify-center rounded-full border border-current">
                <span className="text-xs">+</span>
              </div>
              <span className="text-sm">Add section</span>
            </Button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden bg-sachi-surface">
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-sachi-line-subtle bg-sachi-surface px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <IconFilter1 className="size-4" />
            </Button>
            <h1 className="text-lg font-semibold text-sachi-fg">Inbox</h1>
          </div>

          <Button variant="outline" className="gap-2 border-sachi-line-subtle bg-sachi-card">
            <IconBox2 className="size-4" />
            <span className="text-sm">Itsnotaka/sachi</span>
            <IconChevronDownMedium className="size-4" />
          </Button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            {sections.map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 flex justify-center pb-8">
            <GraphiteLogo className="size-8 opacity-20" />
          </div>
        </div>
      </main>
    </div>
  );
}
