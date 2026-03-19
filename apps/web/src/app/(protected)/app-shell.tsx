"use client";

import { IconBox2 } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@sachikit/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTRPC } from "~/lib/trpc/react";

type AppShellProps = {
  children: React.ReactNode;
};

function SidebarNav() {
  const pathname = usePathname();
  const isInboxActive = pathname === "/";

  return (
    <nav aria-label="Primary">
      <ul className="space-y-0.5">
        <li>
          <Link
            href="/"
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sachi-focus`}
          >
            <IconBox2 className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Inbox</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function SidebarTopBar() {
  const trpc = useTRPC();
  const syncedSummaryQuery = useQuery(
    trpc.github.getSyncedRepoSummary.queryOptions(undefined, {
      staleTime: 60_000,
    }),
  );
  const totalSynced = syncedSummaryQuery.data?.totalSynced;
  const repoCta = totalSynced == null ? "Repos" : totalSynced === 0 ? "Sync repos" : "Edit repos";

  return (
    <div className="flex h-full items-center justify-between px-2.5">
      <span className="text-sm font-medium text-sachi-fg">Inbox</span>
      <Link
        href="/setup/repos"
        className="text-xs text-sachi-fg-muted transition-colors hover:text-sachi-fg"
      >
        {repoCta}
      </Link>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider open={true} className="h-dvh w-full bg-sachi-shell text-sachi-fg-secondary">
      <Sidebar className="bg-sachi-sidebar">
        <SidebarHeader className="h-10 border-b border-sachi-line-subtle">
          <SidebarTopBar />
        </SidebarHeader>

        <SidebarContent className="px-2.5 pt-2 pb-3">
          <SidebarNav />
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex flex-col overflow-hidden bg-sachi-surface">
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
