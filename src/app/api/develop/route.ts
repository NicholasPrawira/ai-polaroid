import { NextRequest, NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompt";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Image generation runs ~10-40s; the platform default would cut it short.
export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/images";
const DEFAULT_MODEL = "x-ai/grok-imagine-image-quality";

type OpenRouterImageResponse = {
  data?: Array<{ b64_json?: string; media_type?: string; url?: string }>;
  error?: { message?: string } | string;
};

/** Downloads a returned image so the client always gets an inline data URL.
 *  A remote URL would taint the export canvas and break Save to Gallery. */
async function inlineRemoteImage(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download the generated image.");
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "image/png";
  return `data:${type};base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set. Add it to .env.local." },
      { status: 500 },
    );
  }

  let image: unknown;
  try {
    ({ image } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Expected `image` to be a base64 data URL." },
      { status: 400 },
    );
  }

  // /camera is auth-gated, but this API route is a public endpoint in its
  // own right — it has to check the session itself rather than trust that
  // only signed-in users can ever reach it.
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Atomic in Postgres: checks quota and decrements in one statement, so
  // concurrent requests can't both pass the check before either commits.
  const { data: allowed, error: quotaError } = await supabase.rpc(
    "consume_photo_quota",
  );
  if (quotaError) {
    return NextResponse.json({ error: quotaError.message }, { status: 500 });
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "You're out of photos. Ask the admin for more." },
      { status: 403 },
    );
  }

  const model = process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_MODEL;

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Capture Memory",
      },
      body: JSON.stringify({
        model,
        prompt: buildPrompt(),
        input_references: [{ type: "image_url", image_url: { url: image } }],
      }),
      // Abort if the client cancelled mid-develop.
      signal: req.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      { error: "Could not reach OpenRouter." },
      { status: 502 },
    );
  }

  const raw = await upstream.text();
  let body: OpenRouterImageResponse;
  try {
    body = JSON.parse(raw) as OpenRouterImageResponse;
  } catch {
    return NextResponse.json(
      { error: `Unexpected response from OpenRouter (${upstream.status}).` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    // OpenRouter's error text can include account/billing details (key
    // limits, dashboard links) that mean nothing to an end user and expose
    // infrastructure that isn't theirs to see. Log the real reason for
    // debugging, but only ever show a generic message on the client.
    const upstreamMessage =
      typeof body.error === "string"
        ? body.error
        : (body.error?.message ?? `OpenRouter returned ${upstream.status}.`);
    console.error("OpenRouter develop request failed:", upstreamMessage);
    return NextResponse.json(
      { error: "Couldn't develop this photo right now. Please try again." },
      { status: upstream.status },
    );
  }

  const first = body.data?.[0];
  if (first?.b64_json) {
    const mediaType = first.media_type || "image/png";
    return NextResponse.json({
      image: `data:${mediaType};base64,${first.b64_json}`,
    });
  }
  if (first?.url) {
    try {
      return NextResponse.json({ image: await inlineRemoteImage(first.url) });
    } catch {
      return NextResponse.json(
        { error: "Could not download the generated image." },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    { error: "OpenRouter returned no image data." },
    { status: 502 },
  );
}
