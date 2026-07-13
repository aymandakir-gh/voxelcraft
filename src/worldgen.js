// Seeded terrain generation. Pure module: no DOM, no three.js.
import { CHUNK_X, CHUNK_Y, CHUNK_Z, SEA_LEVEL, blockIndex } from './config.js';
import { B } from './blocks.js';
import { fbm2, fbm3, hash2, hash3, smoothstep } from './noise.js';

const MAX_TERRAIN_HEIGHT = CHUNK_Y - 12; // headroom for trees
const TREE_MARGIN = 3;                   // trees can lean into neighbor chunks by this much

export function makeGenerator(seed) {
  seed |= 0;
  const heightCache = new Map();

  function heightAt(x, z) {
    const key = x + ':' + z;
    const cached = heightCache.get(key);
    if (cached !== undefined) return cached;

    const hills = fbm2(seed, x * 0.008, z * 0.008, 5) * 16;
    const mountainMask = smoothstep(0.48, 0.75, fbm2(seed + 11, x * 0.0016, z * 0.0016, 4));
    const mountains = Math.pow(fbm2(seed + 7, x * 0.004, z * 0.004, 5), 1.7) * 52 * mountainMask;
    const h = Math.max(2, Math.min(MAX_TERRAIN_HEIGHT, Math.floor(22 + hills + mountains)));

    if (heightCache.size > 100000) heightCache.clear();
    heightCache.set(key, h);
    return h;
  }

  function isDesert(x, z) {
    return fbm2(seed + 23, x * 0.003, z * 0.003, 3) > 0.62;
  }

  function isCave(x, y, z) {
    return fbm3(seed + 31, x * 0.055, y * 0.085, z * 0.055, 3) > 0.665;
  }

  function treeAt(x, z) {
    if (hash2(seed + 41, x, z) >= 0.006) return null;
    if (isDesert(x, z)) return null;
    const h = heightAt(x, z);
    if (h <= SEA_LEVEL + 1 || h >= 66) return null;
    if (isCave(x, h, z)) return null; // don't root trees over carved ground
    const trunk = 4 + Math.floor(hash2(seed + 43, x, z) * 3); // 4..6
    return { x, z, base: h + 1, trunk };
  }

  // The terrain block at world (x,y,z) before caves, water, and trees
  function baseBlock(x, y, z, h) {
    if (y > h) return B.AIR;
    if (y <= 1 + Math.floor(hash2(seed + 53, x, z) * 2)) return B.BEDROCK;
    const desert = isDesert(x, z);
    if (y === h) {
      if (h >= 64) return B.SNOW;
      if (desert || h <= SEA_LEVEL + 1) return B.SAND;
      return B.GRASS;
    }
    if (y >= h - 3) {
      if (desert || h <= SEA_LEVEL + 1) return B.SAND;
      return B.DIRT;
    }
    // Stone with ore veins
    const r = hash3(seed + 61, x, y, z);
    if (r < 0.007 && y < 44) return B.COAL_ORE;
    if (r >= 0.007 && r < 0.011 && y < 28) return B.IRON_ORE;
    if (r >= 0.011 && r < 0.014) return B.GRAVEL;
    return B.STONE;
  }

  function generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
    const x0 = cx * CHUNK_X, z0 = cz * CHUNK_Z;

    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let lx = 0; lx < CHUNK_X; lx++) {
        const x = x0 + lx, z = z0 + lz;
        const h = heightAt(x, z);
        // Caves may open to the surface on land; under water the ocean floor
        // stays sealed so we never render water floating over a carved hole.
        const carveTop = h > SEA_LEVEL + 1 ? h : h - 2;
        for (let y = 0; y <= h; y++) {
          let id = baseBlock(x, y, z, h);
          if (id !== B.BEDROCK && id !== B.AIR && y > 2 && y <= carveTop && isCave(x, y, z)) {
            id = B.AIR;
          }
          if (id !== B.AIR) data[blockIndex(lx, y, lz)] = id;
        }
        // Fill open terrain up to sea level with water (caves stay air)
        for (let y = h + 1; y <= SEA_LEVEL; y++) {
          data[blockIndex(lx, y, lz)] = B.WATER;
        }
      }
    }

    stampTrees(data, cx, cz);
    return data;
  }

  function stampTrees(data, cx, cz) {
    const x0 = cx * CHUNK_X, z0 = cz * CHUNK_Z;
    const put = (wx, wy, wz, id, force) => {
      const lx = wx - x0, lz = wz - z0;
      if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) return;
      if (wy < 0 || wy >= CHUNK_Y) return;
      const i = blockIndex(lx, wy, lz);
      if (force || data[i] === B.AIR) data[i] = id;
    };

    for (let wz = z0 - TREE_MARGIN; wz < z0 + CHUNK_Z + TREE_MARGIN; wz++) {
      for (let wx = x0 - TREE_MARGIN; wx < x0 + CHUNK_X + TREE_MARGIN; wx++) {
        const tree = treeAt(wx, wz);
        if (!tree) continue;
        const top = tree.base + tree.trunk - 1;
        // Leaf blob: two 5x5-ish layers below the top, a plus-shape on top
        for (let dy = -2; dy <= 1; dy++) {
          const y = top + dy;
          const radius = dy < 0 ? 2 : 1;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (dx === 0 && dz === 0 && dy < 1) continue; // trunk goes here
              const corner = Math.abs(dx) === radius && Math.abs(dz) === radius;
              if (corner && (radius === 1 || hash3(seed + 71, wx + dx, y, wz + dz) < 0.5)) continue;
              put(wx + dx, y, wz + dz, B.LEAVES, false);
            }
          }
        }
        for (let t = 0; t < tree.trunk; t++) {
          put(wx, tree.base + t, wz, B.LOG, true);
        }
      }
    }
  }

  function findSpawn() {
    for (let r = 0; r < 64; r++) {
      const x = 8 + r * 16;
      const h = heightAt(x, 8);
      if (h > SEA_LEVEL + 1 && !isCave(x, h, 8)) {
        return { x: x + 0.5, y: h + 2.01, z: 8.5 };
      }
    }
    return { x: 8.5, y: heightAt(8, 8) + 2.01, z: 8.5 };
  }

  return { seed, heightAt, isDesert, isCave, treeAt, generateChunk, findSpawn };
}
