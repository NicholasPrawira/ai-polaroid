import { expect, test } from "@playwright/test";
import {
  closeSheet,
  creditsShown,
  newCode,
  newEmail,
  openAccount,
  promoteToAdmin,
  signIn,
} from "./helpers";

/** Signs in, becomes an admin, and reloads so the new role is in effect. */
async function signInAsAdmin(page: import("@playwright/test").Page) {
  const email = newEmail("admin");
  await signIn(page, email);
  await promoteToAdmin(page, email);
  await page.reload();
  return email;
}

test.describe("promo codes and vouchers", () => {
  test("the dashboard is invisible to an ordinary account", async ({ page }) => {
    await signIn(page, newEmail("ordinary"));

    await page.goto("/dashboard");
    // 404 rather than 403 — no reason to tell them the page exists.
    await expect(page.getByText(/could not be found/i)).toBeVisible();

    // And it is not advertised anywhere either.
    await page.goto("/");
    await openAccount(page);
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
  });

  test("an admin gets a dashboard link and can open it", async ({ page }) => {
    await signInAsAdmin(page);

    await openAccount(page);
    await page.getByRole("link", { name: "Dashboard" }).click();

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "New promo code" })).toBeVisible();
  });

  test("a created code can be redeemed once, and tops up the balance", async ({
    page,
    browser,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard");

    const code = newCode("FILM");
    await page.getByLabel("code", { exact: true }).fill(code);
    await page.getByLabel("photo credits").fill("25");
    await page.getByRole("button", { name: /create code/i }).click();
    await expect(page.getByText(`${code} created`)).toBeVisible();
    await expect(
      page.locator("li", { hasText: code }).getByText("live"),
    ).toBeVisible();

    // Now somebody else claims it.
    const context = await browser.newContext();
    const claimant = await context.newPage();
    await signIn(claimant, newEmail("claimant"));

    await openAccount(claimant);
    expect(await creditsShown(claimant)).toBe(10);

    await claimant.getByLabel("promo code").fill(code.toLowerCase());
    await claimant.getByRole("button", { name: "redeem" }).click();
    await expect(claimant.getByText(/25 photo credits added/i)).toBeVisible();
    expect(await creditsShown(claimant)).toBe(35);

    // A second attempt must be refused.
    await claimant.getByLabel("promo code").fill(code);
    await claimant.getByRole("button", { name: "redeem" }).click();
    await expect(claimant.getByText(/already used that code/i)).toBeVisible();

    await context.close();
  });

  test("a code that does not exist is refused", async ({ page }) => {
    await signIn(page, newEmail("guesser"));
    await openAccount(page);

    await page.getByLabel("promo code").fill("NOTAREALCODE");
    await page.getByRole("button", { name: "redeem" }).click();
    await expect(page.getByText(/does not exist/i)).toBeVisible();
    expect(await creditsShown(page)).toBe(10);
  });

  test("a voucher addressed to one person cannot be claimed by another", async ({
    page,
    browser,
  }) => {
    await signInAsAdmin(page);

    const owner = newEmail("owner");
    const outsider = newEmail("outsider");

    // The voucher's recipient needs an account for the address to match.
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, owner);

    const voucher = newCode("VOUCH");
    await page.goto("/dashboard");
    await page.getByLabel("code", { exact: true }).fill(voucher);
    await page.getByLabel("photo credits").fill("40");
    await page.getByLabel(/voucher for/i).fill(owner);
    await page.getByRole("button", { name: /create code/i }).click();
    await expect(page.getByText(new RegExp(`voucher for ${owner}`, "i"))).toBeVisible();

    const outsiderContext = await browser.newContext();
    const outsiderPage = await outsiderContext.newPage();
    await signIn(outsiderPage, outsider);
    await openAccount(outsiderPage);
    await outsiderPage.getByLabel("promo code").fill(voucher);
    await outsiderPage.getByRole("button", { name: "redeem" }).click();
    await expect(
      outsiderPage.getByText(/belongs to a different account/i),
    ).toBeVisible();
    expect(await creditsShown(outsiderPage)).toBe(10);

    // The person it was made for can claim it.
    await ownerPage.reload();
    await openAccount(ownerPage);
    await ownerPage.getByLabel("promo code").fill(voucher);
    await ownerPage.getByRole("button", { name: "redeem" }).click();
    await expect(ownerPage.getByText(/40 photo credits added/i)).toBeVisible();
    expect(await creditsShown(ownerPage)).toBe(50);

    await ownerContext.close();
    await outsiderContext.close();
  });

  test("a switched-off code stops working", async ({ page, browser }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard");

    const shortlived = newCode("SHORT");
    await page.getByLabel("code", { exact: true }).fill(shortlived);
    await page.getByLabel("photo credits").fill("5");
    await page.getByRole("button", { name: /create code/i }).click();
    await expect(page.getByText(`${shortlived} created`)).toBeVisible();

    await page
      .locator("li", { hasText: shortlived })
      .getByRole("button", { name: "turn off" })
      .click();
    await expect(page.locator("li", { hasText: shortlived }).getByText("off")).toBeVisible();

    const context = await browser.newContext();
    const user = await context.newPage();
    await signIn(user, newEmail("latecomer"));
    await openAccount(user);
    await user.getByLabel("promo code").fill(shortlived);
    await user.getByRole("button", { name: "redeem" }).click();
    await expect(user.getByText(/no longer active/i)).toBeVisible();

    await context.close();
  });

  test("an admin can hand credits over directly, with no code involved", async ({
    page,
    browser,
  }) => {
    await signInAsAdmin(page);

    const recipient = newEmail("recipient");
    const context = await browser.newContext();
    const theirPage = await context.newPage();
    await signIn(theirPage, recipient);

    await page.goto("/dashboard");
    await page.getByLabel("account").fill(recipient);
    await page.getByLabel("credits to add").fill("7");
    await page.getByRole("button", { name: /give credits/i }).click();
    await expect(page.getByText(new RegExp(`${recipient} now has 17`, "i"))).toBeVisible();

    await theirPage.reload();
    await openAccount(theirPage);
    expect(await creditsShown(theirPage)).toBe(17);

    await context.close();
  });

  test("granting to an address with no account says so", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard");

    await page.getByLabel("account").fill("ghost@example.com");
    await page.getByLabel("credits to add").fill("5");
    await page.getByRole("button", { name: /give credits/i }).click();
    await expect(page.getByText(/no account for ghost@example.com/i)).toBeVisible();
  });

  test("a claim shows up in the dashboard's log", async ({ page, browser }) => {
    await signInAsAdmin(page);
    await page.goto("/dashboard");

    const tracked = newCode("TRACK");
    await page.getByLabel("code", { exact: true }).fill(tracked);
    await page.getByLabel("photo credits").fill("3");
    await page.getByRole("button", { name: /create code/i }).click();
    await expect(page.getByText(`${tracked} created`)).toBeVisible();

    const email = newEmail("tracked");
    const context = await browser.newContext();
    const user = await context.newPage();
    await signIn(user, email);
    await openAccount(user);
    await user.getByLabel("promo code").fill(tracked);
    await user.getByRole("button", { name: "redeem" }).click();
    await expect(user.getByText(/3 photo credits added/i)).toBeVisible();

    await page.reload();
    // Scoped to this claimant's row: earlier runs leave their own claims behind.
    const claims = page.locator("section", { hasText: "Recent claims" });
    const row = claims.locator("li", { hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText("+3")).toBeVisible();

    await context.close();
  });
});

