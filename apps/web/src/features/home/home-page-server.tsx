import { headers } from "next/headers";

import { auth } from "~/lib/auth";
import { HomeLanding } from "./home-landing";
import { NyteWorkspaceClient } from "./nyte-workspace-client";

export async function HomePageServer() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    return <HomeLanding />;
  }

  return <NyteWorkspaceClient initialConnected />;
}
