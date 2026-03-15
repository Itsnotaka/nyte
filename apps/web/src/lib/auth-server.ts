import "server-only";
import { headers } from "next/headers";

import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function isAuthenticated() {
  const session = await getSession();
  return session !== null;
}

export { auth };
