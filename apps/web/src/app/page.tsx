import { headers } from "next/headers";

import { auth } from "~/lib/auth";
import { Landing } from "~/components/landing";
import { Workspace } from "~/components/workspace";

export default async function Page() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return <Landing />;
  }

  return <Workspace />;
}
