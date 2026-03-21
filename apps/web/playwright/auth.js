import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

export const authFile = "playwright/.auth/user.json";
export const cookieFile = "playwright/.auth/next-browser.json";

function matches(domain, host) {
  const raw = domain.startsWith(".") ? domain.slice(1) : domain;
  return host === raw || host.endsWith(`.${raw}`);
}

export function syncNextBrowserCookies(url = "http://localhost:3000") {
  if (!existsSync(authFile)) {
    throw new Error(`missing auth state at ${authFile}; run playwright:setup first`);
  }

  const host = new URL(url).hostname;
  const state = JSON.parse(readFileSync(authFile, "utf8"));
  const cookies = (state.cookies ?? [])
    .filter((cookie) => matches(cookie.domain, host))
    .map((cookie) => ({ name: cookie.name, value: cookie.value }));

  if (cookies.length === 0) {
    throw new Error(`no cookies in ${authFile} match ${host}`);
  }

  mkdirSync(dirname(cookieFile), { recursive: true });
  writeFileSync(cookieFile, `${JSON.stringify(cookies, null, 2)}\n`);
  return { count: cookies.length, file: cookieFile, host };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = syncNextBrowserCookies(process.argv[2]);
  console.log(`synced ${out.count} cookies → ${out.file} (${out.host})`);
}
