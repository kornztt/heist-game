// Gilded Heist — main: the game loop, input, alarm, loot and win/caught rules.
// One job: run the heist — own the state machine and tie levels, entities,
// rendering and sound together. Bootstrapped by index.html.

import { LEVELS, PLAY } from './levels.js';
import {
  makeGuards,
  makeCameras,
  updateGuard,
  updateCamera,
  moveCircle,
  inShadow,
  noiseAlert,
  PLAYER_RADIUS,
} from './entities.js';
import { drawWorld, drawHud, drawTitle, drawCaught, drawWin, drawLevelClear } from './render.js';
import { sounds } from './audio.js';

const BEST_KEY = 'gildedHeistBestMs';
const WALK_SPEED = 155;
const SNEAK_SPEED = 80;
const DASH_SPEED = 285;
const DASH_SECONDS = 0.22;
const DASH_COOLDOWN = 1.2;
const HACK_RANGE = 78;
const HACK_COST = 6;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? null : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function saveBest(ms) {
  try {
    window.localStorage.setItem(BEST_KEY, String(Math.floor(ms)));
  } catch {
    // Private mode or blocked storage: the game still plays.
  }
}

const game = {
  screen: 'title', // title | playing | levelclear | caught | win
  levelIndex: 0,
  level: null,
  guards: [],
  cameras: [],
  player: null,
  alarm: 0,
  lootGot: 0,
  lootTotal: 0,
  lootLeft: 0,
  runMs: 0,
  levelMs: 0,
  bestMs: loadBest(),
  time: 0,
  caughtReason: '',
  clearTimer: 0,
  nearCamera: null,
  startButton: null,
  dashTime: 0,
  dashCooldown: 0,
  keys: new Set(),
};

function loadLevel(index) {
  const def = LEVELS[index];
  game.levelIndex = index;
  game.level = {
    ...def,
    loot: def.loot.map((l) => ({ ...l, taken: false })),
  };
  game.guards = makeGuards(def.guards);
  game.cameras = makeCameras(def.cameras);
  game.player = {
    x: def.playerStart.x,
    y: def.playerStart.y,
    r: PLAYER_RADIUS,
    facing: 0,
    sneaking: false,
    inShadow: false,
  };
  game.alarm = 0;
  game.lootGot = 0;
  game.lootTotal = def.loot.length;
  game.lootLeft = def.loot.length;
  game.levelMs = 0;
  game.dashTime = 0;
  game.dashCooldown = 0;
  game.nearCamera = null;
}

function startGame() {
  loadLevel(0);
  game.runMs = 0;
  game.screen = 'playing';
  sounds.ensure();
  sounds.click();
}

function nextLevel() {
  if (game.levelIndex + 1 >= LEVELS.length) {
    game.screen = 'win';
    sounds.win();
    if (game.bestMs === null || game.runMs < game.bestMs) {
      game.bestMs = game.runMs;
      saveBest(game.runMs);
    }
    return;
  }
  loadLevel(game.levelIndex + 1);
  game.screen = 'levelclear';
  game.clearTimer = 2.0;
  sounds.levelClear();
}

function caught(reason) {
  if (game.screen !== 'playing') return;
  game.screen = 'caught';
  game.caughtReason = reason;
  sounds.caught();
}

function tryHack() {
  if (!game.nearCamera) return;
  game.nearCamera.disabled = true;
  game.alarm = Math.min(100, game.alarm + HACK_COST);
  game.nearCamera = null;
  sounds.hack();
}

function tryDash() {
  if (game.dashCooldown > 0 || game.dashTime > 0) return;
  game.dashTime = DASH_SECONDS;
  game.dashCooldown = DASH_COOLDOWN;
  noiseAlert(game.guards, game.player.x, game.player.y, 150);
  sounds.dash();
}

