// @ts-check
const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw new Error("Uncaught page error: " + err.message);
  });
});

test.describe("mobile portrait (390x844)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows the compact mobile topbar instead of the desktop header/toolbar", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#mobileTopbar")).toBeVisible();
    await expect(page.locator(".app-header")).toBeHidden();
    // The toolbar lives inside the closed drawer, which is off-canvas
    // (translated out of view) rather than display:none.
    await expect(page.locator("#mobileDrawer")).not.toHaveClass(/open/);
    const toolbarBox = await page.locator("#toolbarPanel").boundingBox();
    expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(0);
  });

  test("defaults to planned-only on first mobile load", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#hamburgerButton");
    await expect(page.locator("#plannedOnly")).toBeChecked();
    await expect(page.locator("#favoritesOnly")).not.toBeChecked();
  });

  test("hamburger opens a drawer containing day tabs, view tabs, and filters; close button closes it", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#mobileDrawer")).not.toHaveClass(/open/);
    await page.click("#hamburgerButton");
    await expect(page.locator("#mobileDrawer")).toHaveClass(/open/);
    await expect(page.locator("#mobileDrawer #dayTabs button")).not.toHaveCount(0);
    await expect(page.locator("#mobileDrawer #viewTabs button")).toHaveCount(3);
    await expect(page.locator("#mobileDrawer #typeFilter")).toBeVisible();
    await page.click("#drawerCloseButton");
    await expect(page.locator("#mobileDrawer")).not.toHaveClass(/open/);
  });

  test("scroll-right/left buttons page the timetable by exactly one column", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#hamburgerButton");
    await page.uncheck("#plannedOnly");
    await page.click("#drawerCloseButton");
    await page.waitForTimeout(200);

    const timetable = page.locator("#timetable");
    const firstColumnWidth = await page.evaluate(() => document.querySelector(".column-header").getBoundingClientRect().width);

    await page.click("#scrollRightButton");
    await page.waitForTimeout(400);
    const afterRight = await timetable.evaluate((el) => el.scrollLeft);
    expect(Math.abs(afterRight - firstColumnWidth)).toBeLessThan(1);

    await page.click("#scrollLeftButton");
    await page.waitForTimeout(400);
    const afterLeft = await timetable.evaluate((el) => el.scrollLeft);
    expect(afterLeft).toBe(0);
  });

  test("scroll buttons are disabled in one-column (list) view", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#hamburgerButton");
    await page.uncheck("#plannedOnly");
    await page.click("#viewTabs button:has-text('One column')");
    await expect(page.locator("#scrollLeftButton")).toBeDisabled();
    await expect(page.locator("#scrollRightButton")).toBeDisabled();
  });

  test("tries to fit at least 3 columns on screen in stage view", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#hamburgerButton");
    await page.uncheck("#plannedOnly");
    await page.click("#drawerCloseButton");
    await page.waitForTimeout(200);
    const visibleColumns = await page.evaluate(() => {
      const rail = document.querySelector(".time-rail").getBoundingClientRect();
      const headers = [...document.querySelectorAll(".column-header")];
      const viewportRight = document.getElementById("timetable").getBoundingClientRect().right;
      return headers.filter((h) => h.getBoundingClientRect().left >= rail.right - 1 && h.getBoundingClientRect().right <= viewportRight + 1).length;
    });
    expect(visibleColumns).toBeGreaterThanOrEqual(3);
  });

  test("column headers and the time rail stay visible while scrolling in both directions", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#hamburgerButton");
    await page.uncheck("#plannedOnly");
    await page.click("#drawerCloseButton");
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const el = document.getElementById("timetable");
      el.scrollLeft = 100;
      el.scrollTop = 300;
    });
    await page.waitForTimeout(200);

    const timetableBox = await page.locator("#timetable").boundingBox();
    const railBox = await page.locator(".time-rail").boundingBox();
    const headerBox = await page.locator(".column-header").first().boundingBox();

    expect(railBox.x).toBeGreaterThanOrEqual(timetableBox.x - 1);
    expect(railBox.x).toBeLessThan(timetableBox.x + 40);
    expect(headerBox.y).toBeGreaterThanOrEqual(timetableBox.y - 1);
    expect(headerBox.y).toBeLessThan(timetableBox.y + 40);
  });

  test("removes the stats/summary bar and heavy borders around the table on mobile", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#summary")).toBeHidden();
    const border = await page.locator("#timetable").evaluate((el) => getComputedStyle(el).borderStyle);
    expect(border).toBe("none");
  });

  test("tapping a card hides the details link and opens a full-screen overlay with directional navigation", async ({ page }) => {
    await page.goto("/index.html");
    await page.click("#hamburgerButton");
    await page.uncheck("#plannedOnly");
    await page.click("#drawerCloseButton");
    await page.waitForTimeout(200);

    await expect(page.locator(".session-card .details-link").first()).toBeHidden();

    const firstTitle = await page.locator(".session-card .session-title").first().textContent();
    await page.locator(".session-card").first().click();
    await expect(page.locator("#mobileDetailOverlay")).toHaveClass(/open/);
    await expect(page.locator("#mobileDetailContent h2")).toHaveText(firstTitle || "");

    // The official-app link must still be reachable from inside the overlay.
    await expect(page.locator("#mobileDetailContent .details-link")).toHaveAttribute("href", /^https:\/\//);

    // First card in its column: nothing above it, nothing to the left.
    await expect(page.locator("#mobileDetailNavUp")).toBeDisabled();
    await expect(page.locator("#mobileDetailNavLeft")).toBeDisabled();
    await expect(page.locator("#mobileDetailNavDown")).toBeEnabled();

    const downTitle = await page.evaluate(() => document.getElementById("mobileDetailNavDown").dataset.targetId);
    await page.click("#mobileDetailNavDown");
    await expect(page.locator("#mobileDetailContent h2")).not.toHaveText(firstTitle || "");
    expect(downTitle).toBeTruthy();

    await page.click("#mobileDetailCloseButton");
    await expect(page.locator("#mobileDetailOverlay")).not.toHaveClass(/open/);
  });
});

test.describe("mobile landscape (844x390)", () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test("shows the compact topbar and a usable grid in landscape too", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("#mobileTopbar")).toBeVisible();
    await page.click("#hamburgerButton");
    await page.uncheck("#plannedOnly");
    await page.click("#drawerCloseButton");
    await page.waitForTimeout(200);
    await expect(page.locator(".session-card").first()).toBeVisible();
  });
});
