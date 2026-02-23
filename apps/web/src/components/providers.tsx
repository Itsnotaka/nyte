"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Toaster } from "@nyte/ui/components/sonner";
import { TooltipProvider } from "@nyte/ui/components/tooltip";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

import { authClient } from "~/lib/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");
}
const convex = new ConvexReactClient(convexUrl);

export function Providers({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const authProviderProps = initialToken ? { initialToken } : {};

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      {...authProviderProps}
    >
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
    </ConvexBetterAuthProvider>
  );
}
