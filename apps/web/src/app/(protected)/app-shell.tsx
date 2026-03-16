"use client";

import {
  IconCheckmark2Small,
  IconChevronDownMedium,
} from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sachikit/ui/components/dropdown-menu";
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
        <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium text-sachi-fg hover:bg-sachi-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus">
          <span className="truncate">{selectedRepo ? selectedRepo.name : "Select repo"}</span>
          <IconChevronDownMedium
            className="size-4 shrink-0 text-sachi-fg-faint"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={4}>
          <DropdownMenuGroup>
            {repos.map((repo) => (
              <DropdownMenuItem
                key={repo.id}
                onSelect={() => setSelectedRepo(repo)}
                className="flex items-center justify-between gap-2"
              >
                <span className="truncate">{repo.name}</span>
                {selectedRepo?.id === repo.id ? (
                  <IconCheckmark2Small className="size-4 shrink-0 text-sachi-fg-muted" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
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

function HeaderLabel({ pathname }: { pathname: string }) {
  const label = getPageLabel(pathname);
  if (!label) return null;
  return <span className="ml-3 text-sm font-medium text-sachi-fg">{label}</span>;
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
          <RepoSelector />
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
          <HeaderLabel pathname={pathname} />
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
