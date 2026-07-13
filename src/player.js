// First-person player: input state, look angles, and physics integration.
import {
  PLAYER_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT, GRAVITY, JUMP_SPEED,
  WALK_SPEED, SPRINT_SPEED, SNEAK_SPEED, FLY_SPEED,
} from './config.js';
import { moveWithCollisions } from './physics.js';
import { B } from './blocks.js';

const MOUSE_SENSITIVITY = 0.0023;
const MAX_PITCH = Math.PI / 2 - 0.01;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z }; // feet position
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.keys = new Set();
    this.lastJumpPress = 0;
  }

  onMouseMove(dx, dy) {
    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch -= dy * MOUSE_SENSITIVITY;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  onKeyDown(code) {
    if (code === 'Space') {
      const now = performance.now();
      if (now - this.lastJumpPress < 260) {
        this.flying = !this.flying;
        this.vel.y = 0;
      }
      this.lastJumpPress = now;
    }
    if (code === 'KeyF') {
      this.flying = !this.flying;
      this.vel.y = 0;
    }
    this.keys.add(code);
  }

  onKeyUp(code) {
    this.keys.delete(code);
  }

  clearKeys() {
    this.keys.clear();
  }

  eye() {
    return { x: this.pos.x, y: this.pos.y + EYE_HEIGHT, z: this.pos.z };
  }

  lookDir() {
    const cp = Math.cos(this.pitch);
    return {
      x: -Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: -Math.cos(this.yaw) * cp,
    };
  }

  headInWater() {
    const e = this.eye();
    return this.world.getBlock(Math.floor(e.x), Math.floor(e.y), Math.floor(e.z)) === B.WATER;
  }

  bodyInWater() {
    const p = this.pos;
    return this.world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z)) === B.WATER;
  }

  update(dt) {
    const k = this.keys;
    const sneaking = k.has('ShiftLeft') || k.has('ShiftRight');
    const sprinting = (k.has('ControlLeft') || k.has('ControlRight')) && !sneaking;

    let fwd = 0, strafe = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
    const mag = Math.hypot(fwd, strafe);
    if (mag > 0) { fwd /= mag; strafe /= mag; }

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dirX = -sin * fwd + cos * strafe;
    const dirZ = -cos * fwd + sin * strafe;

    const inWater = this.bodyInWater();

    if (this.flying) {
      const speed = FLY_SPEED * (sprinting ? 1.8 : 1);
      this.vel.x = dirX * speed;
      this.vel.z = dirZ * speed;
      this.vel.y = 0;
      if (k.has('Space')) this.vel.y = speed;
      if (sneaking) this.vel.y = -speed;
    } else {
      let speed = sprinting ? SPRINT_SPEED : sneaking ? SNEAK_SPEED : WALK_SPEED;
      if (inWater) speed *= 0.55;
      // Smooth horizontal acceleration
      const accel = this.onGround || inWater ? 14 : 5;
      this.vel.x += (dirX * speed - this.vel.x) * Math.min(1, accel * dt);
      this.vel.z += (dirZ * speed - this.vel.z) * Math.min(1, accel * dt);

      if (inWater) {
        this.vel.y -= GRAVITY * 0.28 * dt;
        this.vel.y = Math.max(this.vel.y, -4);
        if (k.has('Space')) this.vel.y = Math.min(this.vel.y + GRAVITY * 0.9 * dt, 3.4);
      } else {
        this.vel.y -= GRAVITY * dt;
        this.vel.y = Math.max(this.vel.y, -50);
        if (k.has('Space') && this.onGround) {
          this.vel.y = JUMP_SPEED;
          this.onGround = false;
        }
      }
    }

    const result = moveWithCollisions(
      this.world.isSolidAt, this.pos, this.vel, dt, PLAYER_WIDTH, PLAYER_HEIGHT
    );
    this.onGround = result.onGround;
    if (this.flying && this.onGround) this.flying = false;

    // Safety net: never fall out of the world
    if (this.pos.y < -8) {
      this.pos.y = 100;
      this.vel.y = 0;
    }
  }
}
