import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveWithCollisions, raycastVoxel, aabbOverlapsBlock } from '../src/physics.js';
import { B } from '../src/blocks.js';

// Flat floor at y=9 (solid for y <= 9)
const floor = (x, y, z) => y <= 9;

test('falling player lands on the floor and stops', () => {
  const pos = { x: 0.5, y: 14, z: 0.5 };
  const vel = { x: 0, y: -20, z: 0 };
  let onGround = false;
  // Gravity is applied every frame before moving, exactly as player.js does;
  // the resulting tiny downward step is what keeps ground contact asserted.
  for (let i = 0; i < 60; i++) {
    vel.y -= 26 / 60;
    const r = moveWithCollisions(floor, pos, vel, 1 / 60, 0.6, 1.8);
    onGround = r.onGround;
  }
  assert.ok(onGround, 'player never landed');
  assert.ok(Math.abs(pos.y - 10) < 0.01, `expected feet at y=10, got ${pos.y}`);
  assert.equal(vel.y, 0);
});

test('fast fall does not tunnel through the floor', () => {
  const pos = { x: 0.5, y: 40, z: 0.5 };
  const vel = { x: 0, y: -200, z: 0 };
  moveWithCollisions(floor, pos, vel, 0.5, 0.6, 1.8);
  assert.ok(pos.y >= 10 - 0.01, `tunneled to y=${pos.y}`);
});

test('walls clamp horizontal motion', () => {
  // Wall occupying x >= 5, floor below y=1
  const world = (x, y, z) => y < 1 || x >= 5;
  const pos = { x: 3.5, y: 1, z: 0.5 };
  const vel = { x: 50, y: 0, z: 0 };
  moveWithCollisions(world, pos, vel, 0.2, 0.6, 1.8);
  assert.ok(pos.x <= 5 - 0.3 + 0.01, `passed into wall: x=${pos.x}`);
  assert.equal(vel.x, 0);
});

test('raycast hits the expected block and face', () => {
  const get = (x, y, z) => (y <= 4 ? B.STONE : B.AIR);
  const hit = raycastVoxel(get, (id) => id !== B.AIR, 2.5, 8, 2.5, 0, -1, 0, 10);
  assert.ok(hit, 'no hit');
  assert.deepEqual([hit.x, hit.y, hit.z], [2, 4, 2]);
  assert.deepEqual([hit.nx, hit.ny, hit.nz], [0, 1, 0]); // entered through the top face
});

test('raycast respects max distance and misses air', () => {
  const get = () => B.AIR;
  assert.equal(raycastVoxel(get, (id) => id !== B.AIR, 0, 50, 0, 1, 0, 0, 5), null);
});

test('diagonal raycast steps cells without skipping corners', () => {
  const solids = new Set(['3,3,3']);
  const get = (x, y, z) => (solids.has(`${x},${y},${z}`) ? B.STONE : B.AIR);
  const hit = raycastVoxel(get, (id) => id !== B.AIR, 0.5, 0.5, 0.5, 1, 1, 1, 20);
  assert.ok(hit, 'diagonal ray missed the block');
  assert.deepEqual([hit.x, hit.y, hit.z], [3, 3, 3]);
});

test('aabbOverlapsBlock detects the cell the player stands in', () => {
  const pos = { x: 4.5, y: 2, z: 4.5 };
  assert.ok(aabbOverlapsBlock(pos, 0.6, 1.8, 4, 2, 4));
  assert.ok(aabbOverlapsBlock(pos, 0.6, 1.8, 4, 3, 4)); // head cell
  assert.ok(!aabbOverlapsBlock(pos, 0.6, 1.8, 6, 2, 4));
  assert.ok(!aabbOverlapsBlock(pos, 0.6, 1.8, 4, 4, 4)); // above head
});