test.describe("running out", () => {
  test("the shutter refuses once the balance is empty, and works again after a top-up", async ({
    page,
    browser,
  }) => {
    const email = newEmail("broke");
    await signIn(page, email);

    // Spend the starting roll without taking ten photographs.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const adminEmail = newEmail("banker");
    await signIn(adminPage, adminEmail);
    await promoteToAdmin(adminPage, adminEmail);
    await adminPage.goto("/dashboard");
    await adminPage.getByLabel("account").fill(email);
    await adminPage.getByLabel("credits to add").fill("-10");
    await adminPage.getByRole("button", { name: /give credits/i }).click();
    await expect(adminPage.getByText(new RegExp(`${email} now has 0`, "i"))).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /take photo/i }).click();
    await expect(page.getByText(/out of photo credits/i)).toBeVisible();

    // Nothing should have been developed.
    const res = await page.request.get(
      `http://127.0.0.1:54321/test/photos?email=${encodeURIComponent(email)}`,
    );
    expect(await res.json()).toHaveLength(0);

    // Top up and the camera works again.
    await adminPage.getByLabel("account").fill(email);
    await adminPage.getByLabel("credits to add").fill("5");
    await adminPage.getByRole("button", { name: /give credits/i }).click();
    await expect(adminPage.getByText(new RegExp(`${email} now has 5`, "i"))).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: /take photo/i }).click();
    await expect(page.getByRole("button", { name: /save to gallery/i })).toBeVisible({
      timeout: 45_000,
    });

    await openAccount(page);
    expect(await creditsShown(page)).toBe(4);
    await closeSheet(page);

    await adminContext.close();
  });
});
