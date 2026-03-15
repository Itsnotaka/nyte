import { GitHubError } from "./types.ts";

const GITHUB_API = "https://api.github.com";

function errorCodeFromStatus(status: number): GitHubError["code"] {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "unknown";
}

export async function githubFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GitHubError(
      body || `GitHub API error: ${res.status}`,
      res.status,
      errorCodeFromStatus(res.status)
    );
  }

  return res.json() as Promise<T>;
}
