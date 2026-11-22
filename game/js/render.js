// Gilded Heist — rendering: everything the player sees.
// One job: draw the room, the cones, the loot, the thief, the HUD and the screens.

import { PLAY } from './levels.js';
import { GUARD_RANGE, GUARD_FOV, CAMERA_RANGE, CAMERA_FOV, cameraAngle, angleDiff } from './entities.js';

const GOLD = '#e8b64c';
const GOLD_DIM = '#8a6d2f';
const INK = '#0d1526';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, facing, range, fov, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - fov / 2, facing + fov / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function fmtTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const t = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`;
}

export function drawFloor(ctx, level, time) {
  ctx.fillStyle = '#101827';
  ctx.fillRect(PLAY.x, PLAY.y, PLAY.w, PLAY.h);
  // Checker tiles.
  ctx.fillStyle = '#131e33';
  const tile = 58;
  for (let y = PLAY.y; y < PLAY.y + PLAY.h; y += tile) {
    for (let x = PLAY.x; x < PLAY.x + PLAY.w; x += tile) {
      const odd = (Math.floor((x - PLAY.x) / tile) + Math.floor((y - PLAY.y) / tile)) % 2 === 0;
      if (odd) ctx.fillRect(x, y, tile, tile);
    }
  }
  // Carpet runner down the middle of each room.
  ctx.fillStyle = 'rgba(122, 31, 47, 0.35)';
  ctx.fillRect(PLAY.x + 40, PLAY.y + PLAY.h / 2 - 34, PLAY.w - 80, 68);
  // Shadow patches: dark cover where the alarm falls fast.
  for (const s of level.shadows) {
    ctx.fillStyle = 'rgba(6, 12, 34, 0.62)';
    roundRect(ctx, s.x, s.y, s.w, s.h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 160, 255, 0.35)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(140, 175, 255, 0.55)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHADOW', s.x + s.w / 2, s.y + s.h / 2 + 4);
  }
  // Walls with a gold cap.
  for (const w of level.walls) {
    ctx.fillStyle = '#2b3648';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = GOLD_DIM;
    if (w.w >= w.h) ctx.fillRect(w.x, w.y, w.w, 4);
    else ctx.fillRect(w.x, w.y, 4, w.h);
  }
  // Playfield border.
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 3;
  ctx.strokeRect(PLAY.x, PLAY.y, PLAY.w, PLAY.h);
}

function drawLoot(ctx, loot, time) {
  for (const item of loot) {
    if (item.taken) continue;
    const bob = Math.sin(time * 2.4 + item.x) * 3;
    const y = item.y + bob;
    ctx.save();
    ctx.translate(item.x, y);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 16;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 13);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(item.x - 3, y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 182, 76, 0.9)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, item.x, y + 30);
  }
}

function drawExit(ctx, exit, open, time) {
  const pulse = open ? 0.55 + Math.sin(time * 4) * 0.25 : 0.25;
  ctx.save();
  ctx.shadowColor = open ? '#39d98a' : '#e05252';
  ctx.shadowBlur = open ? 22 : 8;
  ctx.fillStyle = open ? `rgba(57, 217, 138, ${pulse})` : 'rgba(224, 82, 82, 0.5)';
  roundRect(ctx, exit.x - 26, exit.y - 26, 52, 52, 8);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = open ? '#39d98a' : '#e05252';
  ctx.lineWidth = 2.5;
  roundRect(ctx, exit.x - 26, exit.y - 26, 52, 52, 8);
  ctx.stroke();
  ctx.fillStyle = open ? '#0a2018' : '#2a0d0d';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCK', exit.x, exit.y + 4);
}

function drawCamera(ctx, cam, time) {
  const ang = cameraAngle(cam, time);
  if (!cam.disabled) {
    drawCone(ctx, cam.x, cam.y, ang, CAMERA_RANGE, CAMERA_FOV, 'rgba(240, 190, 60, 0.13)');
  }
  ctx.fillStyle = cam.disabled ? '#3a4a63' : '#f0be3c';
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0d1526';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(cam.x + Math.cos(ang) * 15, cam.y + Math.sin(ang) * 15);
  ctx.stroke();
  if (cam.disabled) {
    ctx.fillStyle = '#7dd3a8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HACKED', cam.x, cam.y - 16);
  } else {
    ctx.fillStyle = 'rgba(240, 190, 60, 0.85)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CAM', cam.x, cam.y - 16);
  }
}

function drawGuard(ctx, guard) {
  const alert = guard.state === 'alert';
  const susp = guard.state === 'suspicious';
  const coneColor = alert
    ? 'rgba(224, 82, 82, 0.30)'
    : susp
      ? 'rgba(240, 150, 60, 0.22)'
      : 'rgba(224, 82, 82, 0.14)';
  drawCone(ctx, guard.x, guard.y, guard.facing, GUARD_RANGE, GUARD_FOV, coneColor);
  // Body: dark uniform with a cap brim.
  ctx.fillStyle = alert ? '#7a1f2b' : '#31405c';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alert ? '#ff6b6b' : '#8fa3c8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = alert ? '#ff6b6b' : '#c8d4ea';
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.facing) * 20, guard.y + Math.sin(guard.facing) * 20);
  ctx.lineTo(guard.x + Math.cos(guard.facing + 2.6) * 10, guard.y + Math.sin(guard.facing + 2.6) * 10);
  ctx.lineTo(guard.x + Math.cos(guard.facing - 2.6) * 10, guard.y + Math.sin(guard.facing - 2.6) * 10);
  ctx.closePath();
  ctx.fill();
  // Awareness "?" / "!" above the head.
  if (guard.state !== 'patrol') {
    ctx.fillStyle = alert ? '#ff6b6b' : '#f0be3c';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(alert ? '!' : '?', guard.x, guard.y - 24);
  }
  ctx.fillStyle = 'rgba(200, 212, 234, 0.8)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y + 30);
}

function drawPlayer(ctx, player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.shadowColor = '#39d0c4';
  ctx.shadowBlur = player.sneaking ? 4 : 12;
  ctx.fillStyle = '#123f3a';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#39d0c4';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  // Gold mask stripe facing the movement direction.
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(player.facing - 0.5) * 10, player.y + Math.sin(player.facing - 0.5) * 10);
  ctx.arc(player.x, player.y, 10, player.facing - 0.5, player.facing + 0.5);
  ctx.stroke();
  ctx.fillStyle = '#d7fff8';
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.facing) * 16, player.y + Math.sin(player.facing) * 16, 3, 0, Math.PI * 2);
  ctx.fill();
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(215, 255, 248, 0.8)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAKING', player.x, player.y - 22);
  }
  ctx.fillStyle = 'rgba(215, 255, 248, 0.8)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('YOU', player.x, player.y + 28);
}

export function drawWorld(ctx, game, time) {
  const level = game.level;
  drawFloor(ctx, level, time);
  drawExit(ctx, level.exit, game.lootLeft === 0, time);
  drawLoot(ctx, level.loot, time);
  for (const cam of game.cameras) drawCamera(ctx, cam, time);
  for (const guard of game.guards) drawGuard(ctx, guard);
  drawPlayer(ctx, game.player);
  // "Hack" prompt when a live camera is in reach.
  if (game.nearCamera) {
    ctx.fillStyle = '#0d1526';
    roundRect(ctx, game.player.x - 110, game.player.y - 62, 220, 26, 6);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    roundRect(ctx, game.player.x - 110, game.player.y - 62, 220, 26, 6);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press E to hack this camera (+6 alarm)', game.player.x, game.player.y - 44);
  }
}

export function drawHud(ctx, game) {
  ctx.fillStyle = '#0a1120';
  ctx.fillRect(0, 0, 1280, 84);
  ctx.fillStyle = GOLD_DIM;
  ctx.fillRect(0, 84, 1280, 3);
  ctx.fillStyle = '#e8eefc';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(game.level.name.toUpperCase(), 24, 34);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#9fb0d0';
  ctx.fillText(`LEVEL ${game.levelIndex + 1} / 3`, 24, 58);
  // Loot counter.
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`◆ LOOT  ${game.lootGot} / ${game.lootTotal}`, 330, 34);
  ctx.fillStyle = '#9fb0d0';
  ctx.font = '13px monospace';
  ctx.fillText(game.lootLeft === 0 ? 'All loot grabbed — reach the EXIT!' : 'Grab every prize to unlock the exit', 330, 58);
  // Alarm meter.
  const ax = 700;
  const aw = 300;
  const ratio = game.alarm / 100;
  ctx.fillStyle = '#e8eefc';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, 30);
  ctx.fillStyle = '#1c2942';
  roundRect(ctx, ax, 40, aw, 20, 5);
  ctx.fill();
  const alarmColor = ratio < 0.4 ? '#39d98a' : ratio < 0.7 ? '#f0be3c' : '#e05252';
  ctx.fillStyle = alarmColor;
  if (aw * ratio > 4) {
    roundRect(ctx, ax, 40, aw * ratio, 20, 5);
    ctx.fill();
  }
  ctx.strokeStyle = '#e8eefc';
  ctx.lineWidth = 1.5;
  roundRect(ctx, ax, 40, aw, 20, 5);
  ctx.stroke();
  ctx.fillStyle = ratio >= 0.7 && Math.floor(game.time * 4) % 2 === 0 ? '#ff6b6b' : '#9fb0d0';
  ctx.font = '13px monospace';
  ctx.fillText(`${Math.floor(game.alarm)}%`, ax + aw + 12, 56);
  // Timer and best.
  ctx.fillStyle = '#e8eefc';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(fmtTime(game.runMs), 1256, 34);
  ctx.fillStyle = '#9fb0d0';
  ctx.font = '13px monospace';
  ctx.fillText(game.bestMs ? `BEST ${fmtTime(game.bestMs)}` : 'BEST —', 1256, 58);
  // Bottom hint bar.
  ctx.fillStyle = '#0a1120';
  ctx.fillRect(0, 676, 1280, 44);
  ctx.fillStyle = '#7c8aa8';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD / Arrows — move      C — sneak      SHIFT — dash (loud!)      E — hack camera      M — music',
    640,
    702,
  );
}

function drawPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6, 10, 22, 0.82)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = INK;
  roundRect(ctx, 340, 170, 600, 380, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  roundRect(ctx, 340, 170, 600, 380, 14);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, 640, 260);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '17px monospace';
  lines.forEach((line, i) => ctx.fillText(line, 640, 310 + i * 30));
}

export function drawTitle(ctx, game) {
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, 1280, 720);
  // Decorative gold diamonds.
  for (let i = 0; i < 26; i++) {
    const x = ((i * 173) % 1240) + 20;
    const y = ((i * 97) % 680) + 20;
    ctx.fillStyle = `rgba(232, 182, 76, ${0.08 + ((i * 7) % 10) / 60})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 76px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GILDED HEIST', 640, 220);
  ctx.fillStyle = '#9fb0d0';
  ctx.font = '20px monospace';
  ctx.fillText('Three rooms. Every prize. One quiet getaway.', 640, 268);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '17px monospace';
  ctx.fillText('Move with WASD or arrows. Hold C to sneak. SHIFT dashes — but guards hear it.', 640, 330);
  ctx.fillText('Cameras raise the alarm. Press E nearby to hack one — it costs +6 alarm.', 640, 360);
  ctx.fillText('Grab all the loot, then reach the EXIT. If the alarm hits 100%, you are caught.', 640, 390);
  if (game.bestMs) {
    ctx.fillStyle = GOLD;
    ctx.fillText(`Best getaway so far: ${fmtTime(game.bestMs)}`, 640, 440);
  }
  // Start button.
  ctx.fillStyle = GOLD;
  roundRect(ctx, 490, 480, 300, 58, 10);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = 'bold 24px monospace';
  ctx.fillText('START THE HEIST', 640, 517);
  ctx.fillStyle = '#7c8aa8';
  ctx.font = '14px monospace';
  ctx.fillText('or press ENTER', 640, 575);
  game.startButton = { x: 490, y: 480, w: 300, h: 58 };
}

export function drawCaught(ctx, game) {
  drawPanel(
    ctx,
    'CAUGHT!',
    [
      game.caughtReason || 'The crew was spotted.',
      `You reached level ${game.levelIndex + 1} and grabbed ${game.lootGot} prize${game.lootGot === 1 ? '' : 's'}.`,
      '',
      'Press R to try this room again.',
    ],
    '#e05252',
  );
}

export function drawWin(ctx, game) {
  drawPanel(
    ctx,
    'CLEAN GETAWAY!',
    [
      'Every prize, every room — and nobody saw a thing.',
      `Total time: ${fmtTime(game.runMs)}`,
      game.bestMs ? `Best time: ${fmtTime(game.bestMs)}` : '',
      '',
      'Press R to run it again.',
    ],
    '#39d98a',
  );
}

export function drawLevelClear(ctx, game) {
  ctx.fillStyle = 'rgba(6, 10, 22, 0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#39d98a';
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ROOM CLEARED', 640, 330);
  ctx.fillStyle = '#e8eefc';
  ctx.font = '20px monospace';
  ctx.fillText(`Next: ${game.level.name}`, 640, 380);
}

export { fmtTime, angleDiff };
