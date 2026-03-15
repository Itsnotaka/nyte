"use client";

import { Toaster } from "@nyte/ui/components/sonner";
import { TooltipProvider } from "@nyte/ui/components/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useState } from "react";
import type { ReactNode } from "react";

import { trpc, trpcClient } from "~/lib/trpc/client";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </trpc.Provider>
  );
}
