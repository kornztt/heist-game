// VELVET SHADOW — game state, input, loop, screens, staging for screenshots.
import { TILE, COLS, ROWS, LEVELS, LOOT_DEFS, normalizeMap } from './levels.js';
import { Guard, Camera, Loot, Particle, burst, dist, losBlocked } from './entities.js';
import { Renderer } from './render.js';
import { SoundBank } from './audio.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.cv = $('game');
    this.renderer = new Renderer(this.cv);
    this.sound = new SoundBank();
    this.levelIdx = 0;
    this.state = 'title'; // title | intro | playing | paused | leveldone | caught | win
    this.time = 0;
    this.levelTime = 0;
    this.totalLoot = 0;
    this.totalTime = 0;
    this.alarm = 0;
    this.frozen = false;
    this.particles = [];
    this.keys = {};
    this.moveTarget = null;
    this.hearing = null;
    this.shakeT = 0;
    this.caughtReason = '';
    this.bestKey = 'velvet-shadow-best-total';
    this.best = +(localStorage.getItem(this.bestKey) || 0);
    this.setupInput();
    this.showTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- level loading ----------
  loadLevel(idx) {
    const def = LEVELS[idx];
    this.levelIdx = idx;
    this.def = def;
    this.grid = normalizeMap(def.map).map((r) => r.split(''));
    this.palette = def.palette;
    this.loot = [];
    this.exit = null;
    this.closets = [];
    this.lasers = (def.lasers || []).map((l) => ({ ...l }));
    let px = 0, py = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = this.grid[y][x];
        if (c === 'P') { px = (x + 0.5) * TILE; py = (y + 0.5) * TILE; this.grid[y][x] = '.'; }
        if (c === 'E') { this.exit = { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }; this.grid[y][x] = '.'; }
        if (c === 'C') this.closets.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });
        if (c === 'p' || c === 'g' || c === 'j' || c === 'd') {
          this.loot.push(new Loot(x, y, c));
          this.grid[y][x] = '.';
        }
      }
    }
    this.player = {
      x: px, y: py, facing: 0, sneak: false, run: false,
      hidden: false, hiddenCloset: null, speed: 150, stepAcc: 0,
    };
    this.guards = def.guards.map((g) => new Guard(g, this.grid));
    this.cameras = def.cameras.map((c) => new Camera(c));
    this.lootLeft = this.loot.length;
    this.levelTime = 0;
    this.alarm = 0;
    this.particles = [];
    this.moveTarget = null;
    this.renderer.prepareLevel(idx, this.grid);
    this.updateHud();
  }

  get lootValue() {
    return this.loot.filter((l) => l.taken).reduce((s, l) => s + l.def.value, 0);
  }

  // ---------- input ----------
  setupInput() {
    const cv = this.cv;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'c' && !e.repeat) this.player && (this.player.sneak = !this.player.sneak);
      if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && !e.repeat) this.togglePause();
      if (e.key.toLowerCase() === 'm' && !e.repeat) {
        const m = this.sound.toggleMute();
        $('muteBtn').textContent = m ? '🔇' : '🔊';
      }
      if (e.key.toLowerCase() === 'e' && this.state === 'playing') this.tryHideToggle();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    cv.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * (cv.width / r.width);
      const y = (e.clientY - r.top) * (cv.height / r.height);
      this.moveTarget = { x, y };
      this.sound.ensure();
    });
    $('startBtn').addEventListener('click', () => { this.sound.ensure(); this.sound.startMusic(); this.sound.click(); this.startRun(); });
    $('retryBtn').addEventListener('click', () => { this.sound.click(); this.retryLevel(); });
    $('nextBtn').addEventListener('click', () => { this.sound.click(); this.nextLevel(); });
    $('againBtn').addEventListener('click', () => { this.sound.click(); this.startRun(); });
    $('resumeBtn').addEventListener('click', () => { this.sound.click(); this.togglePause(); });
    $('muteBtn').addEventListener('click', () => {
      const m = this.sound.toggleMute();
      $('muteBtn').textContent = m ? '🔇' : '🔊';
    });
    $('titleBtn').addEventListener('click', () => { this.sound.click(); this.showTitle(); });
  }

  // ---------- flow ----------
  startRun() {
    this.totalLoot = 0;
    this.totalTime = 0;
    this.loadLevel(0);
    this.showIntro();
  }
  retryLevel() {
    this.totalLoot -= this.lootValue;
    this.loadLevel(this.levelIdx);
    this.showIntro();
  }
  nextLevel() {
    this.totalTime += this.levelTime;
    if (this.levelIdx + 1 >= LEVELS.length) { this.showWin(); return; }
    this.loadLevel(this.levelIdx + 1);
    this.showIntro();
  }
  showTitle() {
    this.state = 'title';
    this.loadLevel(0);
    this.setOverlay('titleScreen', true);
    ['introScreen', 'pauseScreen', 'doneScreen', 'caughtScreen', 'winScreen'].forEach((id) => this.setOverlay(id, false));
    this.updateHud();
  }
  showIntro() {
    this.state = 'intro';
    $('introTitle').textContent = `LEVEL ${this.levelIdx + 1} — ${this.def.name}`;
    $('introSub').textContent = this.def.sub;
    this.setOverlay('introScreen', true);
    ['titleScreen', 'pauseScreen', 'doneScreen', 'caughtScreen', 'winScreen'].forEach((id) => this.setOverlay(id, false));
    this.introT = 0;
  }
  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.setOverlay('pauseScreen', true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.setOverlay('pauseScreen', false);
    }
  }
  showLevelDone() {
    this.state = 'leveldone';
    this.sound.levelDone();
    $('doneTitle').textContent = `${this.def.name} — CLEARED`;
    $('doneStats').textContent = `Loot $${this.lootValue.toLocaleString()}  •  Time ${this.fmt(this.levelTime)}  •  Alarm peak ${Math.round(this.peakAlarm || 0)}%`;
    $('nextBtn').textContent = this.levelIdx + 1 >= LEVELS.length ? 'FINISH THE HEIST →' : 'NEXT LEVEL →';
    this.setOverlay('doneScreen', true);
  }
  showCaught(reason) {
    if (this.state !== 'playing') return;
    this.state = 'caught';
    this.caughtReason = reason;
    this.sound.caught();
    this.sound.stopAlarm();
    $('caughtReason').textContent = reason;
    $('caughtStats').textContent = `Loot kept $${this.totalLoot.toLocaleString()}  •  ${this.def.name}`;
    this.setOverlay('caughtScreen', true);
  }
  showWin() {
    this.state = 'win';
    this.sound.win();
    this.sound.stopAlarm();
    const total = this.totalTime + this.levelTime;
    const isBest = !this.best || total < this.best;
    if (isBest) {
      this.best = total;
      localStorage.setItem(this.bestKey, String(Math.round(total * 10) / 10));
    }
    $('winStats').textContent = `Total loot $${this.totalLoot.toLocaleString()}  •  Total time ${this.fmt(total)}${isBest ? '  •  NEW BEST TIME!' : `  •  Best ${this.fmt(this.best)}`}`;
    this.setOverlay('winScreen', true);
  }
  setOverlay(id, on) { $(id).classList.toggle('hidden', !on); }

  fmt(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // ---------- interaction ----------
  tryHideToggle() {
    const pl = this.player;
    if (pl.hidden) { pl.hidden = false; pl.hiddenCloset = null; return; }
    for (const c of this.closets) {
      if (dist(pl.x, pl.y, c.x, c.y) < 34) {
        pl.hidden = true; pl.hiddenCloset = c;
        pl.x = c.x; pl.y = c.y;
        this.sound.click();
        return;
      }
    }
  }
  nearestCamera() {
    let best = null; let bd = 1e9;
    for (const cam of this.cameras) {
      if (cam.disabled) continue;
      const d = dist(this.player.x, this.player.y, cam.x, cam.y);
      if (d < bd) { bd = d; best = cam; }
    }
    return bd < 80 ? best : null;
  }

  // ---------- update ----------
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.state === 'playing') {
      if (!this.frozen) this.update(dt);
    }
    if (this.state === 'intro') {
      this.introT += dt;
      if (this.introT > 1.6) {
        this.state = 'playing';
        this.setOverlay('introScreen', false);
      }
    }
    this.renderer.draw(this, dt);
    this.updateHud();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  update(dt) {
    this.time += dt;
    this.levelTime += dt;
    const pl = this.player;
    // --- movement ---
    let mx = 0, my = 0;
    if (this.keys['w'] || this.keys['arrowup']) my -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) my += 1;
    if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) mx += 1;
    if (mx || my) this.moveTarget = null;
    if (this.moveTarget) {
      const dx = this.moveTarget.x - pl.x;
      const dy = this.moveTarget.y - pl.y;
      if (Math.hypot(dx, dy) < 8) this.moveTarget = null;
      else { mx = dx / Math.hypot(dx, dy); my = dy / Math.hypot(dx, dy); }
    }
    pl.run = !!(this.keys['shift']) && !pl.sneak;
    const speed = pl.sneak ? 85 : pl.run ? 235 : 150;
    if ((mx || my) && !pl.hidden) {
      const len = Math.hypot(mx, my);
      const nx = pl.x + (mx / len) * speed * dt;
      const ny = pl.y + (my / len) * speed * dt;
      pl.facing = Math.atan2(my, mx);
      if (!this.hitsWall(nx, pl.y)) pl.x = nx;
      if (!this.hitsWall(pl.x, ny)) pl.y = ny;
      pl.stepAcc += speed * dt;
      if (pl.stepAcc > (pl.run ? 26 : 34)) {
        pl.stepAcc = 0;
        this.sound.step(pl.run);
        if (pl.run) this.hearing = { x: pl.x, y: pl.y, r: 170 };
      }
    }
    if (this.hearing) this.hearing.r = Math.max(0, this.hearing.r - dt * 220);

    // --- guards & cameras ---
    let anySee = false;
    for (const gd of this.guards) {
      gd.update(dt, pl, this.grid, this.hearing);
      if (gd.state === 'alarmed') anySee = true;
      if (!pl.hidden && dist(gd.x, gd.y, pl.x, pl.y) < 24) {
        this.showCaught('A guard grabbed you in the dark.');
        return;
      }
    }
    let camSee = 0;
    for (const cam of this.cameras) {
      const v = cam.update(dt, pl, this.grid);
      camSee = Math.max(camSee, v);
      if (v > 0.12) anySee = true;
    }
    if (camSee > 0.12) this.alarm = Math.min(100, this.alarm + camSee * 42 * dt);
    const alarmed = this.guards.some((g) => g.state === 'alarmed');
    if (alarmed) this.alarm = Math.min(100, this.alarm + 16 * dt);
    if (this.guards.some((g) => g.state === 'suspicious')) this.alarm = Math.min(100, this.alarm + 4 * dt);

    // --- alarm decay (faster when hidden) ---
    const inShadow = this.tileAt(pl.x, pl.y) === ',';
    if (!anySee && camSee <= 0.12 && !alarmed) {
      const rate = pl.hidden ? 22 : inShadow ? 14 : 6;
      this.alarm = Math.max(0, this.alarm - rate * dt);
    }
    this.peakAlarm = Math.max(this.peakAlarm || 0, this.alarm);
    if (this.alarm > 55) this.sound.startAlarm(); else this.sound.stopAlarm();
    if (this.alarm > 70 && !this.alarmWarned) {
      this.alarmWarned = true;
      this.renderer.addShake(7);
      this.sound.spotted();
    }
    if (this.alarm < 40) this.alarmWarned = false;

    // --- hack ---
    const cam = this.nearestCamera();
    if (cam && this.keys['e'] && !pl.hidden) {
      cam.hack += dt / 2.2;
      if (Math.random() < dt * 8) this.sound.hackTick(cam.hack);
      if (cam.hack >= 1) {
        cam.disabled = true;
        burst(this.particles, cam.x, cam.y, '#ffd166', 18, 140);
        this.sound.hackDone();
      }
    } else if (cam) {
      cam.hack = Math.max(0, cam.hack - dt * 0.5);
    }

    // --- loot pickup ---
    for (const l of this.loot) {
      if (!l.taken && dist(pl.x, pl.y, l.x, l.y) < 26) {
        l.taken = true;
        this.lootLeft--;
        burst(this.particles, l.x, l.y, l.def.color, 18, 130);
        this.sound.pickup(l.def.value);
      }
    }

    // --- lasers ---
    for (const l of this.lasers) {
      const on = Math.sin((this.time + l.phase) * 2.2) > -0.2;
      if (!on) continue;
      const x1 = l.x1 * TILE, y1 = (l.y1 + 0.5) * TILE;
      const x2 = l.x2 * TILE, y2 = (l.y2 + 0.5) * TILE;
      if (this.segHitsPlayer(x1, y1, x2, y2)) {
        if (!l.hitCd || this.time > l.hitCd) {
          l.hitCd = this.time + 1.2;
          this.alarm = Math.min(100, this.alarm + 25);
          burst(this.particles, pl.x, pl.y, '#ff4d5e', 16, 150);
          this.renderer.addShake(6);
          this.sound.laserZap();
        }
      }
    }

    // --- particles ---
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter((p) => !p.dead);

    // --- exit ---
    if (this.exit && this.lootLeft === 0 && dist(pl.x, pl.y, this.exit.x, this.exit.y) < 30) {
      this.totalLoot += this.lootValue;
      burst(this.particles, this.exit.x, this.exit.y, '#37e08a', 24, 160);
      this.showLevelDone();
    }
  }

  segHitsPlayer(x1, y1, x2, y2) {
    const pl = this.player;
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let t = ((pl.x - x1) * dx + (pl.y - y1) * dy) / (len2 || 1);
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return Math.hypot(pl.x - cx, pl.y - cy) < 16;
  }

  tileAt(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (ty < 0 || ty >= this.grid.length || tx < 0 || tx >= this.grid[0].length) return '#';
    return this.grid[ty][tx];
  }

  hitsWall(x, y) {
    const r = 12;
    for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const c = this.tileAt(cx, cy);
      if (c === '#' || c === 'T' || c === 'A') return true;
    }
    return false;
  }

  // ---------- HUD ----------
  updateHud() {
    $('hudLevel').textContent = `LEVEL ${this.levelIdx + 1} · ${this.def ? this.def.name : ''}`;
    $('hudLoot').textContent = `$${(this.totalLoot + (this.lootValue || 0)).toLocaleString()}`;
    const alarmEl = $('alarmFill');
    alarmEl.style.width = `${Math.round(this.alarm || 0)}%`;
    alarmEl.style.background = this.alarm > 70 ? '#ff4d5e' : this.alarm > 35 ? '#ffb042' : '#37e08a';
    $('alarmText').textContent = this.alarm > 70 ? 'ALARM!' : this.alarm > 35 ? 'SUSPICIOUS' : 'QUIET';
    $('hudTime').textContent = this.fmt((this.totalTime || 0) + (this.levelTime || 0));
    $('hudBest').textContent = this.best ? `BEST ${this.fmt(this.best)}` : '';
    const left = this.lootLeft ?? 0;
    $('hudLootLeft').textContent = left === 0 ? 'EXIT OPEN' : `${left} LOOT LEFT`;
  }
}

