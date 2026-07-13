// Chunk store, streaming, and mesh lifecycle. Bridges the pure worldgen/mesher
// modules to three.js scene objects.
import * as THREE from 'three';
import {
  CHUNK_X, CHUNK_Y, CHUNK_Z, RENDER_DIST, GEN_MARGIN, GEN_BUDGET, MESH_BUDGET,
  chunkKey, blockIndex,
} from './config.js';
import { B, isSolid } from './blocks.js';
import { meshChunk } from './mesher.js';

class Chunk {
  constructor(cx, cz, data) {
    this.cx = cx;
    this.cz = cz;
    this.data = data;
    this.solidMesh = null;
    this.waterMesh = null;
    this.dirty = true;
  }
}

export class World {
  constructor(scene, generator, edits, materials) {
    this.scene = scene;
    this.generator = generator;
    this.edits = edits; // persistence store: getChunkEdits(key) -> Map<index, id> | undefined
    this.materials = materials; // { solid, water }
    this.chunks = new Map();
    this.genQueue = [];
    this.queued = new Set();
  }

  getChunk(cx, cz) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  isGenerated(cx, cz) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_Y) return B.AIR;
    const cx = Math.floor(x / CHUNK_X), cz = Math.floor(z / CHUNK_Z);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return B.AIR;
    return chunk.data[blockIndex(x - cx * CHUNK_X, y, z - cz * CHUNK_Z)];
  }

  isSolidAt = (x, y, z) => {
    return isSolid(this.getBlock(x, y, z));
  };

  setBlock(x, y, z, id) {
    if (y < 0 || y >= CHUNK_Y) return false;
    const cx = Math.floor(x / CHUNK_X), cz = Math.floor(z / CHUNK_Z);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const lx = x - cx * CHUNK_X, lz = z - cz * CHUNK_Z;
    const i = blockIndex(lx, y, lz);
    if (chunk.data[i] === id) return false;
    chunk.data[i] = id;
    this.edits.recordEdit(chunkKey(cx, cz), i, id);

    chunk.dirty = true;
    // Border edits change culled faces in neighbor chunks
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_X - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_Z - 1) this.markDirty(cx, cz + 1);
    return true;
  }

  markDirty(cx, cz) {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  // Called every frame with the player's position: queues generation for
  // missing chunks, generates/meshes within budget, unloads distant chunks.
  update(px, pz) {
    const pcx = Math.floor(px / CHUNK_X), pcz = Math.floor(pz / CHUNK_Z);
    const R = RENDER_DIST + GEN_MARGIN;

    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        const key = chunkKey(cx, cz);
        if (this.chunks.has(key) || this.queued.has(key)) continue;
        this.genQueue.push({ cx, cz, key });
        this.queued.add(key);
      }
    }

    if (this.genQueue.length > 0) {
      this.genQueue.sort((a, b) =>
        (Math.abs(b.cx - pcx) + Math.abs(b.cz - pcz)) - (Math.abs(a.cx - pcx) + Math.abs(a.cz - pcz))
      );
      for (let i = 0; i < GEN_BUDGET && this.genQueue.length > 0; i++) {
        const { cx, cz, key } = this.genQueue.pop();
        this.queued.delete(key);
        if (Math.abs(cx - pcx) > R || Math.abs(cz - pcz) > R) continue; // drifted out of range
        this.generateChunk(cx, cz);
      }
    }

    // Mesh dirty chunks near the player, nearest first
    let meshed = 0;
    const candidates = [];
    for (const chunk of this.chunks.values()) {
      if (!chunk.dirty) continue;
      const d = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz));
      if (d > RENDER_DIST) continue;
      if (!this.neighborsGenerated(chunk.cx, chunk.cz)) continue;
      candidates.push({ chunk, d });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const { chunk } of candidates) {
      if (meshed >= MESH_BUDGET) break;
      this.buildChunkMesh(chunk);
      meshed++;
    }

    // Unload far chunks
    for (const [key, chunk] of this.chunks) {
      if (Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz)) > R + 1) {
        this.disposeChunkMeshes(chunk);
        this.chunks.delete(key);
      }
    }
  }

  neighborsGenerated(cx, cz) {
    return this.isGenerated(cx - 1, cz) && this.isGenerated(cx + 1, cz) &&
           this.isGenerated(cx, cz - 1) && this.isGenerated(cx, cz + 1);
  }

  generateChunk(cx, cz) {
    const data = this.generator.generateChunk(cx, cz);
    const key = chunkKey(cx, cz);
    const edits = this.edits.getChunkEdits(key);
    if (edits) {
      for (const [i, id] of edits) data[i] = id;
    }
    const chunk = new Chunk(cx, cz, data);
    this.chunks.set(key, chunk);
    // Freshly available data can change culling at the borders of neighbors
    this.markDirty(cx - 1, cz);
    this.markDirty(cx + 1, cz);
    this.markDirty(cx, cz - 1);
    this.markDirty(cx, cz + 1);
    return chunk;
  }

  buildChunkMesh(chunk) {
    const { solid, water } = meshChunk((x, y, z) => this.getBlock(x, y, z), chunk.cx, chunk.cz);
    this.disposeChunkMeshes(chunk);
    chunk.solidMesh = this.addMesh(solid, this.materials.solid, false);
    chunk.waterMesh = this.addMesh(water, this.materials.water, true);
    chunk.dirty = false;
  }

  addMesh(buffers, material, isWater) {
    if (buffers.indices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = isWater ? 1 : 0;
    this.scene.add(mesh);
    return mesh;
  }

  disposeChunkMeshes(chunk) {
    for (const mesh of [chunk.solidMesh, chunk.waterMesh]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    chunk.solidMesh = null;
    chunk.waterMesh = null;
  }

  countChunks() {
    return this.chunks.size;
  }

  pendingNearby(px, pz, radius) {
    const pcx = Math.floor(px / CHUNK_X), pcz = Math.floor(pz / CHUNK_Z);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const chunk = this.getChunk(pcx + dx, pcz + dz);
        if (!chunk) return true;
        if (chunk.dirty && this.neighborsGenerated(chunk.cx, chunk.cz)) return true;
      }
    }
    return false;
  }
}
