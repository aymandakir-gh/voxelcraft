// Voxel AABB collision and voxel raycast (Amanatides & Woo DDA).
// Pure module: no DOM, no three.js. `isSolidAt(x,y,z)` receives world block coords.

const EPS = 1e-7;

// Move an AABB (centered on x/z, base at pos.y) through the voxel grid, one axis
// at a time, clamping against solid cells. Mutates and returns { pos, vel, onGround }.
export function moveWithCollisions(isSolidAt, pos, vel, dt, width, height) {
  const half = width / 2;
  let onGround = false;

  const collide = (axis, dist) => {
    let p = axis === 0 ? pos.x : axis === 1 ? pos.y : pos.z;
    if (dist === 0) return p;
    p += dist;

    // AABB extents after the tentative move
    const minX = (axis === 0 ? p : pos.x) - half;
    const maxX = (axis === 0 ? p : pos.x) + half;
    const minY = axis === 1 ? p : pos.y;
    const maxY = (axis === 1 ? p : pos.y) + height;
    const minZ = (axis === 2 ? p : pos.z) - half;
    const maxZ = (axis === 2 ? p : pos.z) + half;

    const x0 = Math.floor(minX), x1 = Math.floor(maxX - EPS);
    const y0 = Math.floor(minY), y1 = Math.floor(maxY - EPS);
    const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - EPS);

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (!isSolidAt(x, y, z)) continue;
          if (axis === 0) {
            p = dist > 0 ? x - half - EPS : x + 1 + half + EPS;
          } else if (axis === 1) {
            if (dist > 0) p = y - height - EPS;
            else { p = y + 1 + EPS; onGround = true; }
          } else {
            p = dist > 0 ? z - half - EPS : z + 1 + half + EPS;
          }
          if (axis === 0) vel.x = 0; else if (axis === 1) vel.y = 0; else vel.z = 0;
          return p;
        }
      }
    }
    return p;
  };

  // Substep so fast movement can't tunnel through blocks
  const steps = Math.max(1, Math.ceil(Math.max(
    Math.abs(vel.x * dt), Math.abs(vel.y * dt), Math.abs(vel.z * dt)
  ) / 0.5));
  const sdt = dt / steps;

  for (let s = 0; s < steps; s++) {
    pos.y = collide(1, vel.y * sdt);
    pos.x = collide(0, vel.x * sdt);
    pos.z = collide(2, vel.z * sdt);
  }

  return { pos, vel, onGround };
}

// Step a ray through the voxel grid; returns the first cell for which
// `hit(id)` is true, plus the face normal it entered through, or null.
export function raycastVoxel(getBlock, hit, ox, oy, oz, dx, dy, dz, maxDist) {
  const len = Math.hypot(dx, dy, dz);
  if (len < EPS) return null;
  dx /= len; dy /= len; dz /= len;

  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(dx) < EPS ? Infinity : Math.abs(1 / dx);
  const tDeltaY = Math.abs(dy) < EPS ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = Math.abs(dz) < EPS ? Infinity : Math.abs(1 / dz);
  let tMaxX = tDeltaX === Infinity ? Infinity : (dx > 0 ? (x + 1 - ox) : (ox - x)) * tDeltaX;
  let tMaxY = tDeltaY === Infinity ? Infinity : (dy > 0 ? (y + 1 - oy) : (oy - y)) * tDeltaY;
  let tMaxZ = tDeltaZ === Infinity ? Infinity : (dz > 0 ? (z + 1 - oz) : (oz - z)) * tDeltaZ;

  let nx = 0, ny = 0, nz = 0;
  let t = 0;
  while (t <= maxDist) {
    const id = getBlock(x, y, z);
    if (hit(id)) {
      return { x, y, z, nx, ny, nz, dist: t };
    }
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      t = tMaxX; tMaxX += tDeltaX; x += stepX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY <= tMaxZ) {
      t = tMaxY; tMaxY += tDeltaY; y += stepY; nx = 0; ny = -stepY; nz = 0;
    } else {
      t = tMaxZ; tMaxZ += tDeltaZ; z += stepZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

// Does the player's AABB overlap block cell (bx,by,bz)?
export function aabbOverlapsBlock(pos, width, height, bx, by, bz) {
  const half = width / 2;
  return pos.x - half < bx + 1 && pos.x + half > bx &&
         pos.y < by + 1 && pos.y + height > by &&
         pos.z - half < bz + 1 && pos.z + half > bz;
}
