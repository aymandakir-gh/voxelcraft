// Deterministic integer hashing + value noise + fractal Brownian motion.
// Pure module: no DOM, no three.js. All noise is seeded and reproducible.

function avalanche(x) {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

// Hash integer lattice coordinates to [0, 1)
export function hash2(seed, x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 962287) ;
  return avalanche(h) / 4294967296;
}

export function hash3(seed, x, y, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 2246822519) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 962287);
  return avalanche(h) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Bilinear value noise, output [0, 1)
export function valueNoise2(seed, x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = smooth(xf), v = smooth(zf);
  const a = hash2(seed, xi, zi);
  const b = hash2(seed, xi + 1, zi);
  const c = hash2(seed, xi, zi + 1);
  const d = hash2(seed, xi + 1, zi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

// Trilinear value noise, output [0, 1)
export function valueNoise3(seed, x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
  const c000 = hash3(seed, xi, yi, zi);
  const c100 = hash3(seed, xi + 1, yi, zi);
  const c010 = hash3(seed, xi, yi + 1, zi);
  const c110 = hash3(seed, xi + 1, yi + 1, zi);
  const c001 = hash3(seed, xi, yi, zi + 1);
  const c101 = hash3(seed, xi + 1, yi, zi + 1);
  const c011 = hash3(seed, xi, yi + 1, zi + 1);
  const c111 = hash3(seed, xi + 1, yi + 1, zi + 1);
  return lerp(
    lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
    lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
    w
  );
}

// Fractal noise, output normalized to [0, 1)
export function fbm2(seed, x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(seed + i * 101, x * freq, z * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function fbm3(seed, x, y, z, octaves = 3, lacunarity = 2, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(seed + i * 101, x * freq, y * freq, z * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Hash an arbitrary string to a 32-bit seed
export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
