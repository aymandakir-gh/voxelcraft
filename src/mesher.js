// Chunk mesher: emits face-culled quads with per-vertex baked AO into plain
// arrays (positions/normals/uvs/colors/indices), split into an opaque/cutout
// bucket and a translucent water bucket. Pure module: no DOM, no three.js.
import { CHUNK_X, CHUNK_Y, CHUNK_Z } from './config.js';
import { B, BLOCKS, isOpaque, isSolid, tileForFace } from './blocks.js';

const ATLAS_TILES = 16;      // tiles per atlas row/column
const UV_INSET = 0.02;       // fraction of a tile, guards against edge bleed

// face: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
const FACES = [
  { n: [1, 0, 0],  u: [0, 0, -1], v: [0, 1, 0], light: 0.62 },
  { n: [-1, 0, 0], u: [0, 0, 1],  v: [0, 1, 0], light: 0.62 },
  { n: [0, 1, 0],  u: [1, 0, 0],  v: [0, 0, -1], light: 1.0 },
  { n: [0, -1, 0], u: [1, 0, 0],  v: [0, 0, 1], light: 0.5 },
  { n: [0, 0, 1],  u: [1, 0, 0],  v: [0, 1, 0], light: 0.8 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], light: 0.8 },
];

// Corner offsets in (u,v) face-space for the 4 quad vertices
const CORNERS = [ [-1, -1], [1, -1], [1, 1], [-1, 1] ];

const AO_LEVELS = [0.5, 0.66, 0.82, 1.0];

function makeBucket() {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

// getBlock(x,y,z) takes world coordinates. cx/cz are the chunk to mesh.
export function meshChunk(getBlock, cx, cz) {
  const solid = makeBucket();
  const water = makeBucket();
  const x0 = cx * CHUNK_X, z0 = cz * CHUNK_Z;

  for (let y = 0; y < CHUNK_Y; y++) {
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let lx = 0; lx < CHUNK_X; lx++) {
        const x = x0 + lx, z = z0 + lz;
        const id = getBlock(x, y, z);
        if (id === B.AIR) continue;
        const isWater = BLOCKS[id].water === true;
        const bucket = isWater ? water : solid;

        for (let face = 0; face < 6; face++) {
          const f = FACES[face];
          const nId = getBlock(x + f.n[0], y + f.n[1], z + f.n[2]);
          if (!faceVisible(id, nId)) continue;
          emitFace(bucket, getBlock, x, y, z, face, f, id, isWater);
        }
      }
    }
  }

  return { solid: finalize(solid), water: finalize(water) };
}

function faceVisible(id, neighborId) {
  if (neighborId === id) return false;        // no faces between identical blocks (water-water, glass-glass)
  return !isOpaque(neighborId);
}

function emitFace(bucket, getBlock, x, y, z, face, f, id, isWater) {
  const tile = tileForFace(id, face);
  const tu = tile % ATLAS_TILES, tv = Math.floor(tile / ATLAS_TILES);
  const s = 1 / ATLAS_TILES;
  const u0 = tu * s + UV_INSET * s, u1 = (tu + 1) * s - UV_INSET * s;
  // Atlas row 0 is at the top of the texture; three.js UV v=1 is the top
  const v1 = 1 - tv * s - UV_INSET * s, v0 = 1 - (tv + 1) * s + UV_INSET * s;
  const uvCorners = [ [u0, v0], [u1, v0], [u1, v1], [u0, v1] ];

  // Center of the face in world space
  const cxp = x + 0.5 + f.n[0] * 0.5;
  const cyp = y + 0.5 + f.n[1] * 0.5;
  const czp = z + 0.5 + f.n[2] * 0.5;

  const base = bucket.positions.length / 3;
  const ao = [0, 0, 0, 0];

  for (let c = 0; c < 4; c++) {
    const [su, sv] = CORNERS[c];
    const px = cxp + (f.u[0] * su + f.v[0] * sv) * 0.5;
    const py = cyp + (f.u[1] * su + f.v[1] * sv) * 0.5;
    const pz = czp + (f.u[2] * su + f.v[2] * sv) * 0.5;
    bucket.positions.push(px, py, pz);
    bucket.normals.push(f.n[0], f.n[1], f.n[2]);
    bucket.uvs.push(uvCorners[c][0], uvCorners[c][1]);

    let aoLevel = 3;
    if (!isWater) {
      const s1 = occludes(getBlock(x + f.n[0] + f.u[0] * su, y + f.n[1] + f.u[1] * su, z + f.n[2] + f.u[2] * su));
      const s2 = occludes(getBlock(x + f.n[0] + f.v[0] * sv, y + f.n[1] + f.v[1] * sv, z + f.n[2] + f.v[2] * sv));
      const co = occludes(getBlock(
        x + f.n[0] + f.u[0] * su + f.v[0] * sv,
        y + f.n[1] + f.u[1] * su + f.v[1] * sv,
        z + f.n[2] + f.u[2] * su + f.v[2] * sv
      ));
      aoLevel = (s1 && s2) ? 0 : 3 - (s1 + s2 + co);
    }
    ao[c] = aoLevel;
    const l = f.light * AO_LEVELS[aoLevel];
    bucket.colors.push(l, l, l);
  }

  // Flip the quad diagonal when needed so AO interpolates without artifacts
  if (ao[0] + ao[2] > ao[1] + ao[3]) {
    bucket.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  } else {
    bucket.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  }
}

function occludes(id) {
  return (isSolid(id) && isOpaque(id)) ? 1 : 0;
}

function finalize(bucket) {
  return {
    positions: new Float32Array(bucket.positions),
    normals: new Float32Array(bucket.normals),
    uvs: new Float32Array(bucket.uvs),
    colors: new Float32Array(bucket.colors),
    indices: bucket.positions.length / 3 > 65535
      ? new Uint32Array(bucket.indices)
      : new Uint16Array(bucket.indices),
  };
}
