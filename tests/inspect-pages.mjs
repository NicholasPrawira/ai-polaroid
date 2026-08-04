/**
 * Screenshots what a visitor actually sees, and reports whether each page
 * scrolls. Used to check a claim about the UI rather than argue about it.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const OUT = process.env.OUT_DIR ?? "/tmp/pageshots";
const BASE = "http://127.0.0.1:3000";

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

await mkdir(OUT, { recursive: true });

const context = await browser.newContext({ viewport: { width: 430, height: 900 } });
const page = await context.newPage();

for (const path of ["/", "/login"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const name = path === "/" ? "root" : path.slice(1).replace(/\//g, "-");

  const metrics = await page.evaluate(() => ({
    url: location.pathname,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    // Anything with an orange-ish background, anywhere on the page.
    orange: [...document.querySelectorAll("*")]
      .map((el) => getComputedStyle(el).backgroundColor)
      .filter((c) => {
        const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c);
        if (!m) return false;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        return r > 150 && g > 60 && g < 190 && b < 120;
      }),
    headings: [...document.querySelectorAll("h1,h2,h3")].map((h) =>
      h.textContent?.trim(),
    ),
  }));

  console.log(JSON.stringify({ requested: path, ...metrics }, null, 2));
  console.log(
    `  scrollable: ${metrics.scrollHeight > metrics.clientHeight ? "YES" : "NO"}`,
  );

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

await browser.close();
console.log(`screenshots in ${OUT}`);
