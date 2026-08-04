import { expect, test } from "@playwright/test";
import { newEmail, signIn } from "./helpers";

test.describe("the shutter", () => {
  test("the viewfinder blacks out on capture, like a mirror going up", async ({
    page,
  }) => {
    await signIn(page, newEmail("shutterbug"));

    const blackout = page.getByTestId("shutter");
    await expect(blackout).toHaveCount(0);

    const shutter = page.getByRole("button", { name: /take photo/i });
    await expect(shutter).toBeEnabled();
    await shutter.click();

    // Read it during the blackout rather than after: the handover to the
    // develop screen is deliberately held until the mirror is back down.
    const seen = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="shutter"]');
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        bg: s.backgroundColor,
        animation: s.animationName,
        covers: el.getBoundingClientRect().height > 100,
      };
    });

    expect(seen, "the blackout should be on screen during capture").not.toBeNull();
    expect(seen!.bg).toBe("rgb(0, 0, 0)");
    expect(seen!.animation).toBe("shutter-blackout");
    expect(seen!.covers).toBe(true);

    // And it clears itself rather than lingering over the frame.
    await expect(blackout).toHaveCount(0, { timeout: 5_000 });
    await expect(page.getByRole("button", { name: /save to gallery/i })).toBeVisible({
      timeout: 45_000,
    });
  });

  test("no gimmick text is left on the viewfinder or the develop screen", async ({
    page,
  }) => {
    await signIn(page, newEmail("plainspoken"));

    await expect(page.getByText("rec", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: /take photo/i }).click();
    await expect(page.getByText(/do not close the application/i)).toHaveCount(0);

    await expect(page.getByRole("button", { name: /save to gallery/i })).toBeVisible({
      timeout: 45_000,
    });
  });
});
