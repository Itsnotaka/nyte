"use client";

import {
  IconCheckmark2Small,
  IconChevronDownMedium,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nyte/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@nyte/ui/components/sidebar";

import { useRepoOptional } from "./_components/repo-context";

type AppShellProps = {
  children: React.ReactNode;
};

function RepoSelector() {
  const repoCtx = useRepoOptional();

  if (!repoCtx) {
    return <div className="mt-2 h-10" />;
  }

  const { repos, selectedRepo, setSelectedRepo } = repoCtx;

  return (
    <div className="mt-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-link-bg)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-1"
        >
          <span className="truncate">
            {selectedRepo ? selectedRepo.name : "Select repo"}
          </span>
          <IconChevronDownMedium className="size-4 shrink-0 text-[var(--color-text-faint)]" aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={4}>
          <DropdownMenuLabel>Repositories</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {repos.map((repo) => (
            <DropdownMenuItem
              key={repo.id}
              onSelect={() => setSelectedRepo(repo)}
              className="flex items-center justify-between gap-2"
            >
              <span className="truncate">{repo.name}</span>
              {selectedRepo?.id === repo.id ? (
                <IconCheckmark2Small className="size-4 shrink-0 text-[var(--color-text-muted)]" />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider className="h-dvh w-full bg-[var(--color-shell-bg)] text-[var(--color-text-secondary)]">
      <Sidebar className="bg-[var(--color-sidebar-bg)]">
        <SidebarHeader className="px-2.5">
          <RepoSelector />
        </SidebarHeader>

        <SidebarContent className="px-2.5 pb-3 pt-2" />

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-[var(--color-main-bg)]">
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
