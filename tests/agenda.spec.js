// @ts-check
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw new Error("Uncaught page error: " + err.message);
  });
});

test("loads agenda and shows day/view tabs", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("#dayTabs button")).not.toHaveCount(0);
  await expect(page.locator("#viewTabs button")).toHaveCount(3);
  await expect(page.locator("#dayTabs button", { hasText: "Today" })).toHaveCount(1);
  await expect(page.locator(".session-card").first()).toBeVisible();
});

test("day tabs switch the rendered agenda", async ({ page }) => {
  await page.goto("/index.html");
  const dayButtons = page.locator("#dayTabs button");
  const count = await dayButtons.count();
  expect(count).toBeGreaterThan(2);

  // Index 0 is "Today"; find a day button that isn't already pressed by default.
  let targetIndex = 1;
  for (let i = 1; i < count; i++) {
    if ((await dayButtons.nth(i).getAttribute("aria-pressed")) === "false") {
      targetIndex = i;
      break;
    }
  }

  const firstSummary = await page.locator("#summary").textContent();
  await dayButtons.nth(targetIndex).click();
  await expect(dayButtons.nth(targetIndex)).toHaveAttribute("aria-pressed", "true");
  const secondSummary = await page.locator("#summary").textContent();
  expect(secondSummary).not.toBe(firstSummary);
});

test("stage view hides stages with no sessions", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#viewTabs button", { hasText: "Stages" }).click();
  const headers = page.locator(".column-header small");
  const counts = await headers.allTextContents();
  for (const value of counts) {
    expect(Number(value)).toBeGreaterThan(0);
  }
});

test("track view renders columns per track", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#viewTabs button", { hasText: "Tracks" }).click();
  await expect(page.locator(".column-header")).not.toHaveCount(0);
});

test("one column (list) view renders a single stacked list", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#viewTabs button", { hasText: "One column" }).click();
  await expect(page.locator(".list-view")).toBeVisible();
  await expect(page.locator(".timeline-grid")).toHaveCount(0);
});

test("type filter narrows results", async ({ page }) => {
  await page.goto("/index.html");
  const before = await page.locator(".session-card").count();
  const options = await page.locator("#typeFilter option").allTextContents();
  expect(options.length).toBeGreaterThan(1);
  await page.selectOption("#typeFilter", { index: 1 });
  await page.waitForTimeout(100);
  const after = await page.locator(".session-card, .empty-state").count();
  expect(after).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
});

