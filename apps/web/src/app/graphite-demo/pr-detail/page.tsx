"use client";

import {
  IconArrowDown,
  IconBell,
  IconBox2,
  IconBranch,
  IconCalendarEdit,
  IconCheckmark1,
  IconChevronDownMedium,
  IconChevronDownSmall,
  IconCircle,
  IconCircleDotsCenter1,
  IconCircleMinus,
  IconCommits,
  IconHistory,
  IconMerged,
  IconPeopleCopy,
  IconSettingsGear1,
} from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import { Badge } from "@sachikit/ui/components/badge";
import { Button } from "@sachikit/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sachikit/ui/components/dropdown-menu";
import { Separator } from "@sachikit/ui/components/separator";
import { cn } from "@sachikit/ui/lib/utils";
import * as React from "react";

// ============================================================================
// Types
// ============================================================================

interface PullRequest {
  id: number;
  number: number;
  title: string;
  subtitle: string;
  author: {
    name: string;
    login: string;
    avatar: string;
  };
  changes: {
    added: number;
    removed: number;
    files: number;
  };
  updated: string;
  branch: {
    head: string;
    base: string;
  };
  mergedAt?: string;
  mergedBy?: string;
  body: string;
  stack?: StackItem[];
}

interface StackItem {
  id: number;
  number: number;
  title: string;
  merged: boolean;
}

interface SidebarSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}

// ============================================================================
// Mock Data (matching the screenshot exactly)
// ============================================================================

const mockPR: PullRequest = {
  id: 5,
  number: 5,
  title: "Update package dependencies to latest versions",
  subtitle: "Itsnotaka · Itsnotaka/sachi #5",
  author: {
    name: "Min Chun Fu",
    login: "Min Chun Fu",
    avatar: "https://avatars.githubusercontent.com/u/70210356?size=48",
  },
  changes: {
    added: 7427,
    removed: 1022,
    files: 124,
  },
  updated: "1d",
  branch: {
    head: "03-15-enhance_application_architecture_and_update_dependencies",
    base: "main",
  },
  mergedAt: "3/16/26, 2:43:00 PM",
  mergedBy: "Min Chun Fu",
  body: `Update package dependencies to latest versions

- Upgraded @base-ui/react to version 1.3.0 and @central-icons-react/round-outlined-radius-2-stroke-1.5 to version 1.1.169 for improved features and performance.
- Updated motion to version 12.36.0, react-day-picker to version 9.14.0, and react-resizable-panels to version 4.7.3 to ensure compatibility and enhancements.
- Bumped @types/node to version 25.5.0 for better type definitions and support.

Update package dependencies and restore @types/pg

- Removed @types/pg from apps/web/package.json and re-added it to devDependencies for better type support.
- Adjusted pnpm-lock.yaml to reflect the restoration of @types/pg and maintain consistency across dependencies.

Refactor Drawer import to align with updated package structure

- Changed the import statement for the Drawer component from DrawerPreview to Drawer from @base-ui/react/drawer to reflect the latest API changes.

Update package dependencies and refactor authentication structure

- Added @nyte/database as a workspace dependency in package.json and updated pnpm-lock.yaml accordingly.
- Upgraded @tanstack/react-query, @trpc/client, @trpc/react-query, and @trpc/server to their latest versions for improved functionality.
- Refactored authentication imports to align with the new directory structure, enhancing code organization.
- Removed outdated authentication client and server files to streamline the codebase.

Enhance application architecture and update dependencies

- Updated AGENTS.md to recommend using the tRPC TanStack Query integration over the classic React Query integration for improved performance and consistency.
- Added a new db:push script in package.json for streamlined database management.
- Upgraded TypeScript to version 6.0.0-beta and various dependencies, including @tanstack/react-query and neverthrow, to their latest versions for enhanced functionality and type safety.
- Refactored authentication handling to utilize the new drizzle ORM and improved database connection management.
- Introduced a new RepoContext for managing GitHub repository state within the application, enhancing code organization and maintainability.`,
  stack: [
    {
      id: 5,
      number: 5,
      title: "Update package dependencies to latest versions",
      merged: true,
    },
  ],
};

// ============================================================================
// Components
// ============================================================================

function SidebarSection({ title, defaultOpen = true, children, action }: SidebarSectionProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group flex w-full items-center justify-between py-2 text-sm font-medium text-sachi-fg">
        <span>{title}</span>
        <div className="flex items-center gap-1">
          {action}
          <IconChevronDownSmall className="size-4 text-sachi-fg-muted transition-transform group-data-[state=closed]:-rotate-90" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded bg-sachi-fill px-1 py-0.5 font-mono text-xs text-sachi-fg-muted">
      {children}
    </kbd>
  );
}

