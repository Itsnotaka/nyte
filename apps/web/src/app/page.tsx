import { headers } from "next/headers";

import { ApprovalQueueWorkspace } from "~/components/approval-queue-workspace";
import { QueueLandingView } from "~/components/queue-landing-view";
import { auth } from "~/lib/auth";

export default async function Page() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    return <QueueLandingView />;
  }

  return <ApprovalQueueWorkspace />;
}
