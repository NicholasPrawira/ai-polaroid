/** Parses a standard .cube 3D LUT: red index fastest, then green, then blue. */
export type Lut3D = { size: number; data: Float32Array };

export async function loadCubeLut(url: string): Promise<Lut3D> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load LUT at ${url}`);
  const text = await res.text();

  let size = 0;
  const values: number[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (/^[A-Z]/.test(line)) continue; // other metadata (TITLE, DOMAIN_*, ...)
    const parts = line.split(/\s+/).map(Number);
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }
  if (!size || values.length !== size ** 3 * 3) {
    throw new Error(`Malformed LUT at ${url}`);
  }
  return { size, data: Float32Array.from(values) };
}

/** Trilinear-interpolated lookup — r/g/b in [0, 1]. */
export function sampleLut(lut: Lut3D, r: number, g: number, b: number): [number, number, number] {
  const n = lut.size;
  const rf = r * (n - 1);
  const gf = g * (n - 1);
  const bf = b * (n - 1);
  const r0 = Math.floor(rf);
  const g0 = Math.floor(gf);
  const b0 = Math.floor(bf);
  const r1 = Math.min(r0 + 1, n - 1);
  const g1 = Math.min(g0 + 1, n - 1);
  const b1 = Math.min(b0 + 1, n - 1);
  const rd = rf - r0;
  const gd = gf - g0;
  const bd = bf - b0;

  const idx = (ri: number, gi: number, bi: number) => (ri + gi * n + bi * n * n) * 3;
  const lerp = (a: number, x: number, t: number) => a + (x - a) * t;

  const d = lut.data;
  const c000 = idx(r0, g0, b0);
  const c100 = idx(r1, g0, b0);
  const c010 = idx(r0, g1, b0);
  const c110 = idx(r1, g1, b0);
  const c001 = idx(r0, g0, b1);
  const c101 = idx(r1, g0, b1);
  const c011 = idx(r0, g1, b1);
  const c111 = idx(r1, g1, b1);

  const out: [number, number, number] = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c00 = lerp(d[c000 + ch], d[c100 + ch], rd);
    const c10 = lerp(d[c010 + ch], d[c110 + ch], rd);
    const c01 = lerp(d[c001 + ch], d[c101 + ch], rd);
    const c11 = lerp(d[c011 + ch], d[c111 + ch], rd);
    const c0 = lerp(c00, c10, gd);
    const c1 = lerp(c01, c11, gd);
    out[ch] = lerp(c0, c1, bd);
  }
  return out;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for grading."));
    img.src = src;
  });
}
