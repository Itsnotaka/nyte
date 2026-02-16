import {
  addWatchKeyword,
  listWatchKeywords,
  PolicyRuleError,
  removeWatchKeyword,
} from "@/lib/server/policy-rules";

type PolicyRuleBody = {
  keyword?: string;
};

export async function GET() {
  const keywords = await listWatchKeywords();
  return Response.json({ watchKeywords: keywords });
}

export async function POST(request: Request) {
  const body = (await request.json()) as PolicyRuleBody;
  if (!body.keyword) {
    return Response.json({ error: "keyword is required." }, { status: 400 });
  }

  try {
    const keyword = await addWatchKeyword(body.keyword, new Date());
    return Response.json({ keyword });
  } catch (error) {
    if (error instanceof PolicyRuleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to save watch rule." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as PolicyRuleBody;
  if (!body.keyword) {
    return Response.json({ error: "keyword is required." }, { status: 400 });
  }

  try {
    const keyword = await removeWatchKeyword(body.keyword);
    return Response.json({ keyword });
  } catch (error) {
    if (error instanceof PolicyRuleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return Response.json({ error: "Failed to remove watch rule." }, { status: 500 });
  }
}
