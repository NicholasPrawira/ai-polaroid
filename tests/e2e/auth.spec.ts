import { expect, test } from "@playwright/test";
import { newEmail, signIn } from "./helpers";

test.describe("getting in", () => {
  test("a signed-out visitor is sent to the login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "AI Disposable Camera" }),
    ).toBeVisible();
  });

  test("the dashboard is not reachable signed out either", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the develop API answers signed-out callers with JSON, not a redirect", async ({
    request,
  }) => {
    // The proxy carves out /api/ on purpose: a fetch cannot do anything useful
    // with an HTML login page.
    const res = await request.post("/api/develop", {
      data: { image: "data:image/png;base64,iVBORw0KGgo=" },
    });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Not signed in." });
  });

  test("a malformed address is refused before any email is sent", async ({
    page,
  }) => {
    await page.goto("/login");
    // The browser's own validation catches most rubbish before submit, so this
    // is an address it accepts and the server action does not.
    await page.getByLabel("Email address").fill("someone@localhost");
    await page.getByRole("button", { name: /send sign-in link/i }).click();
    await expect(page.getByText(/does not look like an email/i)).toBeVisible();
  });

  test("a magic link signs you in and lands you on the camera", async ({
    page,
  }) => {
    await signIn(page, newEmail("newcomer"));
    await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();
  });

  test("an already-used link cannot be replayed", async ({ page }) => {
    const email = newEmail("replay");
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: /send sign-in link/i }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible();

    const res = await page.request.get(
      `http://127.0.0.1:54321/test/magiclink?email=${encodeURIComponent(email)}`,
    );
    const { token } = (await res.json()) as { token: string };

    await page.goto(`/auth/confirm?token_hash=${token}&type=email`);
    await page.waitForURL("http://127.0.0.1:3000/");

    // Signing out and replaying the same link must not work.
    await page.getByRole("button", { name: /account and settings/i }).click();
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await page.waitForURL(/\/login/);

    await page.goto(`/auth/confirm?token_hash=${token}&type=email`);
    await expect(page).toHaveURL(/\/login\?error=expired/);
  });

  test("signing out ends the session", async ({ page }) => {
    await signIn(page, newEmail("leaver"));
    await page.getByRole("button", { name: /account and settings/i }).click();
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await page.waitForURL(/\/login/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
