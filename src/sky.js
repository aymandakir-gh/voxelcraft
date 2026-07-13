// Day/night cycle: sky and fog colors, world brightness, sun sprite, drifting clouds.
import * as THREE from 'three';
import { DAY_LENGTH, RENDER_DIST, CHUNK_X } from './config.js';
import { hash2 } from './noise.js';

const DAY_SKY = new THREE.Color(0x87ceeb);
const DUSK_SKY = new THREE.Color(0xe8875a);
const NIGHT_SKY = new THREE.Color(0x0a1030);

export class Sky {
  constructor(scene, seed) {
    this.scene = scene;
    this.time = DAY_LENGTH * 0.25; // start mid-morning
    this.brightness = 1;
    this.skyColor = DAY_SKY.clone();

    // Fog reaches full opacity just inside the render distance so the world
    // edge dissolves into sky instead of showing a chunk cliff
    scene.fog = new THREE.Fog(DAY_SKY.clone(), 24, RENDER_DIST * CHUNK_X - 12);

    // Sun and moon: emissive quads orbiting the camera
    this.sun = this.makeDisc(0xfff8c0, 14);
    this.moon = this.makeDisc(0xd8e0f0, 9);
    scene.add(this.sun, this.moon);

    this.clouds = this.makeClouds(seed);
    scene.add(this.clouds);
  }

  makeDisc(color, size) {
    const mat = new THREE.MeshBasicMaterial({ color, fog: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    return mesh;
  }

  makeClouds(seed) {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: false,
    });
    let placed = 0;
    for (let i = 0; placed < 60 && i < 400; i++) {
      const gx = (i * 37) % 20 - 10, gz = Math.floor(i / 20) * 2 - 10;
      if (hash2(seed + 83, i, 0) < 0.5) continue;
      const w = 14 + hash2(seed + 84, i, 1) * 26;
      const d = 10 + hash2(seed + 85, i, 2) * 20;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), mat);
      cloud.position.set(
        gx * 34 + hash2(seed + 86, i, 3) * 30,
        108 + hash2(seed + 87, i, 4) * 6,
        gz * 34 + hash2(seed + 88, i, 5) * 30
      );
      group.add(cloud);
      placed++;
    }
    return group;
  }

  // t in [0,1): 0 = dawn, .25 = noon, .5 = dusk, .75 = midnight
  update(dt, camera) {
    this.time = (this.time + dt) % DAY_LENGTH;
    const t = this.time / DAY_LENGTH;
    const angle = t * Math.PI * 2; // sun elevation angle
    const sunHeight = Math.sin(angle); // 1 at noon, -1 at midnight

    // Brightness: clamp to a moonlit floor at night
    this.brightness = Math.max(0.16, Math.min(1, 0.5 + sunHeight * 0.9));

    // Sky color: day <-> night with a dusk/dawn band
    const dayness = Math.max(0, Math.min(1, 0.5 + sunHeight * 2.2));
    this.skyColor.copy(NIGHT_SKY).lerp(DAY_SKY, dayness);
    const duskBand = Math.max(0, 1 - Math.abs(sunHeight) * 5) * 0.6;
    this.skyColor.lerp(DUSK_SKY, duskBand);

    this.scene.fog.color.copy(this.skyColor);

    // Position sun/moon relative to the camera so they read as infinitely far
    const r = 380;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    this.sun.position.set(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cz - 80);
    this.moon.position.set(cx - Math.cos(angle) * r, cy - Math.sin(angle) * r, cz + 80);
    this.sun.lookAt(camera.position);
    this.moon.lookAt(camera.position);

    // Clouds drift and follow the camera loosely
    this.clouds.position.x += dt * 1.6;
    if (this.clouds.position.x - cx > 340) this.clouds.position.x = cx - 340;
    const dz = cz - this.clouds.position.z;
    if (Math.abs(dz) > 340) this.clouds.position.z += dz * 0.5;
  }
}
