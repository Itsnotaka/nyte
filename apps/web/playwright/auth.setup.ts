import { existsSync, mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { authFile, syncNextBrowserCookies } from "./auth.js";

const refresh = process.env.PW_AUTH_REFRESH === "1";

mkdirSync("playwright/.auth", { recursive: true });
test.setTimeout(15 * 60 * 1000);

test("bootstrap auth state", async ({ page }) => {
  if (existsSync(authFile) && !refresh) {
    syncNextBrowserCookies();
    return;
  }

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Sachi" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in with GitHub" }).click();

  // Finish GitHub auth in the headed browser window, then we save the local app session.
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible({
    timeout: 15 * 60 * 1000,
  });
  await page.context().storageState({ path: authFile });
  syncNextBrowserCookies();
});
