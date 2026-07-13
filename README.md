# Voxelcraft

An infinite voxel sandbox that runs entirely in your browser. Explore seeded procedural terrain — hills, mountains, deserts, oceans, caves, ores, and forests — then mine and build with a 9-slot hotbar. Everything is generated at runtime: the code, the textures, and the sounds are all original and procedural. No downloads, no accounts, no assets.

**Play it live:** https://voxelcraft-ecru.vercel.app

> Fan-made original work inspired by the block-building genre. Not affiliated with, endorsed by, or derived from Mojang or Microsoft products. All code and art here are original (MIT licensed); nothing is copied from any commercial game.

## Features

- **Infinite terrain** — chunked 16×16×96 world streamed around the player, with seeded generation: rolling hills, mountain ranges, deserts, snow caps, carved cave systems, coal/iron ore veins, gravel pockets, trees, and sea-level oceans and lakes.
- **Mine & build** — voxel raycasting (Amanatides–Woo DDA) with block highlight, instant mining, block placing, and middle-click pick-block. Bedrock is unbreakable.
- **First-person movement** — WASD + mouse look (pointer lock), jumping, sprinting, sneaking, swimming, and a fly mode (double-tap space or `F`).
- **Real block lighting feel** — per-vertex baked ambient occlusion with anisotropy-free quad flipping, per-face directional shading, and a day/night cycle that dims the whole world, swings a sun and moon overhead, and blends sky/fog through dawn and dusk.
- **Procedural everything** — the 19-tile texture atlas is painted pixel-by-pixel from seeded noise at startup; dig/place sounds are synthesized filtered-noise bursts (WebAudio). Zero binary assets in the repo (the only vendored file is three.js).
- **Persistence** — your edits and position are saved to localStorage per seed. Share a world with `?seed=anything` in the URL. "New world" rerolls the seed.

## Controls

| Input | Action |
|---|---|
| `WASD` / arrows | Move |
| Mouse | Look |
| `Space` | Jump / swim up (double-tap: toggle fly) |
| Left / right click | Mine / place |
| Middle click | Pick targeted block |
| `1–9` / scroll wheel | Select hotbar slot |
| `Ctrl` | Sprint |
| `Shift` | Sneak (or descend while flying) |
| `F` | Toggle fly |
| `P` (or `F3`) | Debug overlay |
| `Esc` | Pause |

## Running locally

It's a static site — any file server works:

```sh
git clone https://github.com/aymandakir-gh/voxelcraft
cd voxelcraft
npm run serve   # http://127.0.0.1:4173
```

## Tests

The world generator, mesher, noise, and physics are pure DOM-free modules with unit tests:

```sh
npm test
```

## Architecture

```
index.html            entry, importmap (three.js vendored, no build step)
src/
  config.js           world/player constants
  noise.js            seeded hashing, value noise, fBM          [pure, tested]
  blocks.js           block registry + face/tile mapping        [pure]
  worldgen.js         terrain, biomes, caves, ores, trees       [pure, tested]
  mesher.js           face-culled quads + baked AO              [pure, tested]
  physics.js          AABB voxel collision + DDA raycast        [pure, tested]
  world.js            chunk store, streaming, mesh lifecycle    [three.js]
  player.js           input state + movement integration
  textures.js         procedural 16×16 tile atlas painter
  sky.js              day/night, sun/moon, clouds, fog
  hud.js              hotbar, debug overlay, menus
  audio.js            synthesized dig/place sounds
  persistence.js      localStorage world diffs + player state
  main.js             renderer, game loop, block interaction
```

## License

MIT © Ayman Dakir
