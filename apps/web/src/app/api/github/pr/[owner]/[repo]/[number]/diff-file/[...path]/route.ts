import { getPullRequestDiffFileData } from "~/lib/github/pull-request";

type Params = {
  owner: unknown;
  repo: unknown;
  number: unknown;
  path: unknown;
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

function decodePart(value: string): string | null {
  if (!/%[0-9a-fA-F]{2}/.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function path(value: unknown): string | null {
  const parts = Array.isArray(value) ? value : typeof value === "string" ? [value] : null;
  if (!parts || parts.length === 0) return null;

  const out: string[] = [];
  for (const part of parts) {
    if (typeof part !== "string" || part.length === 0) return null;
    const decoded = decodePart(part);
    if (!decoded) return null;
    out.push(decoded);
  }

  return out.join("/");
}

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { owner, repo, number, path: rawPath } = await params;
  const o = str(owner);
  const r = str(repo);
  const pullNumber = num(number);
  const filePath = path(rawPath);

  const url = new URL(request.url);
  const baseSha = ref(url.searchParams.get("baseSha"));
  const headSha = ref(url.searchParams.get("headSha"));

  if (!o || !r || pullNumber == null || !baseSha || !headSha || !filePath) {
    return bad();
  }

  const data = await getPullRequestDiffFileData(o, r, pullNumber, baseSha, headSha, filePath);
  if (!data) {
    return notFound();
  }

  return Response.json(data, { headers: { "Cache-Control": cache } });
}
