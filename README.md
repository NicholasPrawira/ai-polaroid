# AI Disposable Camera

Capture a photo in the browser, send it through an image-to-image model, and let it
develop into an early-2000s disposable camera snapshot.

See [aipolaroid-prd.md](./aipolaroid-prd.md) for product scope and
[designsystem.md](./designsystem.md) for the visual language.

## Setup

```bash
cp .env.example .env.local   # then paste your OpenRouter + Supabase keys
npm install
npm run dev
```

Open http://localhost:3000 for the landing page; the camera itself lives at
`/camera` and requires signing in (see Auth below). `getUserMedia` needs a
secure context, so use `localhost` (not a LAN IP) in development — production
on Vercel is HTTPS already.

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project API URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Safe to expose — restricted by RLS, not secrecy. |
| `NEXT_PUBLIC_SITE_URL` | no | Used to build email links. Defaults to `http://localhost:3000`. Set to the real domain in production. |

Developing is entirely on-device (canvas + a `.cube` LUT), so the app makes
no model calls and needs no AI provider key. The former `OPENROUTER_API_KEY`
/ `OPENROUTER_IMAGE_MODEL` variables are no longer read anywhere — if one is
still set in a deployment or a local `.env.local`, revoke the key at the
provider and delete the lines.

## Auth

Email + password via Supabase Auth. `/camera` and `/update-password` are gated
by `src/proxy.ts` — signed-out visitors are bounced to `/login?next=<path>`.

Two things live in the Supabase Dashboard and can't be set from code or from
the MCP tools this project was built with:

1. **Authentication → URL Configuration** — add your dev and prod origins
   (`http://localhost:3000`, then the real domain) to the Site URL and the
   Redirect URLs allow-list.
2. **Authentication → Email Templates** — the default "Confirm signup" and
   "Reset Password" templates link to Supabase's own hosted verify endpoint.
   For the link to land on this app's `/auth/confirm` route instead, replace
   the link in each template:
   ```
   Confirm signup:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/camera
   Reset Password:  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password
   ```
   Skip this and the emails still send, but clicking the link verifies against
   Supabase directly and never reaches this app.

New projects also default to a low built-in email send rate (a handful per
hour) — fine for development, not for anything real. Configure a custom SMTP
provider under **Authentication → SMTP Settings** before this goes live.

## How it works

- `src/components/AsciiBackground.tsx` — the hero backdrop: a Canvas2D
  reimplementation of the "Forest" ASCII effect (characters mode, grayscale,
  tilt-shift, chromatic + halftone + film dust, shimmer). One scene per hero
  word; the scene follows whichever word is lit, crossfading by interpolating
  luminance fields rather than swapping images, so the glyphs morph. Glyphs are
  blitted from a pre-rendered atlas rather than drawn with fillText, because the
  grid runs to five figures of cells per frame.
  Scenes live in `public/scene-*` — most are now real photographs; a few are
  still generated placeholders. Drop a file in with the same name to replace one.
- `src/app/page.tsx` — landing page. The scrolling word hero is pure CSS: a
  sticky list whose words each carry a `background-attachment: fixed` gradient
  clipped to their glyphs, so a stationary highlight band appears to travel
  through them. No scroll listeners, no measurement, no JavaScript.
- `src/proxy.ts` + `src/lib/supabase/proxy.ts` — refreshes the Supabase session
  on every request and redirects signed-out visitors away from `/camera` and
  `/update-password`. Named `proxy`, not `middleware` — Next.js 16 renamed the
  file convention, and this app is on 16.2.12.
- `src/app/auth/actions.ts` — server actions behind every auth form: `login`,
  `signup`, `signOut`, `requestPasswordReset`, `updatePassword`.
- `src/lib/useCamera.ts` — opens the stream, centre-crops a 1024px square JPEG.
- `src/app/api/develop/route.ts` — posts the capture to OpenRouter's Image API as
  an `input_references` entry, returns the developed photo as a data URL.
- `src/lib/useDevelop.ts` — runs the develop animation **alongside** the request.
  Progress eases to 85%, waits there, then completes once the image lands.
- `src/lib/export.ts` — hands the photo over as a Blob. On touch-only devices it
  goes through the Web Share API so iOS can "Save Image"; elsewhere it downloads.

There is no frame. The saved file is the model's output untouched — no border,
no caption, no date stamp, and no canvas re-encode.

## Notes

- **No photos are stored.** The gallery lives in React state for the session
  only — refreshing clears it. Saving a photo is the only way to keep it. Auth
  is the one exception: your email and password are stored by Supabase, since
  `/camera` requires an account.
- **The viewfinder HUD is decorative.** `getUserMedia` exposes no shutter speed,
  aperture, or ISO. Those readings are hardcoded; static numbers are correct.