function updatePlaying(dt) {
  const p = game.player;
  const keys = game.keys;
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const up = keys.has('KeyW') || keys.has('ArrowUp');
  const down = keys.has('KeyS') || keys.has('ArrowDown');
  p.sneaking = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight');
  p.inShadow = inShadow(p.x, p.y, game.level.shadows);

  let mx = (right ? 1 : 0) - (left ? 1 : 0);
  let my = (down ? 1 : 0) - (up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    p.facing = Math.atan2(my, mx);
    if (game.dashTime > 0) {
      moveCircle(p, mx * DASH_SPEED * dt, my * DASH_SPEED * dt, game.level.walls);
    } else {
      const speed = p.sneaking ? SNEAK_SPEED : WALK_SPEED;
      moveCircle(p, mx * speed * dt, my * speed * dt, game.level.walls);
    }
  }
  if (game.dashTime > 0) game.dashTime -= dt;
  if (game.dashCooldown > 0) game.dashCooldown -= dt;

  // Guards and cameras.
  let spotted = false;
  for (const g of game.guards) {
    const result = updateGuard(g, p, game.level.walls, dt, (guard, strength) => {
      if (guard.state === 'alert' && strength > 0.4) spotted = true;
    });
    if (result === 'caught') {
      caught('A guard grabbed you in the open.');
      return;
    }
    if (g.state === 'suspicious' || g.state === 'alert') spotted = true;
  }
  if (spotted && !game._spottedSoundAt) {
    game._spottedSoundAt = game.time;
    sounds.spotted();
  }
  if (!spotted) game._spottedSoundAt = 0;

  let cameraRise = 0;
  for (const cam of game.cameras) {
    cameraRise += updateCamera(cam, p, game.level.walls, game.time);
  }

  // Alarm: rise while seen, fall while hidden (faster in shadow).
  const guardRise = game.guards.reduce((sum, g) => {
    if (g.state === 'alert') return sum + 26;
    if (g.state === 'suspicious') return sum + 10;
    return sum;
  }, 0);
  const rise = guardRise + cameraRise;
  if (rise > 0) {
    game.alarm = Math.min(100, game.alarm + rise * dt);
  } else {
    const decay = p.inShadow ? 14 : 6;
    game.alarm = Math.max(0, game.alarm - decay * dt);
  }
  if (game.alarm >= 100) {
    caught('The alarm hit 100% — security locked the building down.');
    return;
  }

  // Hackable camera in reach?
  game.nearCamera = null;
  for (const cam of game.cameras) {
    if (cam.disabled) continue;
    if (Math.hypot(cam.x - p.x, cam.y - p.y) < HACK_RANGE) {
      game.nearCamera = cam;
      break;
    }
  }

  // Loot pickup.
  for (const item of game.level.loot) {
    if (item.taken) continue;
    if (Math.hypot(item.x - p.x, item.y - p.y) < 30) {
      item.taken = true;
      game.lootGot++;
      game.lootLeft--;
      sounds.pickup();
    }
  }

  // Exit.
  if (game.lootLeft === 0) {
    const e = game.level.exit;
    if (Math.hypot(e.x - p.x, e.y - p.y) < 34) {
      nextLevel();
    }
  }
}

function update(dt) {
  game.time += dt;
  if (game.screen === 'playing') {
    game.runMs += dt * 1000;
    game.levelMs += dt * 1000;
    updatePlaying(dt);
  } else if (game.screen === 'levelclear') {
    game.clearTimer -= dt;
    if (game.clearTimer <= 0) game.screen = 'playing';
  }
}

function render() {
  ctx.clearRect(0, 0, 1280, 720);
  if (game.screen === 'title') {
    drawTitle(ctx, game);
    return;
  }
  drawWorld(ctx, game, game.time);
  drawHud(ctx, game);
  if (game.screen === 'caught') drawCaught(ctx, game);
  else if (game.screen === 'win') drawWin(ctx, game);
  else if (game.screen === 'levelclear') drawLevelClear(ctx, game);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function onKeyDown(e) {
  sounds.ensure();
  if (e.code === 'KeyM') {
    const on = sounds.toggleMusic();
    e.preventDefault();
    return on;
  }
  if (game.screen === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
    startGame();
    e.preventDefault();
    return;
  }
  if ((game.screen === 'caught' || game.screen === 'win') && e.code === 'KeyR') {
    startGame();
    e.preventDefault();
    return;
  }
  if (game.screen === 'playing') {
    if (e.code === 'KeyE') {
      tryHack();
      e.preventDefault();
      return;
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      tryDash();
      e.preventDefault();
      return;
    }
  }
  game.keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
}

function onKeyUp(e) {
  game.keys.delete(e.code);
}

function onClick(e) {
  sounds.ensure();
  if (game.screen !== 'title' || !game.startButton) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 1280;
  const y = ((e.clientY - rect.top) / rect.height) * 720;
  const b = game.startButton;
  if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) startGame();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
canvas.addEventListener('click', onClick);

loadLevel(0);
requestAnimationFrame(loop);

// Small test hook for the maker's own browser probes: read state, start the
// game, move the thief, set the alarm. It plays no part in the game itself.
window.__GILDED_HEIST = {
  state() {
    return {
      screen: game.screen,
      levelIndex: game.levelIndex,
      levelName: game.level.name,
      alarm: game.alarm,
      lootGot: game.lootGot,
      lootTotal: game.lootTotal,
      lootLeft: game.lootLeft,
      runMs: game.runMs,
      bestMs: game.bestMs,
      player: { x: game.player.x, y: game.player.y, sneaking: game.player.sneaking },
      guards: game.guards.map((g) => ({ name: g.name, x: g.x, y: g.y, state: g.state, awareness: g.awareness })),
      cameras: game.cameras.map((c) => ({ x: c.x, y: c.y, disabled: c.disabled })),
      nearCamera: game.nearCamera !== null,
      exit: { ...game.level.exit },
      loot: game.level.loot.map((l) => ({ x: l.x, y: l.y, taken: l.taken })),
    };
  },
  start: startGame,
  loadLevel(i) {
    loadLevel(i);
    game.screen = 'playing';
  },
  teleport(x, y) {
    game.player.x = Math.max(PLAY.x + 20, Math.min(PLAY.x + PLAY.w - 20, x));
    game.player.y = Math.max(PLAY.y + 20, Math.min(PLAY.y + PLAY.h - 20, y));
  },
  setAlarm(v) {
    game.alarm = Math.max(0, Math.min(100, v));
  },
  collectAll() {
    for (const item of game.level.loot) item.taken = true;
    game.lootGot = game.lootTotal;
    game.lootLeft = 0;
  },
};
