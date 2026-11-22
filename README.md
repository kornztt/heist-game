[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/kornztt/heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/kornztt/heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# VELVET SHADOW — A Gilded Heist

Four wings. One night. Everything gold.

The Meridian Collection opens at midnight. Slip past the patrols, cut the
cameras, lift every painting, bar, gem and paper — and be on the roof before
the city wakes.

## The game

A top-down 2D canvas heist game. Static files, no network, keyboard + mouse.

- **4 levels, 4 looks**: the Gilded Gallery, the Vault Wing (timed laser
  grids), the Penthouse, and the Rooftop Getaway with a helicopter exit.
- **Guards with three alert states** — calm, suspicious `?`, alarmed `!` —
  patrol waypoints, sweeping vision cones that change color with alert, and
  hearing: running is fast but loud.
- **Cameras** sweep their cones and raise the alarm; stand close and hold
  `E` to hack one dead, with a visible progress bar.
- **Four loot types** with different values — paintings $500, gold $300,
  gems $800, documents $1000 — and a running loot total.
- **Alarm meter** that rises on detection and decays when you are hidden;
  shadow floors and closets hide you faster. Sneak (`C`) to move slow and
  quiet; the exit only opens once a level's loot is cleared.
- **Feel**: dynamic lighting and shadows, floor textures and props, loot
  glow, pickup particles, screen shake on alarm, and a full WebAudio
  soundtrack — ambient pad, footsteps, pickup chimes, hack beeps, siren.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| SHIFT | Run (loud — guards hear you) |
| C | Sneak (slow, quiet, harder to spot) |
| E | Hold near a camera to hack it · press near a closet to hide |
| Click | Walk to that spot |
| ESC / P | Pause · M mute |

## Structure

- `game/index.html` — page, HUD and screens
- `game/style.css` — HUD and overlay styling
- `game/js/main.js` — game state, input, loop, screens
- `game/js/levels.js` — the four level maps, palettes, loot values
- `game/js/entities.js` — guards, cameras, loot, particles, line of sight
- `game/js/render.js` — canvas drawing, cones, lighting, particles
- `game/js/audio.js` — synthesized WebAudio SFX and music

## Verified

Playwright + headed Firefox probe, 25/25 checks pass: boot, movement, sneak,
guard and camera detection raising the alarm, hiding decaying the alarm, loot
pickup, camera hack, exit win, caught screen, retry, full 4-level playthrough
to the win screen, best time saved to localStorage, zero page/console errors.
Four real-render screenshots under `screenshots/` (1280×800, each ≤ 84 KiB);
the cover shows room, guard cone, camera, loot and alarm meter in one frame.

## Run it

Serve `game/` over any static HTTP server and open `index.html`:

```sh
cd game && python3 -m http.server 8123
```

`main.ts` hands the game in: it copies `game/` and `screenshots/` into
`MAKEFUN_OUTPUT_DIR` (or `/output`) and writes `dossier.json` there.
