"use client";

import { IconChevronDownMedium } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@sachikit/ui/components/collapsible";
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
import * as React from "react";

import { useRepo } from "./_components/repo-context";

type AppShellProps = {
  children: React.ReactNode;
};

function NavItem({
  href,
  children,
  isActive,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  isActive: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus ${
        isActive
          ? "bg-sachi-fill text-sachi-fg"
          : "text-sachi-fg-secondary hover:bg-sachi-fill hover:text-sachi-fg"
      }`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}

function RepoNavGroup({
  repo,
  pathname,
}: {
  repo: { id: number; name: string; owner: { login: string } };
  pathname: string;
}) {
  const repoBasePath = `/repo/${repo.owner.login}/${repo.name}`;
  const isInRepo = pathname.startsWith(repoBasePath);
  const isCodeActive =
    pathname === repoBasePath ||
    pathname.startsWith(`${repoBasePath}/tree`) ||
    pathname.startsWith(`${repoBasePath}/blob`);
  const isPullsActive = pathname.startsWith(`${repoBasePath}/pull`);

  return (
    <Collapsible open={isInRepo}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-sachi-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus">
        <span className="truncate font-medium text-sachi-fg">{repo.name}</span>
        <IconChevronDownMedium
          className={`size-4 shrink-0 text-sachi-fg-faint transition-transform ${isInRepo ? "" : "-rotate-90"}`}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-2">
        <ul className="border-l border-sachi-line-subtle pt-1 pl-2">
          <li>
            <NavItem href={repoBasePath} isActive={isCodeActive}>
              Code
            </NavItem>
          </li>
          <li>
            <NavItem href={`${repoBasePath}/pulls`} isActive={isPullsActive}>
              Pull requests
            </NavItem>
          </li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarNav() {
  const pathname = usePathname();
  const { syncedRepos, totalSynced } = useRepo();

  const isInboxActive = pathname === "/";

  return (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <ul className="space-y-0.5">
        <li>
          <NavItem href="/" isActive={isInboxActive}>
            Inbox
          </NavItem>
        </li>
      </ul>

      {totalSynced > 0 && (
        <div className="mt-6">
          <div className="mb-2 px-2 text-xs font-medium tracking-wide text-sachi-fg-muted uppercase">
            Repositories
          </div>
          <ul className="space-y-1">
            {syncedRepos.map((repo) => (
              <li key={repo.id}>
                <RepoNavGroup repo={repo} pathname={pathname} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-4">
        <Link
          href="/setup/repos"
          className="block px-2 py-1.5 text-xs text-sachi-fg-muted transition-colors hover:text-sachi-fg"
        >
          {totalSynced === 0 ? "Sync repos" : "Edit synced repos"}
        </Link>
      </div>
    </nav>
  );
}

const EASE_PRESETS: Record<string, string> = {
  "ease-out": "cubic-bezier(0, 0, 0.58, 1)",
  "ease-out-cubic": "cubic-bezier(0.215, 0.61, 0.355, 1)",
  "ease-in-out": "cubic-bezier(0.42, 0, 0.58, 1)",
};

function useSidebarAnimation() {
  const params = useDialKit("Sidebar Animation", {
    duration: [0.25, 0.05, 1],
    preset: {
      type: "select",
      options: ["ease-out", "ease-out-cubic", "ease-in-out", "custom"],
      default: "ease-out-cubic",
    },
    ease: {
      _collapsed: true,
      x1: [0.25, 0, 1],
      y1: [0.1, 0, 1],
      x2: [0.25, 0, 1],
      y2: [1, 0, 1],
    },
  });
  const d = params.duration as number;
  const preset = params.preset as string;
  const { x1, y1, x2, y2 } = params.ease as {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  const easeValue =
    preset === "custom"
      ? `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`
      : (EASE_PRESETS[preset] ?? EASE_PRESETS["ease-out-cubic"]);
  return {
    "--sidebar-transition-fast": `${d * 0.4}s`,
    "--sidebar-transition-normal": `${d}s`,
    "--sidebar-ease": easeValue,
  } as React.CSSProperties;
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

  if (routeRepo) {
    return (
      <span className="ml-3 text-sm text-sachi-fg">
        <span className="text-sachi-fg-muted">{routeRepo.owner}</span>
        <span className="text-sachi-fg-faint"> / </span>
        <span className="font-medium">{routeRepo.repo}</span>
      </span>
    );
  }

  if (pathname === "/") {
    return (
      <span className="ml-3 text-sm font-medium text-sachi-fg">Inbox</span>
    );
  }

  return null;
}

export function AppShell({ children }: AppShellProps) {
  const animationStyle = useSidebarAnimation();

  return (
    <SidebarProvider
      className="h-dvh w-full bg-sachi-shell text-sachi-fg-secondary"
      style={animationStyle}
    >
      <Sidebar className="bg-sachi-sidebar">
        <SidebarHeader className="h-10 px-2.5" />

        <SidebarContent className="px-2.5 pt-2 pb-3">
          <SidebarNav />
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="flex flex-col overflow-hidden bg-sachi-surface">
        <header className="flex h-10 shrink-0 items-center border-b border-sachi-line-subtle bg-sachi-surface px-3">
          <SidebarTrigger layout="inline" />
          <HeaderContent />
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