// ---------- boot + screenshot staging ----------
function stageScene(game, scene) {
  const pl = game.player;
  const setGuard = (i, tx, ty, facingDeg, state, alert) => {
    const g = game.guards[i];
    if (!g) return;
    g.x = (tx + 0.5) * TILE; g.y = (ty + 0.5) * TILE;
    g.facing = (facingDeg * Math.PI) / 180;
    g.state = state; g.alert = alert;
    g.lastSeen = state === 'alarmed' ? { x: pl.x, y: pl.y } : null;
  };
  if (scene === 'cover') {
    game.loadLevel(0);
    pl.x = 20.5 * TILE; pl.y = 8.5 * TILE; pl.facing = Math.PI;
    setGuard(0, 14, 8, 0, 'suspicious', 0.5);
    game.alarm = 35;
  } else if (scene === 'chase') {
    game.loadLevel(0);
    pl.x = 16.5 * TILE; pl.y = 8.5 * TILE; pl.facing = Math.PI;
    setGuard(0, 13, 8, 0, 'alarmed', 0.9);
    game.alarm = 78;
  } else if (scene === 'vault') {
    game.loadLevel(1);
    pl.x = 15.5 * TILE; pl.y = 8.5 * TILE; pl.facing = -Math.PI / 2;
    setGuard(2, 15, 13, -90, 'suspicious', 0.45);
    game.alarm = 20;
  } else if (scene === 'rooftop') {
    game.loadLevel(3);
    pl.x = 15.5 * TILE; pl.y = 8.5 * TILE; pl.facing = Math.PI / 2;
    setGuard(2, 15, 12, 90, 'alarmed', 0.85);
    game.alarm = 55;
  }
  game.state = 'playing';
  game.frozen = true;
  game.setOverlay('titleScreen', false);
  ['introScreen', 'pauseScreen', 'doneScreen', 'caughtScreen', 'winScreen'].forEach((id) => game.setOverlay(id, false));
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.__heist = {
    game,
    start: () => game.startRun(),
    state: () => ({
      state: game.state,
      level: game.levelIdx + 1,
      alarm: Math.round(game.alarm),
      lootValue: game.lootValue,
      lootLeft: game.lootLeft,
      player: { x: Math.round(game.player.x), y: Math.round(game.player.y), hidden: game.player.hidden, sneak: game.player.sneak },
      guards: game.guards.map((g) => ({ state: g.state, alert: +g.alert.toFixed(2), x: Math.round(g.x), y: Math.round(g.y) })),
      cameras: game.cameras.map((c) => ({ disabled: c.disabled, hack: +c.hack.toFixed(2), sees: +c.sees.toFixed(2) })),
    }),
  };
  const scene = new URLSearchParams(location.search).get('scene');
  if (scene) {
    game.sound.ensure();
    stageScene(game, scene);
  }
});
