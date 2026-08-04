/**
 * Stands in for OpenRouter's Image API during end-to-end tests.
 *
 * The real endpoint costs money per call and takes 10-40s, neither of which
 * belongs in a test run. This returns the same response shape immediately, so
 * everything downstream of the model — storing the print, spending the credit,
 * filing it, reading it back — is exercised for real.
 *
 * Set `STUB_MODE` to make it misbehave on purpose:
 *   ok     (default) a 1x1 PNG, as `b64_json`
 *   url    the same image, but referenced by URL so the download path runs
 *   error  a 500, to check the credit is refunded
 */
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 8787);

// Smallest valid PNG. Deliberately not square-1024 like the capture, so a test
// can tell the developed file apart from the raw one.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let mode = process.env.STUB_MODE ?? "ok";

const server = createServer((req, res) => {
  // Lets a test switch the failure mode mid-run without a restart.
  if (req.url === "/_mode" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      mode = JSON.parse(body || "{}").mode ?? "ok";
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ mode }));
    });
    return;
  }

  if (req.url === "/image.png") {
    res.writeHead(200, { "content-type": "image/png" });
    res.end(Buffer.from(PNG_BASE64, "base64"));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    if (mode === "error") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Stubbed failure." } }));
      return;
    }

    // Record what the app actually sent, so a test can assert the prompt and
    // the reference image made it across intact.
    let received = {};
    try {
      received = JSON.parse(body);
    } catch {
      // Left empty; the assertion in the test will fail loudly enough.
    }
    lastRequest = received;

    if (mode === "url") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: [{ url: `http://127.0.0.1:${PORT}/image.png` }],
        }),
      );
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: [{ b64_json: PNG_BASE64, media_type: "image/png" }],
      }),
    );
  });
});

let lastRequest = {};

// A side door so tests can read back the last request the app made.
const inspector = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(lastRequest));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`stub openrouter on http://127.0.0.1:${PORT}`);
});
inspector.listen(PORT + 1, "127.0.0.1");
