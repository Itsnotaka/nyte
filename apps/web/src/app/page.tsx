import { headers } from "next/headers";

import { NyteWorkspaceClient } from "~/components/nyte-workspace-client";
import { auth } from "~/lib/auth";

export default async function Page() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  return <NyteWorkspaceClient initialConnected={Boolean(session)} />;
}
