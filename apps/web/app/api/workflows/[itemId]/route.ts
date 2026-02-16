import { getWorkflowTimeline } from "@/lib/server/workflow-log";

type Params = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { itemId } = await params;
  const timeline = await getWorkflowTimeline(itemId);
  return Response.json({
    itemId,
    timeline,
  });
}
