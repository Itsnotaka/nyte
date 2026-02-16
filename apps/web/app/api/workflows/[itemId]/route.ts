import { getWorkflowTimeline } from "@/lib/server/workflow-log";
import { AuthorizationError, requireAuthorizedSession } from "@/lib/server/authz";

type Params = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    await requireAuthorizedSession(request);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  const { itemId } = await params;
  const timeline = await getWorkflowTimeline(itemId);
  return Response.json({
    itemId,
    timeline,
  });
}
