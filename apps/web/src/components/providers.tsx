"use client";

import { Toaster } from "@nyte/ui/components/sonner";
import { TooltipProvider } from "@nyte/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import * as React from "react";

import type { AppRouter } from "~/lib/server/router";
import { TRPCProvider } from "~/lib/trpc";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = React.useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc" })],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <NextThemesProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableColorScheme
        >
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </NextThemesProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
