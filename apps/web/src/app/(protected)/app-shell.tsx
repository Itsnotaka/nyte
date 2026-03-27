"use client";

import { Button } from "@sachikit/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@sachikit/ui/components/sidebar";
import { Spinner } from "@sachikit/ui/components/spinner";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "~/lib/auth/client";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const onSetup = pathname.startsWith("/setup");
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) {
      return;
    }

    setSigningOut(true);
    const { error } = await authClient.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }

    router.replace("/login");
  }

  return (
    <SidebarProvider
      defaultOpen
      className="h-svh min-h-0 w-full overflow-hidden bg-sachi-shell text-sachi-foreground-secondary"
    >
      <Sidebar className="bg-sachi-sidebar">
        <SidebarContent className="px-2.5 pt-3 pb-3" />
      </Sidebar>

      <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-sachi-surface">
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <SidebarTrigger layout="inline" />
            <Link
              href="/"
              className="truncate text-sm font-semibold tracking-tight text-sachi-foreground"
            >
              Sachi
            </Link>
          </div>
          <nav className="flex shrink-0 items-center gap-4" aria-label="Account">
            {!onSetup ? (
              <Link
                href="/setup"
                className="text-xs font-medium text-sachi-foreground-muted transition-colors hover:text-sachi-foreground"
              >
                Setup
              </Link>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-busy={signingOut}
              disabled={signingOut}
              className="gap-1.5 text-sachi-foreground-muted hover:text-sachi-foreground"
              onClick={() => {
                void handleSignOut();
              }}
            >
              {signingOut ? (
                <>
                  <Spinner className="size-3" />
                  Signing out…
                </>
              ) : (
                "Sign out"
              )}
            </Button>
          </nav>
        </header>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
