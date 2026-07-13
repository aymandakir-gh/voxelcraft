import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshChunk } from '../src/mesher.js';
import { B } from '../src/blocks.js';

function worldFromMap(blocks) {
  return (x, y, z) => blocks.get(`${x},${y},${z}`) ?? B.AIR;
}

test('a lone cube produces exactly 6 faces', () => {
  const get = worldFromMap(new Map([['3,5,3', B.STONE]]));
  const { solid, water } = meshChunk(get, 0, 0);
  assert.equal(solid.positions.length / 3, 24); // 6 faces * 4 verts
  assert.equal(solid.indices.length, 36);       // 6 faces * 2 tris * 3
  assert.equal(water.indices.length, 0);
});

test('touching faces between two opaque cubes are culled', () => {
  const get = worldFromMap(new Map([
    ['3,5,3', B.STONE],
    ['4,5,3', B.DIRT],
  ]));
  const { solid } = meshChunk(get, 0, 0);
  // 12 faces total minus the 2 shared ones
  assert.equal(solid.indices.length / 6, 10);
});

test('water renders in its own bucket and culls water-water faces', () => {
  const get = worldFromMap(new Map([
    ['3,5,3', B.WATER],
    ['4,5,3', B.WATER],
  ]));
  const { solid, water } = meshChunk(get, 0, 0);
  assert.equal(solid.indices.length, 0);
  assert.equal(water.indices.length / 6, 10);
});

test('solid faces against water are kept', () => {
  const get = worldFromMap(new Map([
    ['3,5,3', B.STONE],
    ['4,5,3', B.WATER],
  ]));
  const { solid } = meshChunk(get, 0, 0);
  assert.equal(solid.indices.length / 6, 6); // stone keeps all 6 faces
});

test('vertex colors encode AO: a covered corner is darker', () => {
  // A floor slab plus one wall block: floor vertices near the wall get AO
  const blocks = new Map();
  for (let x = 2; x <= 6; x++) for (let z = 2; z <= 6; z++) blocks.set(`${x},4,${z}`, B.STONE);
  blocks.set('4,5,4', B.STONE);
  const { solid } = meshChunk(worldFromMap(blocks), 0, 0);
  const colors = solid.colors;
  let min = 1, max = 0;
  for (let i = 0; i < colors.length; i += 3) {
    min = Math.min(min, colors[i]);
    max = Math.max(max, colors[i]);
  }
  assert.ok(min < max, 'expected AO to vary vertex brightness');
});

test('meshing is deterministic', () => {
  const blocks = new Map([['1,1,1', B.GRASS], ['1,2,1', B.LOG], ['2,1,1', B.WATER]]);
  const a = meshChunk(worldFromMap(blocks), 0, 0);
  const b = meshChunk(worldFromMap(blocks), 0, 0);
  assert.deepEqual(Array.from(a.solid.positions), Array.from(b.solid.positions));
  assert.deepEqual(Array.from(a.water.indices), Array.from(b.water.indices));
});
