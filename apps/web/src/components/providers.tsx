"use client";

import { Toaster } from "@sachikit/ui/components/sonner";
import { TooltipProvider } from "@sachikit/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

import { createQueryClient } from "~/lib/trpc/query-client";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = createQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        disableTransitionOnChange
        enableColorScheme
      >
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
