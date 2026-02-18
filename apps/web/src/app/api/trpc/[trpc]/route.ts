import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "~/lib/server/context";
import { appRouter } from "~/lib/server/router";

const handler = (request: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: ({ req }) => createContext(req),
  });

export { handler as GET, handler as POST };
