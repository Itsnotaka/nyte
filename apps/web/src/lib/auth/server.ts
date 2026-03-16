import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { auth } from ".";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function isAuthenticated() {
  const session = await getSession();
  return session !== null;
}

export { auth };