function ShortcutSequence({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-0.5 text-xs text-sachi-fg-muted">
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          <ShortcutKey>{key}</ShortcutKey>
          {i < keys.length - 1 && <span className="mx-0.5">then</span>}
        </React.Fragment>
      ))}
    </span>
  );
}

function PRStack({ stack }: { stack: StackItem[] }) {
  return (
    <div className="rounded-lg border border-sachi-line-subtle bg-sachi-card">
      <div className="flex items-center justify-between border-b border-sachi-line-subtle px-4 py-2">
        <div className="flex items-center gap-2">
          <IconCommits className="size-4 text-sachi-fg-muted" />
          <span className="text-sm font-medium text-sachi-fg">
            Stack <span className="text-sachi-fg-muted">1 of {stack.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            <IconPeopleCopy className="mr-1.5 size-3.5" />
            Copy stack
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <IconCircleDotsCenter1 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        {stack.map((item, i) => (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full",
                  item.merged
                    ? "bg-sachi-accent/10 text-sachi-accent"
                    : "bg-sachi-fill text-sachi-fg-muted",
                )}
              >
                {item.merged ? (
                  <IconMerged className="size-3.5" />
                ) : (
                  <IconCommits className="size-3.5" />
                )}
              </div>
              {i < stack.length - 1 && <div className="my-1 w-px flex-1 bg-sachi-line-subtle" />}
            </div>

            <div className="flex flex-1 items-center gap-2 pb-4">
              <span className="text-sm text-sachi-fg-muted">#{item.number}</span>
              <span className="flex-1 truncate text-sm text-sachi-fg">{item.title}</span>
              {item.merged && (
                <Badge variant="secondary" className="h-5 bg-sachi-accent/10 text-sachi-accent">
                  Merged
                </Badge>
              )}
              <span className="text-xs text-sachi-fg-muted">1d</span>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 pl-9">
          <div className="flex size-6 items-center justify-center rounded-full bg-sachi-fill">
            <IconBranch className="size-3.5 text-sachi-fg-muted" />
          </div>
          <span className="text-sm text-sachi-fg-muted">main (trunk)</span>
        </div>
      </div>
    </div>
  );
}

function PRDescription({ pr }: { pr: PullRequest }) {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className="rounded-lg border border-sachi-line-subtle bg-sachi-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <IconArrowDown
              className={cn(
                "size-4 text-sachi-fg-muted transition-transform",
                !isOpen && "-rotate-90",
              )}
            />
            <span className="text-sm font-medium text-sachi-fg">Description</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs opacity-0 group-hover:opacity-100"
          >
            <IconCalendarEdit className="mr-1.5 size-3.5" />
            Edit
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="prose prose-sm prose-sachi max-w-none">
              {pr.body.split("\n\n").map((paragraph, i) => {
                if (paragraph.startsWith("- ")) {
                  return (
                    <ul key={i} className="my-2 list-disc space-y-1 pl-5">
                      {paragraph.split("\n").map((line, j) => (
                        <li key={j} className="text-sm text-sachi-fg-secondary">
                          {line.replace("- ", "")}
                        </li>
                      ))}
                    </ul>
                  );
                }
                if (paragraph.startsWith("Update package") && paragraph.includes("@types/pg")) {
                  return (
                    <React.Fragment key={i}>
                      <h3 className="mt-4 text-sm font-semibold text-sachi-fg">
                        {paragraph.split("\n")[0]}
                      </h3>
                      <ul className="my-2 list-disc space-y-1 pl-5">
                        {paragraph
                          .split("\n")
                          .slice(1)
                          .filter((l) => l.startsWith("- "))
                          .map((line, j) => (
                            <li key={j} className="text-sm text-sachi-fg-secondary">
                              {line.replace("- ", "")}
                            </li>
                          ))}
                      </ul>
                    </React.Fragment>
                  );
                }
                if (paragraph.startsWith("Refactor Drawer")) {
                  return (
                    <React.Fragment key={i}>
                      <h3 className="mt-4 text-sm font-semibold text-sachi-fg">
                        {paragraph.split("\n")[0]}
                      </h3>
                      <ul className="my-2 list-disc space-y-1 pl-5">
                        {paragraph
                          .split("\n")
                          .slice(1)
                          .filter((l) => l.startsWith("- "))
                          .map((line, j) => (
                            <li key={j} className="text-sm text-sachi-fg-secondary">
                              {line.replace("- ", "")}
                            </li>
                          ))}
                      </ul>
                    </React.Fragment>
                  );
                }
                if (
                  paragraph.startsWith("Update package dependencies and refactor authentication")
                ) {
                  return (
                    <React.Fragment key={i}>
                      <h3 className="mt-4 text-sm font-semibold text-sachi-fg">
                        {paragraph.split("\n")[0]}
                      </h3>
                      <ul className="my-2 list-disc space-y-1 pl-5">
                        {paragraph
                          .split("\n")
                          .slice(1)
                          .filter((l) => l.startsWith("- "))
                          .map((line, j) => (
                            <li key={j} className="text-sm text-sachi-fg-secondary">
                              {line.replace("- ", "")}
                            </li>
                          ))}
                      </ul>
                    </React.Fragment>
                  );
                }
                if (paragraph.startsWith("Enhance application architecture")) {
                  return (
                    <React.Fragment key={i}>
                      <h3 className="mt-4 text-sm font-semibold text-sachi-fg">
                        {paragraph.split("\n")[0]}
                      </h3>
                      <ul className="my-2 list-disc space-y-1 pl-5">
                        {paragraph
                          .split("\n")
                          .slice(1)
                          .filter((l) => l.startsWith("- "))
                          .map((line, j) => (
                            <li key={j} className="text-sm text-sachi-fg-secondary">
                              {line.replace("- ", "")}
                            </li>
                          ))}
                      </ul>
                    </React.Fragment>
                  );
                }
                return (
                  <p key={i} className="my-2 text-sm text-sachi-fg-secondary">
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function DiscussionSection() {
  return (
    <div className="rounded-lg border border-sachi-line-subtle bg-sachi-card">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <IconArrowDown className="size-4 text-sachi-fg-muted" />
            <span className="text-sm font-medium text-sachi-fg">Discussion</span>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-3 rounded-lg border border-sachi-line-subtle bg-sachi-fill/50 p-3">
              <Avatar className="size-8">
                <AvatarImage src={mockPR.author.avatar} alt={mockPR.author.name} />
                <AvatarFallback>{mockPR.author.name[0]}</AvatarFallback>
              </Avatar>
              <input
                type="text"
                placeholder="Add discussion comment"
                className="flex-1 bg-transparent text-sm text-sachi-fg placeholder:text-sachi-fg-muted focus:outline-none"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function FileRow({
  filename,
  status,
  additions,
  deletions,
  viewed,
}: {
  filename: string;
  status: "added" | "removed" | "modified";
  additions: number;
  deletions: number;
  viewed?: boolean;
}) {
  const statusColors = {
    added: "text-sachi-success",
    removed: "text-sachi-danger",
    modified: "text-sachi-fg-muted",
  };

  const statusIcons = {
    added: IconBox2,
    removed: IconCircleMinus,
    modified: IconCircle,
  };

  const StatusIcon = statusIcons[status];

  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-sachi-fill/50">
      <input type="checkbox" checked={viewed} className="size-4 rounded border-sachi-line" />
      <StatusIcon className={cn("size-4", statusColors[status])} />
      <span className="flex-1 truncate text-sm text-sachi-fg">{filename}</span>
      <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
        {additions > 0 && <span className="text-sachi-success">+{additions}</span>}
        {deletions > 0 && <span className="text-sachi-danger">-{deletions}</span>}
      </div>
    </div>
  );
}

function FilesSection() {
  return (
    <div className="space-y-2">
      {/* Warning banner */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
        <IconBell className="size-4" />
        <span>
          This PR has 124 files. To improve performance, only the first 50 files are expanded.
        </span>
      </div>

      {/* Files list */}
      <div className="rounded-lg border border-sachi-line-subtle bg-sachi-card">
        <div className="flex items-center justify-between border-b border-sachi-line-subtle px-4 py-2">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <IconCheckmark1 className="size-3.5" />
              Files
            </Button>
            <span className="text-xs text-sachi-fg-muted">Tour</span>
            <Badge variant="outline" className="h-5 text-[10px]">
              Beta
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              Base
              <IconChevronDownMedium className="ml-1 size-3.5" />
            </Button>
            <span className="text-sachi-fg-muted">→</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              v1 Latest version
              <IconChevronDownMedium className="ml-1 size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7">
              <IconSettingsGear1 className="size-4" />
            </Button>
          </div>
        </div>

        <FileRow
          filename=".config/.oxfmtrc.json"
          status="modified"
          additions={1}
          deletions={1}
          viewed={true}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function GraphitePRDetailPage() {
  const pr = mockPR;

  return (
    <div className="flex min-h-screen bg-sachi-shell">
      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-sachi-line-subtle bg-sachi-card/80 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-sm text-sachi-fg-muted">sachi</span>
            <span className="text-sachi-fg-muted">#</span>
            <span className="text-sm text-sachi-fg-muted">{pr.number}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Review changes button */}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <span>Review changes</span>
            </Button>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8">
                    <IconCircleDotsCenter1 className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconPeopleCopy className="mr-2 size-4" />
                    <span>Copy link to PR</span>
                    <div className="ml-auto">
                      <ShortcutSequence keys={["C", "L"]} />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Copy link to GitHub</span>
                    <div className="ml-auto">
                      <ShortcutSequence keys={["C", "G"]} />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Copy PR branch name</span>
                    <div className="ml-auto">
                      <ShortcutSequence keys={["C", "B"]} />
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Copy CLI checkout command</span>
                    <div className="ml-auto">
                      <ShortcutSequence keys={["C", "C"]} />
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconHistory className="mr-2 size-4" />
                    <span>Activity</span>
                    <div className="ml-auto">
                      <ShortcutKey>3</ShortcutKey>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconBox2 className="mr-2 size-4" />
                    <span>Open in editor</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <IconSettingsGear1 className="mr-2 size-4" />
                    <span>Diff settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8">
                <IconBell className="size-4" />
              </Button>
              <span className="text-xs text-sachi-fg-muted">0</span>
            </div>

            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              Chat
              <IconChevronDownMedium className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* PR Content */}
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              {/* Left Column */}
              <div className="space-y-6">
                {/* PR Title Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-sachi-fg-muted">
                    <span>sachi #{pr.number}</span>
                  </div>

                  <h1 className="text-xl font-semibold text-sachi-fg">{pr.title}</h1>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Avatar className="size-5">
                      <AvatarImage src={pr.author.avatar} alt={pr.author.name} />
                      <AvatarFallback>{pr.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sachi-fg">{pr.author.login}</span>

                    {/* Branch pill */}
                    <div className="flex items-center gap-1.5 rounded-full bg-sachi-fill px-3 py-1">
                      <IconBranch className="size-3.5 text-sachi-fg-muted" />
                      <span className="text-sachi-fg">{pr.branch.head}</span>
                      <span className="text-sachi-fg-muted">→</span>
                      <span className="text-sachi-fg">{pr.branch.base}</span>
                    </div>

                    <span className="text-sachi-fg-muted">{pr.changes.files} files</span>
                    <span className="text-sachi-success">+{pr.changes.added.toLocaleString()}</span>
                    <span className="text-sachi-danger">
                      -{pr.changes.removed.toLocaleString()}
                    </span>
                    <span className="text-sachi-fg-muted">Updated {pr.updated} ago</span>
                  </div>
                </div>

                {/* Stack */}
                {pr.stack && <PRStack stack={pr.stack} />}

                {/* Description */}
                <PRDescription pr={pr} />

                {/* Discussion */}
                <DiscussionSection />

                {/* Files */}
                <FilesSection />
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Status Card */}
                <div className="rounded-lg border border-sachi-line-subtle bg-sachi-card p-4">
                  <div className="flex items-center gap-2 text-sachi-accent">
                    <IconMerged className="size-5" />
                    <span className="font-medium">Merged</span>
                  </div>
                  <p className="mt-1 text-xs text-sachi-fg-muted">
                    This PR was successfully merged by {pr.mergedBy} on {pr.mergedAt}
                  </p>
                </div>

                {/* Review with Graphite */}
                <Button className="w-full" variant="outline">
                  <IconBox2 className="mr-2 size-4" />
                  Review with Graphite
                </Button>

                <Button variant="ghost" size="sm" className="w-full text-xs text-sachi-fg-muted">
                  Revert merge
                </Button>

                <Separator />

                {/* Sidebar Sections */}
                <div className="divide-y divide-sachi-line-subtle">
                  <SidebarSection title="Checks" defaultOpen={false}>
                    <p className="text-sm text-sachi-fg-muted">No checks</p>
                  </SidebarSection>

                  <SidebarSection title="Reviewers" defaultOpen={false}>
                    <p className="text-sm text-sachi-fg-muted">No reviewers</p>
                  </SidebarSection>

                  <SidebarSection
                    title="Labels"
                    defaultOpen={false}
                    action={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100"
                      >
                        <IconBox2 className="size-4" />
                      </Button>
                    }
                  >
                    <p className="text-sm text-sachi-fg-muted">No labels</p>
                  </SidebarSection>

                  <SidebarSection
                    title="Assignees"
                    defaultOpen={false}
                    action={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100"
                      >
                        <IconBox2 className="size-4" />
                      </Button>
                    }
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-sachi-fg-muted">No assignees</span>
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                        Assign yourself
                      </Button>
                    </div>
                  </SidebarSection>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
