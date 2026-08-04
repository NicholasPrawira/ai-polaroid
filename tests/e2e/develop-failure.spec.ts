import { expect, test, type Page } from "@playwright/test";
import { SUPABASE, creditsShown, newEmail, openAccount, signIn } from "./helpers";

const STUB = "http://127.0.0.1:8787";

async function setStubMode(page: Page, mode: "ok" | "url" | "error") {
  const res = await page.request.post(`${STUB}/_mode`, { data: { mode } });
  expect(res.ok()).toBeTruthy();
}

test.describe("when the model fails", () => {
  test.afterEach(async ({ page }) => {
    await setStubMode(page, "ok");
  });

  test("the credit comes back and the capture is not lost", async ({ page }) => {
    const email = newEmail("unlucky");
    await signIn(page, email);
    await setStubMode(page, "error");

    await page.getByRole("button", { name: /take photo/i }).click();

    // The develop screen should say so rather than hanging or pretending.
    await expect(page.getByText(/stubbed failure/i)).toBeVisible({
      timeout: 45_000,
    });

    // A shot that produced no photograph must not cost anything.
    await page.goto("/");
    await openAccount(page);
    expect(await creditsShown(page)).toBe(10);

    // The raw capture is still on disk, marked failed — the moment survives
    // even though the print did not.
    const res = await page.request.get(
      `${SUPABASE}/test/photos?email=${encodeURIComponent(email)}`,
    );
    const rows = (await res.json()) as Array<{
      status: string;
      raw_path: string | null;
      developed_path: string | null;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].raw_path).toMatch(/\/raw\./);
    expect(rows[0].developed_path).toBeNull();
  });

  test("a failed develop never reaches the gallery", async ({ page }) => {
    await signIn(page, newEmail("nogallery"));
    await setStubMode(page, "error");

    await page.getByRole("button", { name: /take photo/i }).click();
    await expect(page.getByText(/stubbed failure/i)).toBeVisible({
      timeout: 45_000,
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    await expect(page.getByText(/no photos yet/i)).toBeVisible();
  });

  test("an image returned by URL is downloaded and kept too", async ({
    page,
  }) => {
    const email = newEmail("bylink");
    await signIn(page, email);
    await setStubMode(page, "url");

    await page.getByRole("button", { name: /take photo/i }).click();
    await expect(page.getByRole("button", { name: /save to gallery/i })).toBeVisible({
      timeout: 45_000,
    });

    const res = await page.request.get(
      `${SUPABASE}/test/photos?email=${encodeURIComponent(email)}`,
    );
    const rows = (await res.json()) as Array<{
      status: string;
      developed_path: string | null;
    }>;
    expect(rows[0].status).toBe("done");
    // Downloaded and stored on our side, not hot-linked to the model's host.
    expect(rows[0].developed_path).toMatch(/\/developed\./);
  });
});
