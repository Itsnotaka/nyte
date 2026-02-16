import {
  addWatchKeyword,
  listWatchKeywords,
  PolicyRuleError,
  removeWatchKeyword,
} from "@/lib/server/policy-rules";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";

type PolicyRuleBody = {
  keyword?: string;
};

export async function GET() {
  const keywords = await listWatchKeywords();
  return Response.json({ watchKeywords: keywords });
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "policy-rules:mutate", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
  }

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
  try {
    enforceRateLimit(request, "policy-rules:mutate", {
      limit: 20,
      windowMs: 60_000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }
  }

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
