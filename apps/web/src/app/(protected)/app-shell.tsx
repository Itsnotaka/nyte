"use client";

import { IconChevronDownMedium } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@sachikit/ui/components/avatar";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@sachikit/ui/components/popover";
import { ScrollArea } from "@sachikit/ui/components/scroll-area";
import { Separator } from "@sachikit/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@sachikit/ui/components/sidebar";
import { useDialKit } from "dialkit";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useRepo } from "./_components/repo-context";

type AppShellProps = {
  children: React.ReactNode;
};

function SyncedReposSummary() {
  const { installations, syncedRepos, totalAccessible, totalSynced } =
    useRepo();

  const displayCount = totalSynced > 0 ? totalSynced : totalAccessible;
  const label =
    totalSynced > 0
      ? `${String(displayCount)} repo${displayCount === 1 ? "" : "s"} synced`
      : `${String(displayCount)} repo${displayCount === 1 ? "" : "s"}`;

  if (totalAccessible === 0) {
    return (
      <div className="mt-2 px-2 py-1.5">
        <span className="text-xs text-sachi-fg-muted">No repos available</span>
      </div>
    );
  }

  const reposByOwner = new Map<string, typeof syncedRepos>();
  const targetRepos = totalSynced > 0 ? syncedRepos : [];
  for (const repo of targetRepos) {
    const existing = reposByOwner.get(repo.owner.login) ?? [];
    existing.push(repo);
    reposByOwner.set(repo.owner.login, existing);
  }

  return (
    <div className="mt-2">
      <Popover>
        <PopoverTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-sachi-fg hover:bg-sachi-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus">
          <span className="truncate">{label}</span>
          <IconChevronDownMedium
            className="size-4 shrink-0 text-sachi-fg-faint"
            aria-hidden="true"
          />
        </PopoverTrigger>

        <PopoverContent align="start" sideOffset={4} className="w-64 p-0">
          <PopoverHeader className="px-3 pt-2.5 pb-0">
            <PopoverTitle className="text-xs text-sachi-fg">
              Synced repos
            </PopoverTitle>
          </PopoverHeader>

          {totalSynced === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-sachi-fg-muted">
                No repos synced yet. All {String(totalAccessible)} accessible
                repos are shown.
              </p>
              <Link
                href="/setup/repos"
                className="mt-2 inline-block text-xs font-medium text-sachi-accent hover:underline"
              >
                Edit synced repos
              </Link>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              {installations.map((inst) => {
                const instRepos = reposByOwner.get(inst.account.login);
                if (!instRepos || instRepos.length === 0) return null;
                return (
                  <div key={inst.id}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <Avatar size="sm">
                        <AvatarImage
                          src={inst.account.avatar_url}
                          alt={inst.account.login}
                        />
                        <AvatarFallback>
                          {inst.account.login.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-sachi-fg">
                        {inst.account.login}
                      </span>
                    </div>
                    <ul>
                      {instRepos.map((repo) => (
                        <li key={repo.id}>
                          <Link
                            href={`/repo/${repo.owner.login}/${repo.name}`}
                            className="block px-3 py-1.5 text-xs text-sachi-fg-secondary transition-colors hover:bg-sachi-fill hover:text-sachi-fg"
                          >
                            {repo.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Separator />
                  </div>
                );
              })}
            </ScrollArea>
          )}

          <Separator />
          <div className="px-3 py-2">
            <Link
              href="/setup/repos"
              className="text-xs text-sachi-fg-muted transition-colors hover:text-sachi-fg"
            >
              Edit synced repos
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function useSidebarAnimation() {
  const params = useDialKit("Sidebar Animation", {
    duration: [0.25, 0.05, 1],
    ease: {
      x1: [0.25, 0, 1],
      y1: [0.1, 0, 1],
      x2: [0.25, 0, 1],
      y2: [1, 0, 1],
    },
  });
  const d = params.duration as number;
  const { x1, y1, x2, y2 } = params.ease as {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  return {
    "--sidebar-transition-fast": `${d * 0.4}s`,
    "--sidebar-transition-normal": `${d}s`,
    "--sidebar-ease": `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
  } as React.CSSProperties;
}

function getPageLabel(pathname: string): string | null {
  if (pathname === "/") return "Inbox";
  return null;
}

function useRouteRepoContext(): { owner: string; repo: string } | null {
  const pathname = usePathname();
  const match = pathname.match(/^\/repo\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]! };
}

function HeaderContent() {
  const pathname = usePathname();
  const routeRepo = useRouteRepoContext();
  const label = getPageLabel(pathname);

  if (routeRepo) {
    return (
      <span className="ml-3 text-sm text-sachi-fg">
        <span className="text-sachi-fg-muted">{routeRepo.owner}</span>
        <span className="text-sachi-fg-faint"> / </span>
        <span className="font-medium">{routeRepo.repo}</span>
      </span>
    );
  }

  if (label) {
    return (
      <span className="ml-3 text-sm font-medium text-sachi-fg">{label}</span>
    );
  }

  return null;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const animationStyle = useSidebarAnimation();
  const isHomePage = pathname === "/";

  return (
    <SidebarProvider
      className="h-dvh w-full bg-sachi-shell text-sachi-fg-secondary"
      style={animationStyle}
    >
      <Sidebar className="bg-sachi-sidebar">
        <SidebarHeader className="px-2.5">
          <SyncedReposSummary />
        </SidebarHeader>

        <SidebarContent className="px-2.5 pt-2 pb-3">
          <nav aria-label="Primary">
            <Link
              href="/"
              className={`flex rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus ${
                isHomePage
                  ? "bg-sachi-fill text-sachi-fg"
                  : "text-sachi-fg-secondary hover:bg-sachi-fill hover:text-sachi-fg"
              }`}
            >
              Home
            </Link>
          </nav>
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-sachi-surface">
        <header className="flex h-10 shrink-0 items-center border-b border-sachi-line-subtle bg-sachi-surface px-3">
          <SidebarTrigger layout="inline" />
          <HeaderContent />
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
