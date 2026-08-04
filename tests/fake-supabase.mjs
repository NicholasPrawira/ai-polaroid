/**
 * A stand-in Supabase gateway for end-to-end tests.
 *
 * Docker is unreachable in this environment, so `supabase start` cannot pull the
 * real stack. This puts back the smallest surface the app actually talks to,
 * routed under one origin the way Supabase does:
 *
 *   /rest/v1/*      → a REAL PostgREST against a REAL Postgres. Every query the
 *                     app makes is executed for real, and every row level
 *                     security policy in the migrations is enforced for real.
 *   /auth/v1/*      → a test double. It issues the same HS256 JWTs PostgREST
 *                     validates, so identity flows through to `auth.uid()`
 *                     exactly as in production, but it is not GoTrue.
 *   /storage/v1/*   → a test double over the local filesystem. It applies the
 *                     same ownership rule as the storage RLS policy — the first
 *                     path segment must be the caller — but it is not Storage.
 *
 * What that means for a passing test: the app's own logic, queries, policies and
 * SQL functions are genuinely exercised. The two doubled services are not, and
 * the parts of them that matter are covered by tests/db/security.test.sql
 * instead.
 */
import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pg from "pg";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const PGRST = process.env.PGRST_URL ?? "http://127.0.0.1:3001";
const JWT_SECRET =
  process.env.FAKE_JWT_SECRET ?? "super-secret-jwt-token-for-tests-only-x";
const FILES = process.env.FAKE_STORAGE_DIR ?? "/tmp/fake-supabase-storage";

const db = new pg.Pool({
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
  database: process.env.PGDATABASE ?? "apptest",
});

/* ----------------------------------------------------------------- tokens */

const b64url = (buf) =>
  Buffer.from(buf).toString("base64url").replace(/=+$/, "");

function sign(claims) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const sig = b64url(createHmac("sha256", JWT_SECRET).update(data).digest());
  return `${data}.${sig}`;
}

function verify(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;

  const expected = b64url(
    createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest(),
  );
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  if (claims.exp && claims.exp * 1000 < Date.now()) return null;
  return claims;
}

