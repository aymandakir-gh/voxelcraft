# PRD — Voxelcraft

**One-liner:** A browser-based, Minecraft-style voxel sandbox — original code and original procedural textures — deployed as a static site on Vercel, source on GitHub.

**Why:** Session goal (2026-07-13): build a Minecraft-like game, push to GitHub, make it live on Vercel. A literal copy of Minecraft is not possible (Mojang/Microsoft IP: assets, code, name). Game *mechanics* are not protectable, so we ship an original implementation of the genre.

## Scope (v1)

- Infinite chunked terrain (16×16×96 chunks), seeded procedural generation: hills, mountains, deserts, snow caps, caves, ores, trees, oceans/lakes.
- First-person controls: WASD, jump, sprint, sneak, fly toggle, pointer-lock mouse look.
- Physics: gravity, AABB voxel collision, swimming-free (water is non-solid).
- Mining/placing with voxel raycast (Amanatides–Woo DDA), block highlight, pick-block (middle click).
- 9-slot hotbar (digits + scroll), original 16×16 procedural texture atlas, per-vertex baked AO + face shading.
- Day/night cycle (sky, fog, brightness), drifting clouds, underwater tint.
- Persistence: block edits + player state in localStorage per seed; shareable `?seed=` URL; New World button.
- HUD: crosshair, hotbar, debug overlay (FPS/coords/chunks), pause/start overlay with controls.
- Procedural audio (WebAudio) for dig/place — no audio assets.

## Non-goals (v1)

Multiplayer, mobs, crafting/survival inventory, redstone-like logic, mobile touch controls, save-to-server.

## Tech

Static site, no build step: ES modules + vendored three.js r170 (MIT). Pure-logic modules (noise, worldgen, mesher, physics) are DOM-free and unit-tested with `node --test`.

## Definition of done

`node --test` green; game playable locally with no console errors; repo public at github.com/aymandakir-gh/voxelcraft; production deploy live on Vercel; README with disclaimer (fan-made, not affiliated with Mojang/Microsoft).
