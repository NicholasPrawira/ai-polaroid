# AI Disposable Camera

Capture a photo in the browser, send it through an image-to-image model, and let it
develop into an early-2000s disposable camera snapshot.

See [aipolaroid-prd.md](./aipolaroid-prd.md) for product scope and
[designsystem.md](./designsystem.md) for the visual language.

## Setup

```bash
cp .env.example .env.local   # OpenRouter key + Supabase URL and anon key
npm install
npm run dev
```

Open http://localhost:3000. `getUserMedia` needs a secure context, so use
`localhost` (not a LAN IP) in development — production on Vercel is HTTPS already.

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | Server-only, never sent to the client. |
| `OPENROUTER_IMAGE_MODEL` | no | Defaults to `x-ai/grok-imagine-image-quality`. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL from Settings › API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Publishable key. Safe in the browser — every table is behind RLS. |

There is no service role key. Nothing in this app needs to bypass row level
security, so the key that could is never issued to it.

### Database

Run the migrations in `supabase/migrations/` in order, either through the
Supabase SQL editor or `supabase db push`. Edit the email in `0002` first — it
is what promotes the first admin, and the dashboard is unreachable until
somebody is one.

Then, in the Supabase dashboard under Authentication › URL Configuration, add
your site URL to the redirect allowlist. Sign-in links bounce off that list, so
until it is set the emailed link will refuse to complete.

Image-capable models are only listed when you filter for them —
`/api/v1/models?output_modalities=image`. The unfiltered model list omits them.

## Tests

```bash
tests/stack.sh up    # database + PostgREST + gateway + model stub
npm test             # SQL security suite, then the browser suite
```

Two layers, because they prove different things:

- **`tests/db/security.test.sql`** attacks the migrations as a signed-in user:
  can somebody write their own credit balance, read another account's photos,
  claim a code twice, claim a voucher addressed to somebody else, grant
  themselves credits. Run against a real Postgres, so the policies and functions
  under test are the ones that ship. It is deliberately mutation-checked — remove
  a policy and the suite fails.
- **`tests/e2e/`** drives the app in Chromium with a synthetic camera: sign in,
  shoot, reload and find the photo still there, file it, delete it, run out of
  credits, redeem a code, issue a voucher, and fail a develop to confirm the
  credit comes back.

The browser suite runs against a real Postgres and a real PostgREST, with the
auth and storage services stood in for (`tests/fake-supabase.mjs` says exactly
what that does and does not cover). If Docker is available to you, `supabase
start` gives you the genuine article and is the better option — it was blocked
in the environment these were written in.

## How it works

- `src/lib/useCamera.ts` — opens the stream, centre-crops a 1024px square JPEG.
- `src/app/api/develop/route.ts` — spends a credit, stores the raw capture, posts
  it to OpenRouter's Image API as an `input_references` entry, stores the result,
  and returns a signed URL. A failed develop refunds the credit. This stays a
  Route Handler rather than a Server Action because actions cap request bodies at
  1MB and a capture is larger than that.
- `src/lib/data.ts` — every read of a photo, folder, or balance. Runs under the
  caller's session, so RLS is what enforces ownership.
- `src/proxy.ts` — Next 16 renamed Middleware to Proxy. Refreshes the Supabase
  session cookie and redirects signed-out visitors.
- `src/lib/useDevelop.ts` — runs the develop animation **alongside** the request.
  Progress eases to 85%, waits there, then completes once the image lands.
- `src/lib/export.ts` — hands the photo over as a Blob. On touch-only devices it
  goes through the Web Share API so iOS can "Save Image"; elsewhere it downloads.

There is no frame. The saved file is the model's output untouched — no border,
no caption, no date stamp, and no canvas re-encode.

## Notes

- **Photos are kept.** Each one is saved to your account as both the raw capture
  and the developed print. The raw is kept deliberately: if a develop fails, or
  the prompt changes, the original moment still exists.
- **One credit is one photo.** Each develop costs real money at the image API, so
  the balance is what stops a shared link running up a bill. New accounts start
  with ten; promo codes and vouchers add more.
- **The viewfinder HUD is decorative.** `getUserMedia` exposes no shutter speed,
  aperture, or ISO. Those readings are hardcoded; static numbers are correct.
- **This reverses PRD §3 and §5.5**, which specified no accounts and no storage.
  `ROADMAP.md` §0 anticipated that reversal; the PRD has not been rewritten yet.
