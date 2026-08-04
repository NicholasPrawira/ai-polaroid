import { createHmac } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const JWT_SECRET = "super-secret-jwt-token-for-tests-only-x";

/** The publishable key, signed with the same secret PostgREST validates. */
function anonKey(): string {
  const part = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url").replace(/=+$/, "");
  const head = part({ alg: "HS256", typ: "JWT" });
  const body = part({ role: "anon", iss: "supabase", iat: 1, exp: 4102444800 });
  const sig = Buffer.from(
    createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest(),
  )
    .toString("base64url")
    .replace(/=+$/, "");
  return `${head}.${body}.${sig}`;
}

/**
 * The app is driven against a real Postgres and a real PostgREST, with the auth
 * and storage services doubled — see tests/fake-supabase.mjs for what that does
 * and does not prove. `tests/stack.sh` brings the backend up; this config only
 * starts the app itself.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // The capture → develop → store round trip is several hops.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["camera"],
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath:
            process.env.CHROMIUM_PATH ??
            "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
          args: [
            // getUserMedia has no camera to open in CI, so Chromium supplies a
            // synthetic one. The capture path is otherwise unchanged.
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],

  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey(),
      OPENROUTER_API_KEY: "not-a-real-key",
      // Points the develop route at tests/stub-openrouter.mjs.
      OPENROUTER_BASE_URL: "http://127.0.0.1:8787/v1/images",
    },
  },
});
