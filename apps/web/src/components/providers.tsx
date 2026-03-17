"use client";

import { Toaster } from "@sachikit/ui/components/sonner";
import { TooltipProvider } from "@sachikit/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import type { ReactNode } from "react";

import { TRPCProvider, makeTRPCClient } from "~/lib/trpc/client";
import { makeQueryClient } from "~/lib/trpc/query-client";

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() => makeTRPCClient());

  return (
    <NuqsAdapter>
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
    </NuqsAdapter>
  );
}
