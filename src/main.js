// Voxelcraft entry point: renderer, game loop, input wiring, block interaction.
import * as THREE from 'three';
import { CHUNK_Y, REACH, PLAYER_WIDTH, PLAYER_HEIGHT } from './config.js';
import { B, BLOCKS, isSolid, HOTBAR } from './blocks.js';
import { seedFromString } from './noise.js';
import { makeGenerator } from './worldgen.js';
import { buildAtlasCanvas } from './textures.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Persistence } from './persistence.js';
import { Sky } from './sky.js';
import { Hud } from './hud.js';
import { Sounds } from './audio.js';
import { raycastVoxel, aabbOverlapsBlock } from './physics.js';

// ---------- Seed ----------
const params = new URLSearchParams(location.search);
let seed;
if (params.has('seed')) {
  const s = params.get('seed');
  // Normalize to signed 32-bit so the localStorage round-trip (parseInt|0)
  // yields the identical value and saved edits stay reachable
  seed = /^-?\d+$/.test(s) ? (parseInt(s, 10) | 0) : (seedFromString(s) | 0);
} else {
  const stored = localStorage.getItem('voxelcraft.seed');
  seed = stored ? (parseInt(stored, 10) | 0) : ((Math.random() * 0xffffffff) | 0);
}
localStorage.setItem('voxelcraft.seed', String(seed));
document.getElementById('seed-label').textContent = `seed: ${seed}`;

// ---------- Renderer / scene ----------
const canvas = document.getElementById('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
} catch (err) {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('loading').textContent =
    'WebGL is not available in this browser — Voxelcraft needs it to render.';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 700);
camera.rotation.order = 'YXZ';

// ---------- Materials from the procedural atlas ----------
const atlasCanvas = buildAtlasCanvas(seed);
const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestFilter;
atlasTexture.generateMipmaps = false;
atlasTexture.colorSpace = THREE.SRGBColorSpace;

const solidMaterial = new THREE.MeshBasicMaterial({
  map: atlasTexture, vertexColors: true, alphaTest: 0.35,
});
const waterMaterial = new THREE.MeshBasicMaterial({
  map: atlasTexture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false,
});

// ---------- World / player ----------
const generator = makeGenerator(seed);
const persistence = new Persistence(seed);
const world = new World(scene, generator, persistence, {
  solid: solidMaterial, water: waterMaterial,
});

let savedPlayer = persistence.loadPlayer();
if (savedPlayer && !(savedPlayer.pos &&
    Number.isFinite(savedPlayer.pos.x) &&
    Number.isFinite(savedPlayer.pos.y) &&
    Number.isFinite(savedPlayer.pos.z))) {
  savedPlayer = null; // malformed save — fall back to a fresh spawn
}
const spawn = savedPlayer ? savedPlayer.pos : generator.findSpawn();
const player = new Player(world, spawn);
if (savedPlayer) {
  player.yaw = savedPlayer.yaw || 0;
  player.pitch = savedPlayer.pitch || 0;
}

const sky = new Sky(scene, seed);
const hud = new Hud(atlasCanvas);
if (savedPlayer && Number.isInteger(savedPlayer.selected)) hud.select(savedPlayer.selected);
const sounds = new Sounds();

// ---------- Block highlight ----------
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 })
);
highlight.visible = false;
scene.add(highlight);

// ---------- Input ----------
let locked = false;
const overlay = document.getElementById('overlay');

function requestLock() {
  if (!canvas.requestPointerLock) {
    hud.setLoading('This game needs a mouse and pointer-lock support (desktop browser).');
    return;
  }
  // Chrome rejects re-lock within ~1.25s of Esc; swallow it, the user just clicks again
  const p = canvas.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
}

overlay.addEventListener('click', requestLock);

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  hud.setOverlay(!locked);
  if (!locked) player.clearKeys();
  else sounds.ensure();
});

document.addEventListener('mousemove', (e) => {
  if (locked) player.onMouseMove(e.movementX, e.movementY);
});

