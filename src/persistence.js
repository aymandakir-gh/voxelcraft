// localStorage persistence: block edits (per chunk diffs) and player state,
// namespaced by world seed.
export class Persistence {
  constructor(seed) {
    this.seed = seed;
    this.editsKey = `voxelcraft.edits.${seed}`;
    this.playerKey = `voxelcraft.player.${seed}`;
    this.chunkEdits = new Map(); // chunkKey -> Map<blockIndex, id>
    this.saveTimer = null;
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(this.editsKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      for (const [key, pairs] of Object.entries(obj)) {
        const m = new Map();
        for (let i = 0; i < pairs.length; i += 2) m.set(pairs[i], pairs[i + 1]);
        this.chunkEdits.set(key, m);
      }
    } catch (e) {
      console.warn('Could not load saved edits:', e);
    }
  }

  getChunkEdits(chunkKey) {
    return this.chunkEdits.get(chunkKey);
  }

  recordEdit(chunkKey, blockIndex, id) {
    let m = this.chunkEdits.get(chunkKey);
    if (!m) {
      m = new Map();
      this.chunkEdits.set(chunkKey, m);
    }
    m.set(blockIndex, id);
    this.scheduleSave();
  }

  scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveEdits();
    }, 1000);
  }

  saveEdits() {
    try {
      const obj = {};
      for (const [key, m] of this.chunkEdits) {
        const pairs = [];
        for (const [i, id] of m) pairs.push(i, id);
        obj[key] = pairs;
      }
      localStorage.setItem(this.editsKey, JSON.stringify(obj));
    } catch (e) {
      console.warn('Could not save edits:', e);
    }
  }

  savePlayer(state) {
    try {
      localStorage.setItem(this.playerKey, JSON.stringify(state));
    } catch { /* storage full or blocked — non-fatal */ }
  }

  loadPlayer() {
    try {
      const raw = localStorage.getItem(this.playerKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  clearWorld() {
    localStorage.removeItem(this.editsKey);
    localStorage.removeItem(this.playerKey);
  }
}
