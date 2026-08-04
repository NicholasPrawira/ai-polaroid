/**
 * Same measurements as inspect-pages.mjs, but signed in, so `/` renders the
 * app itself rather than redirecting to the login page.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const OUT = process.env.OUT_DIR ?? "/tmp/pageshots";
const BASE = "http://127.0.0.1:3000";
const GATEWAY = "http://127.0.0.1:54321";
const EMAIL = `look-${Date.now()}@example.com`;

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

await mkdir(OUT, { recursive: true });

const context = await browser.newContext({
  viewport: { width: 430, height: 900 },
  permissions: ["camera"],
});
const page = await context.newPage();

await page.goto(`${BASE}/login`);
await page.getByLabel("Email address").fill(EMAIL);
await page.getByRole("button", { name: /send sign-in link/i }).click();
await page.getByText(/check your inbox/i).waitFor();

const { token } = await (
  await page.request.get(`${GATEWAY}/test/magiclink?email=${encodeURIComponent(EMAIL)}`)
).json();
await page.goto(`${BASE}/auth/confirm?token_hash=${token}&type=email`);
await page.waitForURL(`${BASE}/`);
await page.waitForTimeout(1500);

const measure = () =>
  page.evaluate(() => {
    const orange = [];
    for (const el of document.querySelectorAll("*")) {
      const c = getComputedStyle(el).backgroundColor;
      const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c);
      if (!m) continue;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      if (r > 150 && g > 60 && g < 190 && b < 120) {
        orange.push({ tag: el.tagName, cls: el.className?.toString().slice(0, 60), c });
      }
    }
    return {
      url: location.pathname,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      orange,
      headings: [...document.querySelectorAll("h1,h2,h3")].map((h) =>
        h.textContent?.trim(),
      ),
    };
  });

for (const [label, go] of [
  ["camera", async () => {}],
  ["gallery", async () => page.getByRole("button", { name: "Gallery", exact: true }).click()],
]) {
  await go();
  await page.waitForTimeout(600);
  const m = await measure();
  console.log(label, JSON.stringify(m, null, 2));
  console.log(`  scrollable: ${m.scrollHeight > m.clientHeight ? "YES" : "NO"}\n`);
  await page.screenshot({ path: `${OUT}/root-${label}.png`, fullPage: true });
}

await browser.close();
console.log(`screenshots in ${OUT}`);
