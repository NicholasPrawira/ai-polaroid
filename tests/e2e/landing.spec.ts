import { expect, test } from "@playwright/test";

/** Reads the amber highlight straight off the DOM, wherever it currently is. */
async function highlighted(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll("h1 li")];
    const amber = items.filter((el) => {
      const c = getComputedStyle(el).color;
      const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c);
      if (!m) return false;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      return r > 200 && g > 130 && g < 210 && b < 140;
    });
    return {
      count: amber.length,
      word: amber[0]?.textContent?.trim() ?? null,
      // Compared against the "Capture your" run itself, which is the line the
      // highlighted word is supposed to sit on.
      top: amber[0]?.getBoundingClientRect().top ?? null,
      headlineTop:
        document.querySelector("h1 > span")?.getBoundingClientRect().top ?? null,
    };
  });
}

test.describe("the landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("it scrolls, and has both the dark and the white section", async ({
    page,
  }) => {
    const { scrollHeight, clientHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    await expect(page.getByRole("heading", { name: "Questions" })).toBeVisible();

    const white = await page.evaluate(() => {
      const section = document.querySelector("#questions");
      return section ? getComputedStyle(section).backgroundColor : null;
    });
    expect(white).toBe("rgb(255, 255, 255)");
  });

  test("exactly one word is orange, and it is the one on the headline", async ({
    page,
  }) => {
    const state = await highlighted(page);
    expect(state.count).toBe(1);
    expect(state.word).toBe("Travel");
    // Sitting on the headline's own line, not adrift below it.
    expect(Math.abs(state.top! - state.headlineTop!)).toBeLessThan(24);
  });

  test("the orange follows the word as it rotates", async ({ page }) => {
    const first = await highlighted(page);

    await expect
      .poll(async () => (await highlighted(page)).word, { timeout: 15_000 })
      .not.toBe(first.word);

    const next = await highlighted(page);
    // Still exactly one, still on the line — the colour moved with the word
    // rather than being left behind on the previous one.
    expect(next.count).toBe(1);
    expect(Math.abs(next.top! - next.headlineTop!)).toBeLessThan(24);
  });

  test("the orange stays with its word while the page is scrolled", async ({
    page,
  }) => {
    const before = await highlighted(page);

    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(300);

    const after = await highlighted(page);
    expect(after.count).toBe(1);
    // The headline moved up with the page; the highlight moved exactly with it.
    expect(Math.abs(after.top! - after.headlineTop!)).toBeLessThan(24);
    expect(after.headlineTop!).toBeLessThan(before.headlineTop!);
  });

  test("every question opens", async ({ page }) => {
    const questions = page.locator("#questions details");
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i++) {
      const item = questions.nth(i);
      await item.locator("summary").click();
      await expect(item.locator("dd")).toBeVisible();
    }
  });

  test("both calls to action lead to signing in", async ({ page }) => {
    await expect(page.getByRole("link", { name: /start shooting/i })).toHaveAttribute(
      "href",
      "/login",
    );
    await page.getByRole("link", { name: /take the first one/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
