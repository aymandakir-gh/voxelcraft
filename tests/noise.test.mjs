import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hash2, hash3, valueNoise2, valueNoise3, fbm2, fbm3, seedFromString, smoothstep } from '../src/noise.js';

test('hashes are deterministic and in [0,1)', () => {
  for (const [x, z] of [[0, 0], [-5, 3], [1000, -1000], [123456, 654321]]) {
    const a = hash2(42, x, z);
    assert.equal(a, hash2(42, x, z));
    assert.ok(a >= 0 && a < 1, `hash2 out of range: ${a}`);
    const b = hash3(42, x, 7, z);
    assert.equal(b, hash3(42, x, 7, z));
    assert.ok(b >= 0 && b < 1);
  }
});

test('different seeds produce different noise fields', () => {
  let diffs = 0;
  for (let i = 0; i < 50; i++) {
    if (hash2(1, i, i * 3) !== hash2(2, i, i * 3)) diffs++;
  }
  assert.ok(diffs > 45, `expected seeds to disagree, got ${diffs}/50 differences`);
});

test('value noise interpolates within [0,1) and matches lattice hashes', () => {
  for (let i = 0; i < 100; i++) {
    const x = (i * 0.37) - 18, z = (i * 0.61) - 30;
    const v = valueNoise2(7, x, z);
    assert.ok(v >= 0 && v < 1);
    const w = valueNoise3(7, x, i * 0.11, z);
    assert.ok(w >= 0 && w < 1);
  }
  // At integer lattice points, value noise equals the hash
  assert.equal(valueNoise2(9, 4, -2), hash2(9, 4, -2));
});

test('fbm stays in [0,1) and is deterministic', () => {
  for (let i = 0; i < 60; i++) {
    const v = fbm2(13, i * 0.83, -i * 1.7, 5);
    assert.ok(v >= 0 && v < 1);
    assert.equal(v, fbm2(13, i * 0.83, -i * 1.7, 5));
    const w = fbm3(13, i * 0.3, i * 0.5, i * 0.7, 3);
    assert.ok(w >= 0 && w < 1);
  }
});

test('seedFromString is stable and spreads', () => {
  assert.equal(seedFromString('hello'), seedFromString('hello'));
  assert.notEqual(seedFromString('hello'), seedFromString('hellp'));
});

test('smoothstep clamps and eases', () => {
  assert.equal(smoothstep(0, 1, -5), 0);
  assert.equal(smoothstep(0, 1, 5), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});
