import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from ".";

export const getUserSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export { auth };
