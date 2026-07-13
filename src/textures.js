// Procedural 16x16-tile texture atlas drawn on a canvas. Every texture is
// generated from seeded noise — no image assets anywhere in the project.
import { hash2, hash3 } from './noise.js';

export const TILE = 16;
export const ATLAS_TILES = 16;
export const ATLAS_SIZE = TILE * ATLAS_TILES;

function rgba(r, g, b, a = 255) {
  return [r, g, b, a];
}

function jitter(seed, x, y, salt, amount) {
  return (hash3(seed, x, y, salt) - 0.5) * 2 * amount;
}

// Each painter returns [r,g,b,a] for pixel (x,y) of its tile
function makePainters(seed) {
  const grassGreen = (x, y, salt) => {
    const j = jitter(seed, x, y, salt, 18);
    return rgba(96 + j * 0.6, 158 + j, 66 + j * 0.5);
  };
  const dirtBrown = (x, y, salt) => {
    const j = jitter(seed, x, y, salt, 20);
    return rgba(134 + j, 96 + j * 0.8, 62 + j * 0.6);
  };
  const stoneGrey = (x, y, salt) => {
    const j = jitter(seed, x, y, salt, 14);
    const blotch = hash3(seed, x >> 2, y >> 2, salt + 9) > 0.5 ? 6 : -6;
    const v = 128 + j + blotch;
    return rgba(v, v, v + 2);
  };
  const sandy = (x, y, salt) => {
    const j = jitter(seed, x, y, salt, 12);
    return rgba(219 + j * 0.5, 206 + j * 0.5, 156 + j);
  };
  const snowy = (x, y, salt) => {
    const j = jitter(seed, x, y, salt, 8);
    const v = 240 + j;
    return rgba(v, v, Math.min(255, v + 6));
  };

  const grassSideOver = (x, y, salt, base) => {
    const edge = 3 + Math.floor(hash3(seed, x, 0, salt + 5) * 3); // jagged 3..5
    if (y < edge) return grassGreen(x, y, salt + 1);
    return base(x, y, salt);
  };

  return {
    grass_top: (x, y) => grassGreen(x, y, 1),
    grass_side: (x, y) => grassSideOver(x, y, 2, dirtBrown),
    dirt: (x, y) => dirtBrown(x, y, 3),
    stone: (x, y) => stoneGrey(x, y, 4),
    cobble: (x, y) => {
      // 4x4-ish stones with dark grout
      const gx = x % 5, gy = y % 5;
      if (gx === 0 || gy === 0) return rgba(74, 74, 76);
      const c = stoneGrey(x, y, 5);
      const cell = hash3(seed, Math.floor(x / 5), Math.floor(y / 5), 15) * 30 - 15;
      return rgba(c[0] + cell, c[1] + cell, c[2] + cell);
    },
    sand: (x, y) => sandy(x, y, 6),
    water: (x, y) => {
      const j = jitter(seed, x, y, 7, 14);
      const wave = Math.sin((x + y * 2) * 0.9) * 8;
      return rgba(50 + j * 0.4, 96 + j * 0.6 + wave * 0.4, 190 + j + wave, 255);
    },
    log_side: (x, y) => {
      const streak = hash3(seed, x, 0, 8) * 26 - 13;
      const ring = (x % 4 === 0) ? -18 : 0;
      const j = jitter(seed, x, y, 8, 8);
      return rgba(106 + streak + ring + j, 78 + streak * 0.7 + ring + j * 0.7, 48 + ring * 0.5 + j * 0.4);
    },
    log_top: (x, y) => {
      const dx = x - 7.5, dy = y - 7.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ring = (Math.floor(r) % 2 === 0) ? 14 : -8;
      const j = jitter(seed, x, y, 9, 6);
      if (r > 7.2) return rgba(96 + j, 70 + j * 0.7, 44);
      return rgba(178 + ring + j, 142 + ring + j * 0.8, 96 + ring * 0.5);
    },
    leaves: (x, y) => {
      const j = jitter(seed, x, y, 10, 26);
      const hole = hash3(seed, x, y, 20) > 0.86;
      if (hole) return rgba(24, 48, 20);
      return rgba(48 + j * 0.4, 118 + j, 44 + j * 0.4);
    },
    plank: (x, y) => {
      const board = Math.floor(y / 4);
      const groove = y % 4 === 3 ? -26 : 0;
      const grain = hash3(seed, x, board, 11) * 16 - 8;
      const j = jitter(seed, x, y, 11, 5);
      return rgba(180 + grain + groove + j, 146 + grain + groove + j * 0.8, 96 + grain * 0.6 + groove * 0.6);
    },
    glass: (x, y) => {
      const frame = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
      if (frame) return rgba(214, 230, 236, 255);
      const sparkle = (x + y) % 7 === 0 && hash3(seed, x, y, 12) > 0.6;
      if (sparkle) return rgba(240, 250, 252, 140);
      return rgba(200, 226, 234, 28);
    },
    bedrock: (x, y) => {
      const j = jitter(seed, x, y, 13, 22);
      const blotch = hash3(seed, x >> 1, y >> 1, 13) > 0.5 ? 14 : -14;
      const v = 62 + j + blotch;
      return rgba(v, v, v + 3);
    },
    coal_ore: (x, y) => {
      const cluster = hash3(seed, x >> 1, y >> 1, 14) > 0.78;
      if (cluster && hash3(seed, x, y, 24) > 0.35) return rgba(28, 28, 30);
      return stoneGrey(x, y, 4);
    },
    iron_ore: (x, y) => {
      const cluster = hash3(seed, x >> 1, y >> 1, 16) > 0.8;
      if (cluster && hash3(seed, x, y, 26) > 0.35) return rgba(216, 172, 138);
      return stoneGrey(x, y, 4);
    },
    snow: (x, y) => snowy(x, y, 17),
    snow_side: (x, y) => (y < 4 ? snowy(x, y, 17) : dirtBrown(x, y, 18)),
    gravel: (x, y) => {
      const pebble = hash3(seed, x >> 1, y >> 1, 19) * 40 - 20;
      const j = jitter(seed, x, y, 19, 10);
      return rgba(126 + pebble + j, 118 + pebble + j, 108 + pebble * 0.8 + j);
    },
    brick: (x, y) => {
      const row = Math.floor(y / 4);
      const offset = row % 2 === 0 ? 0 : 4;
      const mortarY = y % 4 === 0;
      const mortarX = (x + offset) % 8 === 0;
      if (mortarY || mortarX) return rgba(188, 180, 172);
      const j = jitter(seed, x, y, 21, 10);
      const brickTint = hash3(seed, Math.floor((x + offset) / 8), row, 21) * 24 - 12;
      return rgba(158 + brickTint + j, 74 + brickTint * 0.6 + j * 0.6, 62 + j * 0.4);
    },
  };
}

