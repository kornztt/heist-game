[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/kornztt/heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/kornztt/heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# Gilded Heist

A top-down 2D heist game that runs in a desktop browser from static files — no
network, no build step. Serve `game/` with any static HTTP server and open
`game/index.html`.

You are the thief. Cross three rooms — a museum gallery, a bank vault wing and
a penthouse — grab every prize, and reach the exit before the alarm hits 100%.
Guards and cameras both feed the same alarm meter, so a loud dash in front of
a camera can end a run just as fast as a guard's grab.

## How to play

- **WASD / arrow keys** — move
- **Hold C** — sneak (slower, harder to spot, quieter)
- **SHIFT** — dash (fast, but loud: every guard nearby turns and comes to look)
- **E** — hack a camera in reach (disables it, costs +6 alarm)
- **M** — toggle the music
- **ENTER** — start · **R** — retry after being caught or winning

Tip: read a guard's cone before you move, and cross open floor only when it
sweeps away. Dark **SHADOW** patches are your friends — stand in one and the
alarm falls twice as fast while guards spot you from half as far.

## The rooms

Guards patrol with vision cones. A guard who spots you grows suspicious, then
gives chase — if one grabs you, the run ends. Cameras sweep their own cones and
raise the alarm while they see you; hack them from close range. Hide in the
dark **SHADOW** patches and the alarm falls fast. Grab all the loot in a room
to unlock its exit. Your best getaway time is kept in `localStorage`.

## Files

- `game/index.html` — the page
- `game/js/main.js` — game loop, input, alarm and win/caught rules
- `game/js/levels.js` — the three rooms
- `game/js/entities.js` — guards, cameras, line of sight and movement
- `game/js/render.js` — everything drawn on screen
- `game/js/audio.js` — WebAudio sound effects and music
- `main.ts` — hands the game in with `buildDossier`
- `screenshots/` — renders of the game running in a browser

All names, art, sounds and music are original, made for this entry.
