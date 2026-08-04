# AI Disposable Camera

Capture a photo in the browser, send it through an image-to-image model, and let it
develop into an early-2000s disposable camera snapshot.

See [aipolaroid-prd.md](./aipolaroid-prd.md) for product scope and
[designsystem.md](./designsystem.md) for the visual language.

## Setup

```bash
cp .env.example .env.local   # then paste your OpenRouter key
npm install
npm run dev
```

Open http://localhost:3000 for the landing page; the camera itself lives at
`/camera`. `getUserMedia` needs a secure context, so use `localhost` (not a LAN
IP) in development — production on Vercel is HTTPS already.

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | Server-only, never sent to the client. |
| `OPENROUTER_IMAGE_MODEL` | no | Defaults to `x-ai/grok-imagine-image-quality`. |

Image-capable models are only listed when you filter for them —
`/api/v1/models?output_modalities=image`. The unfiltered model list omits them.

## How it works

- `src/app/page.tsx` — landing page. The scrolling word hero is pure CSS: a
  sticky list whose words each carry a `background-attachment: fixed` gradient
  clipped to their glyphs, so a stationary highlight band appears to travel
  through them. No scroll listeners, no measurement, no JavaScript.
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

- **Nothing is stored.** The gallery lives in React state for the session only —
  refreshing clears it. Saving a photo is the only way to keep it.
- **The viewfinder HUD is decorative.** `getUserMedia` exposes no shutter speed,
  aperture, or ISO. Those readings are hardcoded; static numbers are correct.
