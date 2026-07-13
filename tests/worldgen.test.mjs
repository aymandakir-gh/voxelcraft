import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGenerator } from '../src/worldgen.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, SEA_LEVEL, blockIndex } from '../src/config.js';
import { B } from '../src/blocks.js';

const SEED = 1337;

test('chunks have the right size and are deterministic', () => {
  const g1 = makeGenerator(SEED);
  const g2 = makeGenerator(SEED);
  const a = g1.generateChunk(0, 0);
  const b = g2.generateChunk(0, 0);
  assert.equal(a.length, CHUNK_X * CHUNK_Y * CHUNK_Z);
  assert.deepEqual(Array.from(a), Array.from(b));
});

test('different seeds give different chunks', () => {
  const a = makeGenerator(1).generateChunk(0, 0);
  const b = makeGenerator(2).generateChunk(0, 0);
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  assert.ok(diff > 100, `expected different terrain, only ${diff} cells differ`);
});

test('bedrock floors every column', () => {
  const g = makeGenerator(SEED);
  const data = g.generateChunk(2, -3);
  for (let z = 0; z < CHUNK_Z; z++) {
    for (let x = 0; x < CHUNK_X; x++) {
      assert.equal(data[blockIndex(x, 0, z)], B.BEDROCK, `no bedrock at ${x},0,${z}`);
    }
  }
});

test('water fills open terrain up to sea level', () => {
  const g = makeGenerator(SEED);
  // scan chunks until we find an ocean column
  let found = false;
  outer:
  for (let cx = 0; cx < 12 && !found; cx++) {
    for (let cz = 0; cz < 12; cz++) {
      const x0 = cx * CHUNK_X, z0 = cz * CHUNK_Z;
      for (let lx = 0; lx < CHUNK_X; lx++) {
        const h = g.heightAt(x0 + lx, z0);
        if (h < SEA_LEVEL) {
          const data = g.generateChunk(cx, cz);
          assert.equal(data[blockIndex(lx, SEA_LEVEL, 0)], B.WATER);
          assert.equal(data[blockIndex(lx, SEA_LEVEL + 1, 0)], B.AIR);
          found = true;
          continue outer;
        }
      }
    }
  }
  assert.ok(found, 'no ocean found in 12x12 chunk scan');
});

test('surface block sits at heightAt (unless carved or forested)', () => {
  const g = makeGenerator(SEED);
  const data = g.generateChunk(0, 0);
  let checked = 0;
  for (let lz = 0; lz < CHUNK_Z; lz++) {
    for (let lx = 0; lx < CHUNK_X; lx++) {
      const h = g.heightAt(lx, lz);
      if (g.isCave(lx, h, lz)) continue;
      const id = data[blockIndex(lx, h, lz)];
      assert.notEqual(id, B.AIR, `surface missing at ${lx},${h},${lz}`);
      checked++;
    }
  }
  assert.ok(checked > 50, 'too few uncarved columns to be meaningful');
});

test('trees exist and are made of logs and leaves', () => {
  const g = makeGenerator(SEED);
  let logs = 0, leaves = 0;
  for (let cx = 0; cx < 8; cx++) {
    for (let cz = 0; cz < 8; cz++) {
      const data = g.generateChunk(cx, cz);
      for (let i = 0; i < data.length; i++) {
        if (data[i] === B.LOG) logs++;
        else if (data[i] === B.LEAVES) leaves++;
      }
    }
  }
  assert.ok(logs > 0, 'no logs generated in an 8x8 chunk area');
  assert.ok(leaves > logs, 'expected more leaves than logs');
});

test('findSpawn lands on dry ground above sea level', () => {
  const g = makeGenerator(SEED);
  const s = g.findSpawn();
  assert.ok(s.y > SEA_LEVEL, `spawn y=${s.y} is not above sea level`);
});
