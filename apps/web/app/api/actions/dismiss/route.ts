import { dismissWorkItem, DismissError } from "@/lib/server/dismiss-action";

type DismissBody = {
  itemId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as DismissBody;
  if (!body.itemId) {
    return Response.json({ error: "itemId is required." }, { status: 400 });
  }

  try {
    const result = await dismissWorkItem(body.itemId, new Date());
    return Response.json(result);
  } catch (error) {
    if (error instanceof DismissError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    return Response.json({ error: "Failed to dismiss work item." }, { status: 500 });
  }
}
