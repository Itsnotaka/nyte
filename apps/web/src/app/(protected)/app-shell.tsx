"use client";

import {
  IconBox2,
  IconChevronDownMedium,
  IconPencil,
} from "@central-icons-react/round-outlined-radius-2-stroke-1.5";
import { Avatar, AvatarFallback, AvatarImage } from "@sachikit/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@sachikit/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@sachikit/ui/components/sidebar";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useTRPC } from "~/lib/trpc/react";

type RepoRow = {
  githubRepoId: number;
  ownerLogin: string;
  repoName: string;
};

type AppShellProps = {
  children: React.ReactNode;
  repos: RepoRow[] | null;
};

function groupByOwner(rows: RepoRow[]) {
  const map = new Map<string, RepoRow[]>();
  for (const r of rows) {
    const list = map.get(r.ownerLogin) ?? [];
    list.push(r);
    map.set(r.ownerLogin, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.repoName.localeCompare(b.repoName));
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function AppChromeBar({ repos }: { repos: RepoRow[] | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const match = pathname.match(/^\/repo\/([^/]+)\/([^/]+)/);
  const triggerLabel = match ? `${match[1]}/${match[2]}` : "Repos";
  const grouped = repos ? groupByOwner(repos) : [];

  return (
    <header className="flex h-10 shrink-0 items-center justify-between gap-3 px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <SidebarTrigger layout="inline" />
        <span className="truncate text-sm font-medium tracking-tight text-sachi-fg">Inbox</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className="inline-flex max-w-[min(14rem,calc(100vw-6rem))] shrink-0 items-center gap-1.5 rounded-md border border-sachi-line bg-sachi-base px-2 py-1 text-xs text-sachi-fg transition-colors hover:bg-sachi-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sachi-focus data-popup-open:bg-sachi-fill"
        >
          <IconBox2 className="size-4 shrink-0 text-sachi-fg-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left font-medium text-sachi-fg">
            {repos === null ? "Repos" : triggerLabel}
          </span>
          <IconChevronDownMedium
            className="size-4 shrink-0 text-sachi-fg-muted"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {repos === null ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
          ) : repos.length === 0 ? (
            <DropdownMenuItem onClick={() => router.push("/setup/repos")}>
              Sync repos
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                Synced repos
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {grouped.map(([owner, list]) => (
                <DropdownMenuGroup key={owner}>
                  <DropdownMenuLabel className="flex items-center gap-2 py-1.5 font-normal">
                    <Avatar className="size-6">
                      <AvatarImage src={`https://github.com/${owner}.png`} alt="" />
                      <AvatarFallback className="text-[10px]">
                        {owner.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{owner}</span>
                  </DropdownMenuLabel>
                  {list.map((r) => (
                    <DropdownMenuItem
                      key={r.githubRepoId}
                      className="pl-9"
                      onClick={() => router.push(`/repo/${r.ownerLogin}/${r.repoName}`)}
                    >
                      {r.repoName}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-1.5"
                onClick={() => router.push("/setup/repos")}
              >
                <IconPencil className="size-4 shrink-0" aria-hidden="true" />
                Edit synced repos
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function SidebarNav({ onWarmInbox }: { onWarmInbox: () => void }) {
  return (
    <nav aria-label="Primary">
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/"
            prefetch={false}
            onFocus={onWarmInbox}
            onMouseEnter={onWarmInbox}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus"
          >
            <IconBox2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Inbox</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function AppInset({ children, repos }: AppShellProps) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/setup");

  return (
    <SidebarInset className="flex flex-col overflow-hidden bg-sachi-surface">
      {hideChrome ? null : <AppChromeBar repos={repos} />}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </SidebarInset>
  );
}

export function AppShell({ children, repos }: AppShellProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  function warmInbox() {
    if (pathname === "/") {
      return;
    }

    void queryClient.prefetchQuery({
      ...trpc.github.getInboxData.queryOptions(),
      gcTime: 5 * 60_000,
      staleTime: 60_000,
    });
    void queryClient.prefetchQuery({
      ...trpc.settings.getInboxSectionOrder.queryOptions(),
      gcTime: 5 * 60_000,
      staleTime: 60_000,
    });
  }

  return (
    <SidebarProvider open={true} className="h-dvh w-full bg-sachi-shell text-sachi-fg-secondary">
      <Sidebar className="bg-sachi-sidebar">
        <SidebarContent className="px-2.5 pt-3 pb-3">
          <SidebarNav onWarmInbox={warmInbox} />
        </SidebarContent>
      </Sidebar>

      <AppInset repos={repos}>{children}</AppInset>
    </SidebarProvider>
  );
}
