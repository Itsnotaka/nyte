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

type AppShellClientProps = {
  children: React.ReactNode;
  interfaceTheme: "light" | "dark";
};

export const AppShellClient = ({ children, interfaceTheme }: AppShellClientProps) => {
  const shellStyle =
    interfaceTheme === "light"
      ? {
          "--sidebar-hover-overlay-bg": "rgba(0, 0, 0, 0.275)",
          "--sidebar-hover-overlay-opacity": "1",
        }
      : {
          "--sidebar-hover-overlay-bg": "rgba(0, 0, 0, 0.6)",
          "--sidebar-hover-overlay-opacity": "1",
        };

  return (
    <SidebarProvider
      data-theme={interfaceTheme}
      className="h-dvh w-full bg-[var(--color-shell-bg)] text-[var(--color-text-secondary)]"
      style={shellStyle as React.CSSProperties}
    >
      <Sidebar className="bg-[var(--color-sidebar-bg)]">
        <SidebarHeader className="px-[10px]">
          <div className="mt-[8px] flex h-10 items-center justify-end">
            <button
              type="button"
              aria-label="Toggle sidebar dropdown"
              className="inline-flex size-6.5 items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-[var(--color-text-faint)] hover:bg-[var(--color-sidebar-link-bg)] hover:text-[var(--color-text-secondary)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-1"
            >
              <IconChevronDownMedium className="size-4" aria-hidden="true" />
            </button>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-[10px] pb-[12px] pt-[8px]">
          <nav aria-label="Sidebar" />
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-[var(--color-main-bg)]">
        <SidebarTrigger />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};