function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const access = sign({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 3600,
  });
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh-${user.id}`,
    user: {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
}

/* ------------------------------------------------------------------- users */

/** Signing in creates the account if it is new, which fires the signup trigger. */
async function upsertUser(email) {
  const found = await db.query("select id, email from auth.users where lower(email) = lower($1)", [email]);
  if (found.rows.length > 0) return found.rows[0];

  const created = await db.query(
    "insert into auth.users (id, email) values ($1, $2) returning id, email",
    [randomUUID(), email.toLowerCase()],
  );
  return created.rows[0];
}

/** Magic links, held in memory for the test to read back. */
const pendingTokens = new Map();
export const issued = pendingTokens;

/* ----------------------------------------------------------------- helpers */

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "*",
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function bearer(req) {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return verify(token);
}

/* ------------------------------------------------------------------- auth */

async function handleAuth(req, res, url) {
  const path = url.pathname.replace("/auth/v1", "");

  // signInWithOtp: record a link the test can follow, like an inbox would.
  if (path === "/otp" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const email = String(body.email ?? "").toLowerCase();
    const tokenHash = randomUUID().replace(/-/g, "");
    pendingTokens.set(tokenHash, email);
    const redirect = body.gotrue_meta_security?.redirect_to ?? body.options?.emailRedirectTo ?? "";
    console.log(
      `MAGICLINK ${email} ${tokenHash} ${redirect}`,
    );
    return json(res, 200, {});
  }

  // verifyOtp
  if (path === "/verify" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const email = pendingTokens.get(body.token_hash ?? body.token);
    if (!email) {
      return json(res, 403, { error: "invalid_token", error_description: "Link expired." });
    }
    pendingTokens.delete(body.token_hash ?? body.token);
    const user = await upsertUser(email);
    return json(res, 200, sessionFor(user));
  }

  if (path === "/user" && req.method === "GET") {
    const claims = bearer(req);
    if (!claims) return json(res, 401, { message: "invalid claim" });
    const found = await db.query("select id, email from auth.users where id = $1", [claims.sub]);
    if (found.rows.length === 0) return json(res, 401, { message: "user not found" });
    return json(res, 200, sessionFor(found.rows[0]).user);
  }

  if (path === "/token" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const id = String(body.refresh_token ?? "").replace(/^refresh-/, "");
    const found = await db.query("select id, email from auth.users where id = $1", [id]);
    if (found.rows.length === 0) {
      return json(res, 400, { error: "invalid_grant" });
    }
    return json(res, 200, sessionFor(found.rows[0]));
  }

  if (path === "/logout") return json(res, 204, {});

  return json(res, 404, { message: `no auth route ${path}` });
}

/* ---------------------------------------------------------------- storage */

/**
 * Mirrors the storage RLS policy from the migration: the first path segment
 * names the owner, and nobody may touch another account's segment.
 */
function ownsPath(claims, objectPath) {
  return claims && objectPath.split("/")[0] === claims.sub;
}

const signedLinks = new Map();

async function handleStorage(req, res, url) {
  const path = url.pathname.replace("/storage/v1", "");

  // Reading back through a signed link — no Authorization header involved,
  // which is the whole point of signing it.
  if (req.method === "GET" && path.startsWith("/object/sign/")) {
    const token = url.searchParams.get("token");
    const target = signedLinks.get(token);
    if (!target || target.expires < Date.now()) {
      return json(res, 400, { error: "Invalid or expired token" });
    }
    try {
      const bytes = await readFile(join(FILES, target.bucket, target.path));
      res.writeHead(200, {
        "content-type": target.contentType,
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      });
      return res.end(bytes);
    } catch {
      return json(res, 404, { error: "Object not found" });
    }
  }

  const claims = bearer(req);
  if (!claims) return json(res, 401, { message: "not authorised" });

  // createSignedUrls — many paths at once.
  const bulkSign = /^\/object\/sign\/([^/]+)$/.exec(path);
  if (req.method === "POST" && bulkSign) {
    const bucket = bulkSign[1];
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    const expiresIn = Number(body.expiresIn ?? 3600);

    const out = (body.paths ?? []).map((p) => {
      if (!ownsPath(claims, p)) return { path: p, error: "not found", signedURL: null };
      const token = randomUUID();
      signedLinks.set(token, {
        bucket,
        path: p,
        contentType: contentTypes.get(`${bucket}/${p}`) ?? "image/png",
        expires: Date.now() + expiresIn * 1000,
      });
      return { path: p, error: null, signedURL: `/object/sign/${bucket}/${p}?token=${token}` };
    });
    return json(res, 200, out);
  }

  // createSignedUrl — a single path.
  const oneSign = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path);
  if (req.method === "POST" && oneSign) {
    const [, bucket, objectPath] = oneSign;
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    if (!ownsPath(claims, objectPath)) return json(res, 404, { error: "Object not found" });

    const token = randomUUID();
    signedLinks.set(token, {
      bucket,
      path: objectPath,
      contentType: contentTypes.get(`${bucket}/${objectPath}`) ?? "image/png",
      expires: Date.now() + Number(body.expiresIn ?? 3600) * 1000,
    });
    return json(res, 200, {
      signedURL: `/object/sign/${bucket}/${objectPath}?token=${token}`,
    });
  }

  // remove
  if (req.method === "DELETE" && /^\/object\/([^/]+)$/.test(path)) {
    const bucket = /^\/object\/([^/]+)$/.exec(path)[1];
    const body = JSON.parse((await readBody(req)).toString() || "{}");
    for (const p of body.prefixes ?? []) {
      if (!ownsPath(claims, p)) return json(res, 403, { error: "not authorised" });
      await rm(join(FILES, bucket, p), { force: true });
    }
    return json(res, 200, []);
  }

  // upload
  const upload = /^\/object\/([^/]+)\/(.+)$/.exec(path);
  if ((req.method === "POST" || req.method === "PUT") && upload) {
    const [, bucket, objectPath] = upload;
    if (!ownsPath(claims, objectPath)) {
      return json(res, 403, { error: "new row violates row-level security policy" });
    }
    const bytes = await readBody(req);
    const target = join(FILES, bucket, objectPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    contentTypes.set(
      `${bucket}/${objectPath}`,
      req.headers["content-type"] ?? "application/octet-stream",
    );
    return json(res, 200, { Key: `${bucket}/${objectPath}`, path: objectPath });
  }

  return json(res, 404, { message: `no storage route ${req.method} ${path}` });
}

const contentTypes = new Map();

/* -------------------------------------------------------------- postgrest */

async function handleRest(req, res, url) {
  const target = `${PGRST}${url.pathname.replace("/rest/v1", "")}${url.search}`;
  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);

  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  // PostgREST reads the role and the subject straight out of this token, which
  // is what makes auth.uid() and the RLS policies behave as they do live.
  if (!headers.authorization && headers.apikey) {
    headers.authorization = `Bearer ${headers.apikey}`;
  }

  const upstream = await fetch(target, { method: req.method, headers, body });
  const buf = Buffer.from(await upstream.arrayBuffer());

  const out = {};
  upstream.headers.forEach((v, k) => {
    if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) {
      out[k] = v;
    }
  });
  out["access-control-allow-origin"] = "*";
  res.writeHead(upstream.status, out);
  res.end(buf);
}

/* ------------------------------------------------------------------ server */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
    return res.end();
  }

  try {
    // Test-only side doors. A real deployment has an inbox and a SQL console
    // for these; a test needs them reachable over HTTP.
    if (url.pathname === "/test/magiclink") {
      const email = (url.searchParams.get("email") ?? "").toLowerCase();
      for (const [token, addressed] of [...pendingTokens].reverse()) {
        if (addressed === email) return json(res, 200, { token });
      }
      return json(res, 404, { error: "no link issued for that address" });
    }

    // Lets a test assert on what was actually written, rather than on what the
    // UI claims was written.
    if (url.pathname === "/test/photos") {
      const email = (url.searchParams.get("email") ?? "").toLowerCase();
      const result = await db.query(
        `select p.id, p.status, p.raw_path, p.developed_path, p.folder_id
           from public.photos p
           join public.profiles pr on pr.id = p.owner_id
          where lower(pr.email) = $1
          order by p.taken_at desc`,
        [email],
      );
      return json(res, 200, result.rows);
    }

    if (url.pathname === "/test/promote") {
      const email = (url.searchParams.get("email") ?? "").toLowerCase();
      const result = await db.query(
        "update public.profiles set is_admin = true where lower(email) = $1 returning id",
        [email],
      );
      return json(res, 200, { promoted: result.rowCount });
    }

    if (url.pathname.startsWith("/auth/v1")) return await handleAuth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await handleStorage(req, res, url);
    if (url.pathname.startsWith("/rest/v1")) return await handleRest(req, res, url);
    return json(res, 404, { message: "not found" });
  } catch (err) {
    console.error("fake-supabase error", err);
    return json(res, 500, { message: String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`fake supabase on http://127.0.0.1:${PORT}`);
});
