import { ApprovalError, approveWorkItem } from "@/lib/server/approve-action";

type ApproveBody = {
  itemId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ApproveBody;
  if (!body.itemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }

  try {
    const result = await approveWorkItem(body.itemId, new Date());
    return Response.json(result);
  } catch (error) {
    if (error instanceof ApprovalError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    return Response.json({ error: "Failed to approve work item." }, { status: 500 });
  }
}
