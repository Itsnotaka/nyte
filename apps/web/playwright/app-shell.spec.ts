import { expect, test } from "@playwright/test";

test("protected shell renders", async ({ page }) => {
  await page.goto("/setup");

  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Inbox" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Install the GitHub App|Select repositories/ }),
  ).toBeVisible();
});

test("merging compare page renders both probes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/compare/merging");

  await expect(page.getByRole("heading", { name: "REST vs GraphQL probe" })).toBeVisible();

  const rest = page.locator('[data-source="rest"]');
  const gql = page.locator('[data-source="graphql"]');

  await expect(rest).toBeVisible({ timeout: 60_000 });
  await expect(gql).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => rest.getAttribute("data-ready"), { timeout: 60_000 }).toBe("true");
  await expect.poll(() => gql.getAttribute("data-ready"), { timeout: 60_000 }).toBe("true");
  await expect(rest).toContainText("Fetched PRs");
  await expect(gql).toContainText("Fetched PRs");
});

test("inbox selection stays mounted", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto("/");

  const row = page.locator('a[href^="/?pr="]').first();
  await expect(row).toBeVisible({ timeout: 60_000 });

  const href = await row.getAttribute("href");
  expect(href).toBeTruthy();
  const pr = new URL(href ?? "/", "http://localhost:3000").searchParams.get("pr");
  expect(pr).toBeTruthy();
  const [owner, repo, raw] = pr?.split("/") ?? [];
  expect(owner).toBeTruthy();
  expect(repo).toBeTruthy();
  expect(raw).toBeTruthy();

  await row.click();
  await expect(page.getByRole("button", { name: "Back to inbox" })).toBeVisible();
  await expect(row).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("pr")).toBe(pr);

  await page.goBack();
  await expect(page.getByRole("button", { name: "Back to inbox" })).toBeHidden();
  await expect(row).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("pr")).toBe(null);

  await row.click();
  await expect(page.getByRole("button", { name: "Back to inbox" })).toBeVisible();
  await page.getByRole("link", { name: "Inbox" }).click();
  await expect(page.getByRole("button", { name: "Back to inbox" })).toBeHidden();
  await expect(row).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("pr")).toBe(null);

  await page.goto(`/repo/${owner}/${repo}/pull/${raw}`);
  await expect(page).toHaveURL(new RegExp(`/repo/${owner}/${repo}/pull/${raw}$`));
  await expect(page.getByRole("button", { name: "Back to inbox" })).toHaveCount(0);
  await expect(
    page
      .locator("header")
      .filter({ hasText: `#${raw}` })
      .first(),
  ).toBeVisible();
});