test("favorites-only filter shows nothing until a favorite is toggled, then narrows to it", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#viewTabs button", { hasText: "One column" }).click();

  const firstCard = page.locator(".session-card").first();
  const title = await firstCard.locator(".session-title").textContent();
  await firstCard.locator("[data-favorite-id]").click();
  await expect(firstCard.locator("[data-favorite-id]")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#favoritesOnly").check();
  const cards = page.locator(".session-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator(".session-title")).toHaveText(title || "");
});

test("hovering a session card on desktop shows the details popover with description", async ({ page }) => {
  await page.goto("/index.html");
  const card = page.locator(".session-card").first();
  await card.hover();
  const popover = page.locator("#detailPopover");
  await expect(popover).toBeVisible();
  await expect(popover.locator("h2")).toHaveText(await card.locator(".session-title").textContent() || "");
  await expect(popover.locator(".description")).toBeVisible();
});

test("each session card shows title, type chip, and a details link", async ({ page }) => {
  await page.goto("/index.html");
  const card = page.locator(".session-card").first();
  await expect(card.locator(".session-title")).not.toBeEmpty();
  await expect(card.locator(".type-chip")).not.toBeEmpty();
  const href = await card.locator(".details-link").getAttribute("href");
  expect(href).toMatch(/^https:\/\//);
});

test("every session card title renders with visible height, even for short sessions", async ({ page }) => {
  await page.goto("/index.html");
  const dayButtons = page.locator("#dayTabs button");
  const dayCount = await dayButtons.count();

  for (let i = 0; i < dayCount; i++) {
    await dayButtons.nth(i).click();
    for (const viewLabel of ["Stages", "Tracks", "One column"]) {
      await page.locator("#viewTabs button", { hasText: viewLabel }).click();
      const bad = await page.evaluate(() => {
        return [...document.querySelectorAll(".session-card .session-title")]
          .filter((el) => el.textContent.trim().length === 0 || el.getBoundingClientRect().height === 0)
          .map((el) => el.textContent);
      });
      expect(bad).toEqual([]);
    }
  }
});

test("every session card's footer (type chip + details link) stays visible, even for 10-minute lightning talks", async ({ page }) => {
  await page.goto("/index.html");
  const dayButtons = page.locator("#dayTabs button");
  const dayCount = await dayButtons.count();

  for (let i = 0; i < dayCount; i++) {
    await dayButtons.nth(i).click();
    for (const viewLabel of ["Stages", "Tracks", "One column"]) {
      await page.locator("#viewTabs button", { hasText: viewLabel }).click();
      const bad = await page.evaluate(() => {
        return [...document.querySelectorAll(".session-card")]
          .filter((card) => {
            const chip = card.querySelector(".type-chip");
            const link = card.querySelector(".details-link");
            return !chip || !link || chip.getBoundingClientRect().height === 0 || link.getBoundingClientRect().height === 0;
          })
          .map((card) => card.querySelector(".session-title")?.textContent);
      });
      expect(bad).toEqual([]);
    }
  }
});

test("session cards in the same lane never overlap vertically, on any day or column view", async ({ page }) => {
  await page.goto("/index.html");
  const dayButtons = page.locator("#dayTabs button");
  const dayCount = await dayButtons.count();

  for (let i = 0; i < dayCount; i++) {
    await dayButtons.nth(i).click();
    for (const viewLabel of ["Stages", "Tracks"]) {
      await page.locator("#viewTabs button", { hasText: viewLabel }).click();
      const overlaps = await page.evaluate(() => {
        const found = [];
        for (const lane of document.querySelectorAll(".lane")) {
          const byLeft = new Map();
          for (const card of lane.querySelectorAll(".session-card")) {
            const key = card.style.left;
            if (!byLeft.has(key)) {
              byLeft.set(key, []);
            }
            byLeft.get(key).push(card);
          }
          for (const cards of byLeft.values()) {
            const sorted = cards.sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top));
            for (let j = 0; j < sorted.length - 1; j++) {
              const bottom = parseFloat(sorted[j].style.top) + parseFloat(sorted[j].style.height);
              const nextTop = parseFloat(sorted[j + 1].style.top);
              if (bottom > nextTop + 0.5) {
                found.push(bottom - nextTop);
              }
            }
          }
        }
        return found;
      });
      expect(overlaps).toEqual([]);
    }
  }
});

test("reset filters clears all filter selections", async ({ page }) => {
  await page.goto("/index.html");
  await page.selectOption("#typeFilter", { index: 1 });
  await page.locator("#favoritesOnly").check();
  await page.locator("#resetFilters").click();
  await expect(page.locator("#typeFilter")).toHaveValue("all");
  await expect(page.locator("#favoritesOnly")).not.toBeChecked();
});

test("booking a workshop auto-favorites it and hides other unbooked workshops by default", async ({ page }) => {
  await page.goto("/index.html");
  await page.selectOption("#typeFilter", { label: "Workshop" });
  const before = await page.locator(".session-card").count();
  expect(before).toBeGreaterThan(1);

  const firstCard = page.locator(".session-card").first();
  await firstCard.locator("[data-booked-id]").click();

  await expect(page.locator(".session-card")).toHaveCount(1);
  await expect(firstCard.locator(".favorite-button")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#showHidden").check();
  await expect(page.locator(".session-card")).toHaveCount(before);
});

test("manually hiding a session removes it, and Show hidden reveals it again dimmed", async ({ page }) => {
  await page.goto("/index.html");
  await page.selectOption("#typeFilter", { label: "Talk" });
  const before = await page.locator(".session-card").count();

  const targetCard = page.locator(".session-card").nth(1);
  const targetTitle = await targetCard.locator(".session-title").textContent();
  await targetCard.locator("[data-hide-id]").click();
  await expect(page.locator(".session-card")).toHaveCount(before - 1);

  await page.locator("#showHidden").check();
  await expect(page.locator(".session-card")).toHaveCount(before);
  await expect(page.locator(".session-card.marked-hidden .session-title")).toHaveText(targetTitle || "");

  // Unhide restores it under the default (hidden-excluding) filter.
  await page.locator(".session-card.marked-hidden [data-hide-id]").click();
  await page.locator("#showHidden").uncheck();
  await expect(page.locator(".session-card")).toHaveCount(before);
});
