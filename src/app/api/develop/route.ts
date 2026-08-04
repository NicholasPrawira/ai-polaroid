import { NextRequest, NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompt";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/data";

export const runtime = "nodejs";
// Image generation runs ~10-40s; the platform default would cut it short.
export const maxDuration = 60;

// Overridable so the develop path can be exercised end-to-end against a stub
// instead of spending real money at the real API on every test run.
const OPENROUTER_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1/images";
const DEFAULT_MODEL = "x-ai/grok-imagine-image-quality";

/** Captures are square JPEGs from the viewfinder; this is generous headroom. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

type OpenRouterImageResponse = {
  data?: Array<{ b64_json?: string; media_type?: string; url?: string }>;
  error?: { message?: string } | string;
};

type Decoded = { bytes: Buffer; mediaType: string };

/** Splits a base64 data URL into bytes and its media type. */
function decodeDataUrl(value: string): Decoded | null {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(value);
  if (!match) return null;

  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0) return null;

  return { bytes, mediaType: match[1].toLowerCase() };
}

function extensionFor(mediaType: string): string {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";
  return "png";
}

/** Downloads a returned image so it can be stored rather than hot-linked. */
async function downloadImage(url: string): Promise<Decoded> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download the generated image.");
  const bytes = Buffer.from(await res.arrayBuffer());
  const mediaType = (res.headers.get("content-type") || "image/png")
    .split(";")[0]
    .trim()
    .toLowerCase();
  return { bytes, mediaType };
}

/**
 * Develops a capture and keeps it.
 *
 * This stays a Route Handler rather than becoming a Server Action because
 * Server Action requests are capped at 1MB by default and a captured frame is
 * comfortably larger than that.
 *
 * The ordering matters. The credit is spent before the model is called, so two
 * simultaneous requests cannot both spend the last one; and the raw capture is
 * stored before the model is called, so a develop that fails still leaves the
 * original photograph on disk. A failure refunds the credit — a shot that never
 * produced a print should not cost anything.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set. Add it to .env.local." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof image !== "string") {
    return NextResponse.json(
      { error: "Expected `image` to be a base64 data URL." },
      { status: 400 },
    );
  }

  const capture = decodeDataUrl(image);
  if (!capture) {
    return NextResponse.json(
      { error: "Expected `image` to be a base64 data URL." },
      { status: 400 },
    );
  }

  if (capture.bytes.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  }

  // Spend first. `consume_credit` does the check and the decrement in one
  // statement, so this is also the concurrency guard.
  const { data: remaining, error: creditError } =
    await supabase.rpc("consume_credit");

  if (creditError) {
    return NextResponse.json(
      { error: "You are out of photo credits. Redeem a code to get more." },
      { status: 402 },
    );
  }

  let credits = remaining as number;

  /** Hands the credit back and marks the row, then answers the client. */
  const fail = async (message: string, status: number, photoId?: string) => {
    const { data: refunded } = await supabase.rpc("refund_credit");
    if (typeof refunded === "number") credits = refunded;

    if (photoId) {
      await supabase
        .from("photos")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", photoId);
    }

    return NextResponse.json({ error: message, credits }, { status });
  };

  const { data: row, error: insertError } = await supabase
    .from("photos")
    .insert({ owner_id: user.id, status: "developing" })
    .select("id")
    .single();

  if (insertError || !row) {
    return fail("Could not start the develop.", 500);
  }

  const photoId = row.id as string;
  const rawPath = `${user.id}/${photoId}/raw.${extensionFor(capture.mediaType)}`;

  const { error: rawError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(rawPath, capture.bytes, { contentType: capture.mediaType });

  if (rawError) {
    return fail("Could not save the photo.", 502, photoId);
  }

  await supabase.from("photos").update({ raw_path: rawPath }).eq("id", photoId);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "AI Disposable Camera",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL,
        prompt: buildPrompt(),
        input_references: [{ type: "image_url", image_url: { url: image } }],
      }),
      // Abort if the client cancelled mid-develop.
      signal: req.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      // The capture is already stored, so the roll is not lost — it just has an
      // undeveloped frame on it.
      await supabase.rpc("refund_credit");
      await supabase
        .from("photos")
        .update({ status: "queued" })
        .eq("id", photoId);
      return new NextResponse(null, { status: 499 });
    }
    return fail("Could not reach OpenRouter.", 502, photoId);
  }

  const raw = await upstream.text();
  let body: OpenRouterImageResponse;
  try {
    body = JSON.parse(raw) as OpenRouterImageResponse;
  } catch {
    return fail(
      `Unexpected response from OpenRouter (${upstream.status}).`,
      502,
      photoId,
    );
  }

  if (!upstream.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : (body.error?.message ?? `OpenRouter returned ${upstream.status}.`);
    return fail(message, upstream.status, photoId);
  }

  const first = body.data?.[0];
  let developed: Decoded;

  if (first?.b64_json) {
    developed = {
      bytes: Buffer.from(first.b64_json, "base64"),
      mediaType: (first.media_type || "image/png").toLowerCase(),
    };
  } else if (first?.url) {
    try {
      developed = await downloadImage(first.url);
    } catch {
      return fail("Could not download the generated image.", 502, photoId);
    }
  } else {
    return fail("OpenRouter returned no image data.", 502, photoId);
  }

  const developedPath = `${user.id}/${photoId}/developed.${extensionFor(developed.mediaType)}`;

  const { error: developedError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(developedPath, developed.bytes, {
      contentType: developed.mediaType,
    });

  if (developedError) {
    return fail("Could not save the developed photo.", 502, photoId);
  }

  await supabase
    .from("photos")
    .update({ developed_path: developedPath, status: "done", error: null })
    .eq("id", photoId);

  const { data: signed } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(developedPath, SIGNED_URL_TTL);

  if (!signed?.signedUrl) {
    return NextResponse.json(
      { error: "Saved the photo, but could not open it. Try the gallery." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    id: photoId,
    image: signed.signedUrl,
    credits,
  });
}
