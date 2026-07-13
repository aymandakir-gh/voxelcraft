// Block registry. Texture tile indices refer to the procedural atlas in textures.js.
// Pure module: no DOM, no three.js.

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  WATER: 6,
  LOG: 7,
  LEAVES: 8,
  PLANK: 9,
  GLASS: 10,
  BEDROCK: 11,
  COAL_ORE: 12,
  IRON_ORE: 13,
  SNOW: 14,
  GRAVEL: 15,
  BRICK: 16,
};

// Atlas tile ids (16x16 tiles laid out in a 16-wide grid)
export const T = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  WATER: 6,
  LOG_SIDE: 7,
  LOG_TOP: 8,
  LEAVES: 9,
  PLANK: 10,
  GLASS: 11,
  BEDROCK: 12,
  COAL_ORE: 13,
  IRON_ORE: 14,
  SNOW: 15,
  SNOW_SIDE: 16,
  GRAVEL: 17,
  BRICK: 18,
};

// def: name, solid (collides), opaque (culls neighbor faces), water (translucent pass),
// tiles [top, bottom, side]
export const BLOCKS = {
  [B.AIR]:      { name: 'air',       solid: false, opaque: false },
  [B.GRASS]:    { name: 'grass',     solid: true,  opaque: true,  tiles: [T.GRASS_TOP, T.DIRT, T.GRASS_SIDE] },
  [B.DIRT]:     { name: 'dirt',      solid: true,  opaque: true,  tiles: [T.DIRT, T.DIRT, T.DIRT] },
  [B.STONE]:    { name: 'stone',     solid: true,  opaque: true,  tiles: [T.STONE, T.STONE, T.STONE] },
  [B.COBBLE]:   { name: 'cobble',    solid: true,  opaque: true,  tiles: [T.COBBLE, T.COBBLE, T.COBBLE] },
  [B.SAND]:     { name: 'sand',      solid: true,  opaque: true,  tiles: [T.SAND, T.SAND, T.SAND] },
  [B.WATER]:    { name: 'water',     solid: false, opaque: false, water: true, tiles: [T.WATER, T.WATER, T.WATER] },
  [B.LOG]:      { name: 'log',       solid: true,  opaque: true,  tiles: [T.LOG_TOP, T.LOG_TOP, T.LOG_SIDE] },
  [B.LEAVES]:   { name: 'leaves',    solid: true,  opaque: true,  tiles: [T.LEAVES, T.LEAVES, T.LEAVES] },
  [B.PLANK]:    { name: 'planks',    solid: true,  opaque: true,  tiles: [T.PLANK, T.PLANK, T.PLANK] },
  [B.GLASS]:    { name: 'glass',     solid: true,  opaque: false, tiles: [T.GLASS, T.GLASS, T.GLASS] },
  [B.BEDROCK]:  { name: 'bedrock',   solid: true,  opaque: true,  unbreakable: true, tiles: [T.BEDROCK, T.BEDROCK, T.BEDROCK] },
  [B.COAL_ORE]: { name: 'coal ore',  solid: true,  opaque: true,  tiles: [T.COAL_ORE, T.COAL_ORE, T.COAL_ORE] },
  [B.IRON_ORE]: { name: 'iron ore',  solid: true,  opaque: true,  tiles: [T.IRON_ORE, T.IRON_ORE, T.IRON_ORE] },
  [B.SNOW]:     { name: 'snow',      solid: true,  opaque: true,  tiles: [T.SNOW, T.DIRT, T.SNOW_SIDE] },
  [B.GRAVEL]:   { name: 'gravel',    solid: true,  opaque: true,  tiles: [T.GRAVEL, T.GRAVEL, T.GRAVEL] },
  [B.BRICK]:    { name: 'bricks',    solid: true,  opaque: true,  tiles: [T.BRICK, T.BRICK, T.BRICK] },
};

export function isSolid(id) {
  const d = BLOCKS[id];
  return d ? d.solid : false;
}

export function isOpaque(id) {
  const d = BLOCKS[id];
  return d ? d.opaque : false;
}

// Blocks the player can put in the hotbar
export const HOTBAR = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANK, B.LOG, B.LEAVES, B.SAND, B.GLASS,
];

// tiles[] is [top, bottom, side]; face: 0..5 = +x,-x,+y,-y,+z,-z
export function tileForFace(id, face) {
  const tiles = BLOCKS[id].tiles;
  if (face === 2) return tiles[0];
  if (face === 3) return tiles[1];
  return tiles[2];
}
