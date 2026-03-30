"use client";

import { createTRPCClient, httpBatchLink, httpLink, splitLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "./root";

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

const trpc = createTRPCContext<AppRouter>();
export const TRPCProvider = trpc.TRPCProvider;
export const useTRPC = trpc.useTRPC;

export function makeTRPCClient() {
  const url = `${getBaseUrl()}/api/trpc`;
  const headers = () => ({ "x-trpc-source": "nextjs-react" });

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition(op) {
          return Boolean(op.context.skipBatch);
        },
        true: httpLink({
          url,
          transformer: superjson,
          headers,
        }),
        false: httpBatchLink({
          url,
          transformer: superjson,
          headers,
          maxURLLength: 2083,
          maxItems: 10,
        }),
      }),
    ],
  });
}
