// World dimensions
export const CHUNK_X = 16;
export const CHUNK_Y = 96;
export const CHUNK_Z = 16;
export const SEA_LEVEL = 30;

// Streaming
export const RENDER_DIST = 6;   // chunks meshed & rendered around the player
export const GEN_MARGIN = 1;    // extra ring generated (data only) so border meshes are correct
export const GEN_BUDGET = 3;    // chunks generated per frame
export const MESH_BUDGET = 3;   // chunks meshed per frame

// Player
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;
export const GRAVITY = 26;
export const JUMP_SPEED = 8.8;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 7.0;
export const SNEAK_SPEED = 1.6;
export const FLY_SPEED = 11;
export const REACH = 5;

// Time
export const DAY_LENGTH = 600; // seconds for a full day/night cycle

export function chunkKey(cx, cz) {
  return cx + ',' + cz;
}

export function blockIndex(x, y, z) {
  // x,y,z are chunk-local
  return x + z * CHUNK_X + y * CHUNK_X * CHUNK_Z;
}
