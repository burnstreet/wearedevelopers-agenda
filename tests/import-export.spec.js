// @ts-check
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw new Error("Uncaught page error: " + err.message);
  });
});

test("export/import buttons are visible and enabled", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#exportButton")).toBeVisible();
  await expect(page.locator("#exportButton")).toBeEnabled();
  await expect(page.locator("#importButton")).toBeVisible();
  await expect(page.locator("#importButton")).toBeEnabled();
});

test("exporting downloads a JSON file containing the current favorites", async ({ page }) => {
  await page.goto("/index.html");

  const card = page.locator(".session-card").first();
  await card.locator("[data-favorite-id]").click();
  const favoriteId = await page.evaluate(() => [...state.favorites][0]);
  expect(favoriteId).toBeDefined();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#exportButton").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("wad2026-preferences.json");

  const path = await download.path();
  const fs = require("fs");
  const contents = JSON.parse(fs.readFileSync(path, "utf8"));
  expect(contents.favorites).toContain(favoriteId);
  expect(contents.version).toBe(1);
});

test("importing a JSON file restores favorites/booked/hidden/planned and re-renders", async ({ page }) => {
  await page.goto("/index.html");

  const sessionIds = await page.evaluate(() => state.sessions.slice(0, 4).map((s) => s.id));
  const payload = {
    version: 1,
    favorites: [sessionIds[0]],
    booked: [],
    hidden: [],
    planned: [sessionIds[1]]
  };

  const buffer = Buffer.from(JSON.stringify(payload));
  await page.locator("#importFileInput").setInputFiles({
    name: "wad2026-preferences.json",
    mimeType: "application/json",
    buffer
  });

  await expect(page.locator("#preferenceStatus")).toHaveText(/Imported/);

  const restored = await page.evaluate(() => ({
    favorites: [...state.favorites],
    planned: [...state.planned]
  }));
  expect(restored.favorites).toContain(sessionIds[0]);
  expect(restored.planned).toContain(sessionIds[1]);

  await expect(
    page.locator(`.session-card[data-session-id="${sessionIds[0]}"] .favorite-button`).first()
  ).toHaveAttribute("aria-pressed", "true");
});

test("importing an invalid file shows an import failed message", async ({ page }) => {
  await page.goto("/index.html");

  await page.locator("#importFileInput").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("not valid json")
  });

  await expect(page.locator("#preferenceStatus")).toHaveText(/Import failed/);
});