document.addEventListener('keydown', (e) => {
  if (!locked) return;
  if (e.code === 'F3' || e.code === 'KeyP') {
    e.preventDefault();
    hud.toggleDebug();
    return;
  }
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10);
    if (n >= 1 && n <= HOTBAR.length) hud.select(n - 1);
    return;
  }
  if (e.repeat) return; // OS key auto-repeat must not re-trigger fly/jump toggles
  player.onKeyDown(e.code);
});

document.addEventListener('keyup', (e) => player.onKeyUp(e.code));

// Accumulate wheel delta so inertial trackpad scrolling steps one slot per
// notch-worth of travel instead of one per event
let wheelAccum = 0;
document.addEventListener('wheel', (e) => {
  if (!locked) return;
  wheelAccum += e.deltaY;
  const STEP = 55;
  while (wheelAccum >= STEP) { hud.select(hud.selected + 1); wheelAccum -= STEP; }
  while (wheelAccum <= -STEP) { hud.select(hud.selected - 1); wheelAccum += STEP; }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) breakBlock();
  else if (e.button === 1) pickBlock();
  else if (e.button === 2) placeBlock();
});

document.getElementById('new-world').addEventListener('click', (e) => {
  e.stopPropagation();
  persistence.clearWorld();
  localStorage.removeItem('voxelcraft.seed');
  location.href = location.pathname; // reload without ?seed
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Block interaction ----------
function targetBlock() {
  const e = player.eye();
  const d = player.lookDir();
  return raycastVoxel(
    (x, y, z) => world.getBlock(x, y, z),
    (id) => id !== B.AIR && id !== B.WATER,
    e.x, e.y, e.z, d.x, d.y, d.z, REACH
  );
}

function breakBlock() {
  const hit = targetBlock();
  if (!hit) return;
  const id = world.getBlock(hit.x, hit.y, hit.z);
  if (BLOCKS[id] && BLOCKS[id].unbreakable) return;
  if (world.setBlock(hit.x, hit.y, hit.z, B.AIR)) sounds.dig(id);
}

function placeBlock() {
  const hit = targetBlock();
  if (!hit || hit.dist === 0) return;
  const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
  if (y < 0 || y >= CHUNK_Y) return;
  const current = world.getBlock(x, y, z);
  if (current !== B.AIR && current !== B.WATER) return;
  const id = hud.selectedBlock();
  if (isSolid(id) && aabbOverlapsBlock(player.pos, PLAYER_WIDTH, PLAYER_HEIGHT, x, y, z)) return;
  if (world.setBlock(x, y, z, id)) sounds.place(id);
}

function pickBlock() {
  const hit = targetBlock();
  if (!hit) return;
  hud.selectBlock(world.getBlock(hit.x, hit.y, hit.z));
}

// ---------- Save loop ----------
setInterval(() => {
  persistence.savePlayer({
    pos: player.pos, yaw: player.yaw, pitch: player.pitch, selected: hud.selected,
  });
}, 2000);

// ---------- Main loop ----------
let lastTime = performance.now();
let fps = 60;
let spawnReady = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  fps = fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;

  world.update(player.pos.x, player.pos.z);

  // Hold physics until the spawn area is generated and meshed
  if (!spawnReady) {
    spawnReady = !world.pendingNearby(player.pos.x, player.pos.z, 1);
    hud.setLoading(spawnReady ? '' : 'generating world…');
  } else if (locked) {
    player.update(dt);
  } else if (!world.isGenerated(Math.floor(player.pos.x / 16), Math.floor(player.pos.z / 16))) {
    spawnReady = false;
  }

  const eye = player.eye();
  camera.position.set(eye.x, eye.y, eye.z);
  camera.rotation.set(player.pitch, player.yaw, 0);

  sky.update(dt, camera);
  scene.background = sky.skyColor;
  const b = sky.brightness;
  solidMaterial.color.setRGB(b, b, b);
  waterMaterial.color.setRGB(b, b, b);

  const hit = locked ? targetBlock() : null;
  highlight.visible = !!hit;
  if (hit) highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

  hud.setUnderwater(player.headInWater());
  hud.updateDebug(fps, player, world, seed);

  renderer.render(scene, camera);
}

requestAnimationFrame(frame);
