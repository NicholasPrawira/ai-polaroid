import { expect, type Page } from "@playwright/test";

export const SUPABASE = "http://127.0.0.1:54321";

/** A fresh address per test, so no run depends on another run's leftovers. */
export function newEmail(prefix = "user"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * A fresh promo code per test. Codes are unique in the database and the suite
 * does not drop it between runs, so a fixed name would collide on the second
 * run and fail for the wrong reason.
 */
export function newCode(prefix = "CODE"): string {
  return `${prefix}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

/**
 * Signs in the way a person would: ask for a link, then follow it. The link is
 * read from the stand-in gateway instead of an inbox.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /send sign-in link/i }).click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible();

  const res = await page.request.get(
    `${SUPABASE}/test/magiclink?email=${encodeURIComponent(email)}`,
  );
  expect(res.ok(), "the gateway should have issued a magic link").toBeTruthy();
  const { token } = (await res.json()) as { token: string };

  await page.goto(`/auth/confirm?token_hash=${token}&type=email`);
  await page.waitForURL("http://127.0.0.1:3000/");
}

export async function promoteToAdmin(page: Page, email: string): Promise<void> {
  const res = await page.request.get(
    `${SUPABASE}/test/promote?email=${encodeURIComponent(email)}`,
  );
  const body = (await res.json()) as { promoted: number };
  expect(body.promoted, `no profile to promote for ${email}`).toBe(1);
}

/** Takes one photo and waits for the print to appear. */
export async function shoot(page: Page): Promise<void> {
  await page.getByRole("button", { name: /take photo/i }).click();
  await expect(page.getByRole("button", { name: /save to gallery/i })).toBeVisible({
    timeout: 45_000,
  });
}

/**
 * The Gallery tab, named exactly — a loose match also catches the result
 * screen's "Save to Gallery" button.
 */
export function galleryTab(page: Page) {
  return page.getByRole("button", { name: "Gallery", exact: true });
}

export async function openGallery(page: Page): Promise<void> {
  await galleryTab(page).click();
}

export async function openAccount(page: Page): Promise<void> {
  await page.getByRole("button", { name: /account and settings/i }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
}

/**
 * The sheet has two things labelled Close: the backdrop and the header button.
 * The backdrop sits behind the sheet, so clicking it is intercepted.
 */
export async function closeSheet(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Close" }).nth(1).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeHidden();
}

export async function creditsShown(page: Page): Promise<number> {
  const value = await page
    .locator("dt", { hasText: /^credits$/ })
    .locator("xpath=following-sibling::dd[1]")
    .innerText();
  return Number(value.trim());
}
