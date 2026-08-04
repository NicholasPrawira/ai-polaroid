import { expect, test } from "@playwright/test";
import {
  SUPABASE,
  closeSheet,
  creditsShown,
  newEmail,
  openAccount,
  openGallery,
  shoot,
  signIn,
} from "./helpers";

test.describe("taking and keeping photos", () => {
  test("a photo survives a reload — the whole point of the change", async ({
    page,
  }) => {
    await signIn(page, newEmail("keeper"));
    await shoot(page);

    await page.goto("/");
    await openGallery(page);

    const photos = page.getByRole("button", { name: /open photo/i });
    await expect(photos).toHaveCount(1);

    // And again from a completely fresh page load, not just client state.
    await page.reload();
    await openGallery(page);
    await expect(page.getByRole("button", { name: /open photo/i })).toHaveCount(1);
  });

  test("the gallery no longer claims nothing is stored", async ({ page }) => {
    await signIn(page, newEmail("copy"));
    await openGallery(page);
    await expect(page.getByText(/saved to your account/i)).toBeVisible();
    await expect(page.getByText(/nothing is stored/i)).toHaveCount(0);
  });

  test("developing spends exactly one credit", async ({ page }) => {
    await signIn(page, newEmail("spender"));

    await openAccount(page);
    expect(await creditsShown(page)).toBe(10);
    await closeSheet(page);

    await shoot(page);

    await openAccount(page);
    expect(await creditsShown(page)).toBe(9);
  });

  test("a photo can be filed into a folder, and stays filed", async ({
    page,
  }) => {
    await signIn(page, newEmail("filer"));
    await shoot(page);

    await page.getByRole("button", { name: /add to folder/i }).click();
    await page.getByLabel("New folder name").fill("Japan 2026");
    await page.getByRole("button", { name: "Create folder" }).click();

    await expect(page.getByRole("button", { name: /japan 2026/i })).toBeVisible();

    // Reload so this reads the database rather than the optimistic state.
    await page.reload();
    await openGallery(page);
    await page.getByRole("button", { name: /^folders$/i }).click();

    await expect(page.getByText("Japan 2026")).toBeVisible();
    await expect(page.getByText("1 photo")).toBeVisible();
  });

  test("deleting a photo removes it for good", async ({ page }) => {
    await signIn(page, newEmail("deleter"));
    await shoot(page);

    await page.getByRole("button", { name: /delete photo/i }).click();
    await page.getByRole("button", { name: /delete for good/i }).click();

    await expect(page.getByRole("button", { name: /open photo/i })).toHaveCount(0);

    await page.reload();
    await openGallery(page);
    await expect(page.getByRole("button", { name: /open photo/i })).toHaveCount(0);
  });

  test("one account cannot see another's photos", async ({ browser }) => {
    const ada = await browser.newContext();
    const grace = await browser.newContext();

    const adaPage = await ada.newPage();
    await signIn(adaPage, newEmail("ada"));
    await shoot(adaPage);
    await openGallery(adaPage);
    await expect(adaPage.getByRole("button", { name: /open photo/i })).toHaveCount(1);

    const gracePage = await grace.newPage();
    await signIn(gracePage, newEmail("grace"));
    await openGallery(gracePage);
    await expect(gracePage.getByText(/no photos yet/i)).toBeVisible();
    await expect(gracePage.getByRole("button", { name: /open photo/i })).toHaveCount(0);

    await ada.close();
    await grace.close();
  });

  test("the raw capture is kept alongside the developed print", async ({
    page,
  }) => {
    const email = newEmail("archivist");
    await signIn(page, email);
    await shoot(page);

    const res = await page.request.get(
      `${SUPABASE}/test/photos?email=${encodeURIComponent(email)}`,
    );
    const rows = (await res.json()) as Array<{
      status: string;
      raw_path: string | null;
      developed_path: string | null;
    }>;

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("done");
    // Losing the original would mean a prompt change could destroy the moment.
    expect(rows[0].raw_path).toMatch(/\/raw\.(jpg|png|webp)$/);
    expect(rows[0].developed_path).toMatch(/\/developed\.(jpg|png|webp)$/);
  });
});
