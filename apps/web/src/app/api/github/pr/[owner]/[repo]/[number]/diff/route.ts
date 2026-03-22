import { getPullRequestDiffSummaryData } from "~/lib/github/pull-request";

type Params = {
  owner: unknown;
  repo: unknown;
  number: unknown;
};

const cache = "private, max-age=28800, immutable";
const sha = /^[0-9a-f]{40}$/i;

function bad() {
  return Response.json({ error: "bad_request" }, { status: 400 });
}

function notFound() {
  return Response.json({ error: "not_found" }, { status: 404 });
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

function ref(value: string | null): string | null {
  return value && sha.test(value) ? value : null;
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { owner, repo, number } = await params;
  const o = str(owner);
  const r = str(repo);
  const pullNumber = num(number);

  const url = new URL(request.url);
  const baseSha = ref(url.searchParams.get("baseSha"));
  const headSha = ref(url.searchParams.get("headSha"));

  if (!o || !r || pullNumber == null || !baseSha || !headSha) {
    return bad();
  }

  const data = await getPullRequestDiffSummaryData(o, r, pullNumber, baseSha, headSha);
  if (!data) {
    return notFound();
  }

  return Response.json(data, { headers: { "Cache-Control": cache } });
}