// Order must match the T tile ids in blocks.js
const TILE_ORDER = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobble', 'sand', 'water',
  'log_side', 'log_top', 'leaves', 'plank', 'glass', 'bedrock', 'coal_ore',
  'iron_ore', 'snow', 'snow_side', 'gravel', 'brick',
];

export function buildAtlasCanvas(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
  const painters = makePainters(seed);

  TILE_ORDER.forEach((name, tileIdx) => {
    const paint = painters[name];
    const ox = (tileIdx % ATLAS_TILES) * TILE;
    const oy = Math.floor(tileIdx / ATLAS_TILES) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const [r, g, b, a] = paint(x, y);
        const i = ((oy + y) * ATLAS_SIZE + (ox + x)) * 4;
        img.data[i] = clamp255(r);
        img.data[i + 1] = clamp255(g);
        img.data[i + 2] = clamp255(b);
        img.data[i + 3] = a === undefined ? 255 : clamp255(a);
      }
    }
  });

  ctx.putImageData(img, 0, 0);
  return canvas;
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Draw a small isometric block preview (for the hotbar) from atlas tiles
export function drawBlockIcon(ctx, atlas, size, topTile, sideTile) {
  const t = (idx) => ({
    sx: (idx % ATLAS_TILES) * TILE,
    sy: Math.floor(idx / ATLAS_TILES) * TILE,
  });
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  const w = size * 0.5, h = size * 0.25;
  const cx = size / 2, cy = size / 2;

  const top = t(topTile), side = t(sideTile);
  // top face (diamond)
  ctx.save();
  ctx.setTransform(1, 0.5, -1, 0.5, cx, cy - h);
  ctx.drawImage(atlas, top.sx, top.sy, TILE, TILE, -w / 2, -w / 2, w, w);
  ctx.restore();
  // left face
  ctx.save();
  ctx.setTransform(1, 0.5, 0, 1.15, cx - w / 2, cy - h / 2 + 1);
  ctx.globalAlpha = 0.75;
  ctx.drawImage(atlas, side.sx, side.sy, TILE, TILE, 0, 0, w / 2 + 1, w / 2);
  ctx.restore();
  // right face
  ctx.save();
  ctx.setTransform(1, -0.5, 0, 1.15, cx, cy + 1);
  ctx.globalAlpha = 0.6;
  ctx.drawImage(atlas, side.sx, side.sy, TILE, TILE, 0, 0, w / 2 + 1, w / 2);
  ctx.restore();
  ctx.globalAlpha = 1;
}
