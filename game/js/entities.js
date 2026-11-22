// VELVET SHADOW — entities: guards, cameras, loot, particles, line of sight.
import { TILE, LOOT_DEFS } from './levels.js';

export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Grid raycast: true when the segment is blocked by a wall/table/plant tile.
export function losBlocked(grid, ax, ay, bx, by) {
  const d = dist(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(d / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
    const c = grid[ty][tx];
    if (c === '#' || c === 'T' || c === 'A') return true;
  }
  return false;
}

// Is the player inside a vision cone (range, half-angle, facing) with clear LOS?
export function inCone(grid, ox, oy, facing, range, halfAngle, px, py) {
  const d = dist(ox, oy, px, py);
  if (d > range) return 0;
  const a = Math.atan2(py - oy, px - ox);
  const diff = Math.abs(angDiff(a, facing));
  if (diff > halfAngle) return 0;
  if (losBlocked(grid, ox, oy, px, py)) return 0;
  // Visibility fades with distance and angle.
  return Math.max(0, 1 - d / range) * (1 - diff / halfAngle * 0.5);
}

export class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life; this.color = color; this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vy += 60 * dt; this.life -= dt;
  }
  get dead() { return this.life <= 0; }
}

export function burst(particles, x, y, color, n = 14, speed = 120) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 40,
      0.5 + Math.random() * 0.5, color, 2 + Math.random() * 3));
  }
}

export class Guard {
  constructor(def, grid) {
    this.wp = def.wp.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }));
    this.x = this.wp[0].x; this.y = this.wp[0].y;
    this.speed = def.speed * TILE * 0.55;
    this.wpi = 1;
    this.facing = 0;
    this.state = 'calm'; // calm | suspicious | alarmed
    this.alert = 0; // 0..1
    this.lastSeen = null;
    this.suspicion = null; // {x, y} point to investigate
    this.pauseT = 0;
    this.stepT = 0;
    this.lastX = this.x; this.lastY = this.y; this.stuckT = 0;
  }
  update(dt, player, grid, hearing) {
    const vis = player.hidden ? 0 : inCone(grid, this.x, this.y, this.facing,
      player.sneak ? 130 : 210, 0.62, player.x, player.y);
    if (vis > 0.12) {
      this.alert = Math.min(1, this.alert + dt * (0.35 + vis * 1.5));
      this.lastSeen = { x: player.x, y: player.y };
    } else {
      this.alert = Math.max(0, this.alert - dt * 0.25);
    }
    // Hearing: a loud noise nearby draws the guard.
    if (hearing && dist(this.x, this.y, hearing.x, hearing.y) < hearing.r) {
      if (this.state !== 'alarmed') {
        this.alert = Math.max(this.alert, 0.45);
        this.suspicion = { x: hearing.x, y: hearing.y };
      }
    }
    const prev = this.state;
    this.state = this.alert > 0.72 ? 'alarmed' : this.alert > 0.32 ? 'suspicious' : 'calm';
    if (this.state === 'alarmed' && prev !== 'alarmed') this.suspicion = null;

    let target = null;
    let spd = this.speed;
    if (this.state === 'alarmed' && this.lastSeen) {
      target = this.lastSeen; spd = this.speed * 1.85;
    } else if (this.state === 'suspicious' && this.suspicion) {
      target = this.suspicion; spd = this.speed * 1.25;
    } else if (this.state === 'suspicious' && this.lastSeen) {
      target = this.lastSeen; spd = this.speed * 1.25;
    }
    if (target) {
      this.moveToward(target.x, target.y, spd, dt, grid);
      if (dist(this.x, this.y, target.x, target.y) < 14) {
        if (this.state === 'suspicious') { this.suspicion = null; this.alert = Math.max(0.2, this.alert - 0.2); }
        this.lastSeen = null;
      }
    } else {
      if (this.pauseT > 0) {
        this.pauseT -= dt;
        this.facing += dt * 0.9; // look around at waypoint
      } else {
        const w = this.wp[this.wpi];
        this.moveToward(w.x, w.y, spd, dt, grid);
        if (dist(this.x, this.y, w.x, w.y) < 10) {
          this.wpi = (this.wpi + 1) % this.wp.length;
          this.pauseT = 0.9;
        }
      }
    }
    this.stepT += dt;
    // Stuck fallback: a waypoint blocked by furniture must not pin the guard.
    if (dist(this.x, this.y, this.lastX, this.lastY) < 1.5) {
      this.stuckT += dt;
      if (this.stuckT > 1.5) {
        this.stuckT = 0;
        this.wpi = (this.wpi + 1) % this.wp.length;
        this.suspicion = null;
        this.lastSeen = null;
        this.alert = Math.max(0.2, this.alert - 0.3);
      }
    } else {
      this.stuckT = 0;
    }
    this.lastX = this.x; this.lastY = this.y;
  }
  moveToward(tx, ty, spd, dt, grid) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const nx = this.x + (dx / d) * spd * dt;
    const ny = this.y + (dy / d) * spd * dt;
    this.facing = Math.atan2(dy, dx);
    if (!this.hitsWall(grid, nx, this.y)) this.x = nx;
    if (!this.hitsWall(grid, this.x, ny)) this.y = ny;
  }
  hitsWall(grid, x, y) {
    const r = 12;
    for (const [cx, cy] of [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]) {
      const tx = Math.floor(cx / TILE);
      const ty = Math.floor(cy / TILE);
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
      const c = grid[ty][tx];
      if (c === '#' || c === 'T' || c === 'A') return true;
    }
    return false;
  }
}

export class Camera {
  constructor(def) {
    this.x = (def.tx + 0.5) * TILE;
    this.y = (def.ty + 0.5) * TILE;
    this.base = (def.angle * Math.PI) / 180;
    this.arc = (def.arc * Math.PI) / 180;
    this.speed = def.speed;
    this.t = Math.random() * 10;
    this.disabled = false;
    this.hack = 0; // 0..1
    this.sees = 0;
  }
  get facing() {
    return this.base + Math.sin(this.t * this.speed) * this.arc / 2;
  }
  update(dt, player, grid) {
    this.t += dt;
    if (this.disabled) { this.sees = 0; return 0; }
    const vis = player.hidden ? 0 : inCone(grid, this.x, this.y, this.facing, 230, 0.5, player.x, player.y);
    this.sees = vis;
    return vis;
  }
}

export class Loot {
  constructor(tx, ty, kind) {
    this.x = (tx + 0.5) * TILE;
    this.y = (ty + 0.5) * TILE;
    this.kind = kind;
    this.def = LOOT_DEFS[kind];
    this.taken = false;
    this.bob = Math.random() * 6;
  }
}
