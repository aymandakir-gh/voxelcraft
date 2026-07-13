// Procedural WebAudio effects — no audio assets. Short filtered noise bursts
// for digging/placing, pitched per material family.
import { B } from './blocks.js';

export class Sounds {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  burst(freq, duration, gain) {
    const ctx = this.ensure();
    if (!ctx) return;
    const samples = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start();
  }

  freqFor(blockId) {
    switch (blockId) {
      case B.STONE: case B.COBBLE: case B.BEDROCK:
      case B.COAL_ORE: case B.IRON_ORE: case B.BRICK: return 900;
      case B.SAND: case B.GRAVEL: case B.SNOW: return 2600;
      case B.LOG: case B.PLANK: return 1400;
      case B.GLASS: return 3600;
      case B.LEAVES: case B.GRASS: return 2000;
      default: return 1600;
    }
  }

  dig(blockId) {
    this.burst(this.freqFor(blockId), 0.12, 0.22);
  }

  place(blockId) {
    this.burst(this.freqFor(blockId) * 0.8, 0.08, 0.16);
  }
}
