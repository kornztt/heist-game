// Gilded Heist — entities: guards, cameras, line of sight, movement and alarm.
// One job: how the world reacts — patrols, suspicion, chases, camera sweeps,
// who can see the thief, and how the alarm meter rises and falls.

import { PLAY } from './levels.js';

export const GUARD_RANGE = 210;
export const GUARD_FOV = (75 * Math.PI) / 180;
export const CAMERA_RANGE = 240;
export const CAMERA_FOV = (55 * Math.PI) / 180;
export const CATCH_RADIUS = 26;
export const PLAYER_RADIUS = 14;

const TAU = Math.PI * 2;

export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function circleHitsWall(x, y, radius, walls) {
  for (const w of walls) {
    const nx = clamp(x, w.x, w.x + w.w);
    const ny = clamp(y, w.y, w.y + w.h);
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

// Move a circle against the walls, axis by axis, and clamp it inside the playfield.
export function moveCircle(body, dx, dy, walls) {
  const nx = clamp(body.x + dx, PLAY.x + body.r, PLAY.x + PLAY.w - body.r);
  if (!circleHitsWall(nx, body.y, body.r, walls)) body.x = nx;
  const ny = clamp(body.y + dy, PLAY.y + body.r, PLAY.y + PLAY.h - body.r);
  if (!circleHitsWall(body.x, ny, body.r, walls)) body.y = ny;
}

// True when the segment (x1,y1)-(x2,y2) is not cut by any wall.
export function hasLineOfSight(x1, y1, x2, y2, walls) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    for (const w of walls) {
      if (pointInRect(px, py, w)) return false;
    }
  }
  return true;
}

export function inShadow(x, y, shadows) {
  for (const s of shadows) if (pointInRect(x, y, s)) return true;
  return false;
}

// Build live guard objects from a level definition.
export function makeGuards(defs) {
  return defs.map((d) => ({
    name: d.name,
    x: d.waypoints[0].x,
    y: d.waypoints[0].y,
    r: 15,
    waypoints: d.waypoints,
    wpIndex: 1,
    facing: 0,
    state: 'patrol', // patrol | suspicious | alert
    awareness: 0,
    lastSeen: null,
    loseSightTimer: 0,
    investigateTimer: 0,
  }));
}

export function makeCameras(defs) {
  return defs.map((d) => ({
    x: d.x,
    y: d.y,
    baseAngle: d.baseAngle,
    sweep: d.sweep,
    speed: d.speed,
    phase: Math.random() * TAU,
    disabled: false,
  }));
}

export function cameraAngle(cam, time) {
  return cam.baseAngle + Math.sin(time * cam.speed + cam.phase) * cam.sweep;
}

// Does this viewer see the player? Returns 0 when not seen, else a 0..1 strength
// (1 when the thief is close and fully exposed).
export function seesPlayer(viewer, range, fov, player, walls, sneaking) {
  const dx = player.x - viewer.x;
  const dy = player.y - viewer.y;
  const dist = Math.hypot(dx, dy);
  let effRange = range;
  if (sneaking) effRange *= 0.7;
  if (player.inShadow) effRange *= 0.6;
  if (dist > effRange) return 0;
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, viewer.facing)) > fov / 2) return 0;
  if (!hasLineOfSight(viewer.x, viewer.y, player.x, player.y, walls)) return 0;
  let strength = 1.15 - dist / effRange;
  if (sneaking) strength *= 0.6;
  if (player.inShadow) strength *= 0.55;
  return clamp(strength, 0.15, 1);
}

function guardSpeed(guard) {
  if (guard.state === 'alert') return 112;
  if (guard.state === 'suspicious') return 86;
  return 56;
}

function stepToward(guard, tx, ty, dt, walls) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const sp = guardSpeed(guard);
  const step = Math.min(dist, sp * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  guard.facing = Math.atan2(dy, dx);
  moveCircle(guard, nx - guard.x, ny - guard.y, walls);
  return dist <= step + 1;
}

// One guard tick. Returns 'caught' when the guard grabs the thief.
export function updateGuard(guard, player, walls, dt, onSpotted) {
  const seen = seesPlayer(guard, GUARD_RANGE, GUARD_FOV, player, walls, player.sneaking);
  if (seen > 0) {
    guard.awareness = clamp(guard.awareness + seen * 1.25 * dt, 0, 1);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSightTimer = 0;
    if (onSpotted) onSpotted(guard, seen);
  } else {
    guard.awareness = clamp(guard.awareness - 0.45 * dt, 0, 1);
    guard.loseSightTimer += dt;
  }

  if (guard.awareness >= 0.85) guard.state = 'alert';
  else if (guard.awareness >= 0.5) guard.state = 'suspicious';
  else if (guard.state !== 'patrol' && guard.loseSightTimer > 4) {
    guard.state = 'patrol';
    guard.lastSeen = null;
  }

  if (guard.state === 'alert') {
    const target = guard.lastSeen || { x: player.x, y: player.y };
    stepToward(guard, target.x, target.y, dt, walls);
    if (guard.loseSightTimer > 2.5 && guard.lastSeen) {
      guard.state = 'suspicious';
      guard.investigateTimer = 3;
    }
  } else if (guard.state === 'suspicious') {
    if (guard.lastSeen) {
      const arrived = stepToward(guard, guard.lastSeen.x, guard.lastSeen.y, dt, walls);
      if (arrived) {
        guard.investigateTimer -= dt;
        guard.facing += dt * 1.5;
        if (guard.investigateTimer <= 0) {
          guard.state = 'patrol';
          guard.lastSeen = null;
        }
      } else {
        guard.investigateTimer = 3;
      }
    }
  } else {
    const wp = guard.waypoints[guard.wpIndex];
    const arrived = stepToward(guard, wp.x, wp.y, dt, walls);
    if (arrived) guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
  }

  const d = Math.hypot(player.x - guard.x, player.y - guard.y);
  if (d < CATCH_RADIUS) return 'caught';
  return null;
}

// One camera tick. Returns the alarm rise rate while the thief is in its cone.
export function updateCamera(cam, player, walls, time) {
  if (cam.disabled) return 0;
  const viewer = { x: cam.x, y: cam.y, facing: cameraAngle(cam, time) };
  const seen = seesPlayer(viewer, CAMERA_RANGE, CAMERA_FOV, player, walls, player.sneaking);
  return seen > 0 ? 18 * (0.5 + seen) : 0;
}

// A dash is loud: guards nearby turn suspicious and come looking.
export function noiseAlert(guards, x, y, radius) {
  for (const g of guards) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < radius && g.state === 'patrol') {
      g.state = 'suspicious';
      g.awareness = Math.max(g.awareness, 0.6);
      g.lastSeen = { x, y };
      g.investigateTimer = 3;
    }
  }
}
