"use client";

import { IconChevronDownMedium } from "@central-icons-react/round-filled-radius-2-stroke-1.5";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@nyte/ui/components/sidebar";

type AppShellProps = {
  sidebarHeader?: React.ReactNode;
  sidebarNav?: React.ReactNode;
  children: React.ReactNode;
};

function WorkspaceSelector() {
  return (
    <div className="mt-2 flex h-10 items-center justify-end">
      <button
        type="button"
        aria-label="Toggle sidebar dropdown"
        className="inline-flex size-6.5 items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-[var(--color-text-faint)] hover:bg-[var(--color-sidebar-link-bg)] hover:text-[var(--color-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-1"
      >
        <IconChevronDownMedium className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AppShell({
  sidebarHeader,
  sidebarNav,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider className="h-dvh w-full bg-[var(--color-shell-bg)] text-[var(--color-text-secondary)]">
      <Sidebar className="bg-[var(--color-sidebar-bg)]">
        <SidebarHeader className="px-2.5">
          {sidebarHeader ?? <WorkspaceSelector />}
        </SidebarHeader>

        <SidebarContent className="px-2.5 pb-3 pt-2">
          {sidebarNav}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-[var(--color-main-bg)]">
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
