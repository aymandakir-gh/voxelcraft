// DOM HUD: hotbar with isometric block previews, debug overlay, start/pause
// overlay, and the underwater tint.
import { B, BLOCKS, HOTBAR } from './blocks.js';
import { drawBlockIcon } from './textures.js';

export class Hud {
  constructor(atlasCanvas) {
    this.atlas = atlasCanvas;
    this.selected = 0;
    this.hotbarEl = document.getElementById('hotbar');
    this.debugEl = document.getElementById('debug');
    this.overlayEl = document.getElementById('overlay');
    this.blockNameEl = document.getElementById('block-name');
    this.underwaterEl = document.getElementById('underwater');
    this.loadingEl = document.getElementById('loading');
    this.debugVisible = false;
    this.nameTimer = null;
    this.slots = [];
    this.buildHotbar();
  }

  buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.slots = [];
    HOTBAR.forEach((blockId, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const canvas = document.createElement('canvas');
      canvas.width = 44;
      canvas.height = 44;
      const def = BLOCKS[blockId];
      drawBlockIcon(canvas.getContext('2d'), this.atlas, 44, def.tiles[0], def.tiles[2]);
      const key = document.createElement('span');
      key.className = 'slot-key';
      key.textContent = String(i + 1);
      slot.append(canvas, key);
      this.hotbarEl.appendChild(slot);
      this.slots.push(slot);
    });
    this.select(0);
  }

  select(i) {
    this.selected = ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
    this.slots.forEach((s, idx) => s.classList.toggle('active', idx === this.selected));
    this.showBlockName(BLOCKS[this.selectedBlock()].name);
  }

  selectBlock(blockId) {
    const i = HOTBAR.indexOf(blockId);
    if (i >= 0) this.select(i);
  }

  selectedBlock() {
    return HOTBAR[this.selected];
  }

  showBlockName(name) {
    this.blockNameEl.textContent = name;
    this.blockNameEl.classList.add('visible');
    clearTimeout(this.nameTimer);
    this.nameTimer = setTimeout(() => this.blockNameEl.classList.remove('visible'), 1200);
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.debugEl.style.display = this.debugVisible ? 'block' : 'none';
  }

  updateDebug(fps, player, world, seed) {
    if (!this.debugVisible) return;
    const p = player.pos;
    this.debugEl.textContent =
      `voxelcraft — seed ${seed}\n` +
      `fps ${fps.toFixed(0)}\n` +
      `xyz ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}\n` +
      `chunks ${world.countChunks()}\n` +
      `${player.flying ? 'flying' : player.onGround ? 'on ground' : 'airborne'}`;
  }

  setOverlay(visible) {
    this.overlayEl.classList.toggle('hidden', !visible);
  }

  setLoading(text) {
    this.loadingEl.textContent = text || '';
    this.loadingEl.style.display = text ? 'block' : 'none';
  }

  setUnderwater(active) {
    this.underwaterEl.classList.toggle('visible', active);
  }
}
