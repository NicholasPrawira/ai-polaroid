# AI Polaroid

Capture a photo in the browser, send it through an image-to-image model, and let it
develop into a Polaroid print.

See [aipolaroid-prd.md](./aipolaroid-prd.md) for product scope and
[designsystem.md](./designsystem.md) for the visual language.

## Setup

```bash
cp .env.example .env.local   # then paste your OpenRouter key
npm install
npm run dev
```

Open http://localhost:3000. `getUserMedia` needs a secure context, so use
`localhost` (not a LAN IP) in development — production on Vercel is HTTPS already.

| Variable | Required | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | Server-only, never sent to the client. |
| `OPENROUTER_IMAGE_MODEL` | no | Defaults to `x-ai/grok-imagine-image-quality`. |

Image-capable models are only listed when you filter for them —
`/api/v1/models?output_modalities=image`. The unfiltered model list omits them.

## How it works

- `src/lib/useCamera.ts` — opens the stream, centre-crops a 1024px square JPEG.
- `src/app/api/develop/route.ts` — posts the capture to OpenRouter's Image API as
  an `input_references` entry, returns the developed photo as a data URL.
- `src/lib/useDevelop.ts` — runs the develop animation **alongside** the request.
  Progress eases to 85%, waits there, then completes once the image lands.
- `src/lib/export.ts` — burns the frame, caption and date stamp into a PNG on
  canvas so the download matches what's on screen.

The AI only does film emulation. The white frame is drawn by the app, which is
what keeps the caption and date stamp in a fixed position across generations.

## Notes

- **Nothing is stored.** The gallery lives in React state for the session only —
  refreshing clears it. Saving a print is the only way to keep it.
- **The viewfinder HUD is decorative.** `getUserMedia` exposes no shutter speed,
  aperture, or ISO. Those readings are hardcoded; static numbers are correct.
