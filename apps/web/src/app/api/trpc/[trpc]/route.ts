import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "~/lib/trpc/root";
import { createTRPCContext } from "~/lib/trpc/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: ({ req }) => createTRPCContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
