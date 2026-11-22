// VELVET SHADOW — all canvas rendering: rooms, light, cones, loot, people.
import { TILE, COLS, ROWS } from './levels.js';

function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.floorShade = null; // per-level precomputed tile shade
    this.shake = 0;
  }
  prepareLevel(levelIdx, grid) {
    const rnd = seededRand(1234 + levelIdx * 777);
    this.floorShade = [];
    for (let y = 0; y < ROWS; y++) {
      this.floorShade[y] = [];
      for (let x = 0; x < COLS; x++) this.floorShade[y][x] = rnd() * 0.12;
    }
  }
  addShake(v) { this.shake = Math.max(this.shake, v); }

  draw(game, dt) {
    const ctx = this.ctx;
    const { grid, palette, player } = game;
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= Math.pow(0.02, dt);
    }
    this.drawFloor(ctx, grid, palette);
    this.drawExit(ctx, game);
    this.drawLasers(ctx, game, dt);
    this.drawLoot(ctx, game, dt);
    this.drawClosets(ctx, grid, palette);
    this.drawProps(ctx, grid, palette, dt);
    this.drawCones(ctx, game);
    this.drawCameras(ctx, game, dt);
    this.drawGuards(ctx, game, dt);
    this.drawPlayer(ctx, game, dt);
    this.drawParticles(ctx, game, dt);
    this.drawLighting(ctx, game, dt);
    ctx.restore();
    this.drawVignette(ctx);
  }

  drawFloor(ctx, grid, p) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        const px = x * TILE, py = y * TILE;
        if (c === '#') {
          ctx.fillStyle = p.wall;
          ctx.fillRect(px, py, TILE, TILE);
          // lit top edge where floor is below
          if (y + 1 < ROWS && grid[y + 1][x] !== '#') {
            ctx.fillStyle = p.wallTop;
            ctx.fillRect(px, py + TILE - 5, TILE, 5);
          }
          continue;
        }
        const shade = this.floorShade[y][x];
        const base = (x + y) % 2 === 0 ? p.floor : p.floor2;
        ctx.fillStyle = base;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = `rgba(255,255,255,${shade * 0.5})`;
        ctx.fillRect(px, py, TILE, TILE);
        if (c === ',') {
          ctx.fillStyle = 'rgba(6,10,18,0.45)';
          ctx.fillRect(px, py, TILE, TILE);
        }
        if (c === 'r') {
          ctx.fillStyle = p.rug;
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = p.rugEdge;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
        }
        // subtle grout
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  drawExit(ctx, game) {
    const e = game.exit;
    if (!e) return;
    const pulse = 0.55 + Math.sin(game.time * 3) * 0.25;
    const ready = game.lootLeft === 0;
    ctx.save();
    ctx.globalAlpha = ready ? pulse : 0.35;
    ctx.fillStyle = ready ? '#37e08a' : '#3a5a4a';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ready ? '#b8ffd9' : '#7a9a8a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = ready ? '#062b18' : '#cfe8dc';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ready ? 'EXIT' : 'LOCKED', e.x, e.y);
    ctx.restore();
  }

  drawLasers(ctx, game, dt) {
    for (const l of game.lasers) {
      const on = Math.sin((game.time + l.phase) * 2.2) > -0.2;
      const x1 = l.x1 * TILE, y1 = (l.y1 + 0.5) * TILE;
      const x2 = l.x2 * TILE, y2 = (l.y2 + 0.5) * TILE;
      // emitters
      ctx.fillStyle = '#39445c';
      ctx.fillRect(x1 - 4, y1 - 8, 8, 16);
      ctx.fillRect(x2 - 4, y2 - 8, 8, 16);
      if (on) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = '#ff4d5e';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff4d5e'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#ff4d5e';
        ctx.setLineDash([4, 8]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawLoot(ctx, game, dt) {
    for (const l of game.loot) {
      if (l.taken) continue;
      const bob = Math.sin(game.time * 2 + l.bob) * 3;
      const y = l.y + bob;
      ctx.save();
      // glow
      const g = ctx.createRadialGradient(l.x, y, 4, l.x, y, 34);
      g.addColorStop(0, l.def.color + 'cc');
      g.addColorStop(1, l.def.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, y, 34, 0, Math.PI * 2); ctx.fill();
      // pedestal
      ctx.fillStyle = '#0c1118';
      ctx.beginPath(); ctx.ellipse(l.x, l.y + 13, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
      if (l.kind === 'p') {
        ctx.fillStyle = '#8a6a2f';
        ctx.fillRect(l.x - 13, y - 18, 26, 22);
        ctx.fillStyle = '#d8a03c';
        ctx.fillRect(l.x - 10, y - 15, 20, 16);
        ctx.fillStyle = '#3f6d8e';
        ctx.beginPath(); ctx.arc(l.x - 2, y - 8, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#7ec850';
        ctx.fillRect(l.x - 10, y - 2, 20, 3);
      } else if (l.kind === 'g') {
        ctx.fillStyle = '#f5d76e';
        ctx.fillRect(l.x - 11, y + 2, 22, 7);
        ctx.fillRect(l.x - 8, y - 5, 16, 7);
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(l.x - 11, y + 2, 22, 2);
      } else if (l.kind === 'j') {
        ctx.fillStyle = '#7fe3ff';
        ctx.beginPath();
        ctx.moveTo(l.x, y - 14); ctx.lineTo(l.x + 11, y - 2);
        ctx.lineTo(l.x, y + 10); ctx.lineTo(l.x - 11, y - 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8fbff';
        ctx.beginPath();
        ctx.moveTo(l.x, y - 14); ctx.lineTo(l.x + 5, y - 2); ctx.lineTo(l.x, y + 10);
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#f2ead8';
        ctx.fillRect(l.x - 11, y - 8, 22, 16);
        ctx.strokeStyle = '#b03a3a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(l.x, y + 6, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#8a8a7a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(l.x - 7, y - 3); ctx.lineTo(l.x + 7, y - 3); ctx.stroke();
      }
      // value tag
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(l.x - 20, y - 32, 40, 13);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$' + l.def.value, l.x, y - 25);
      ctx.restore();
    }
  }

  drawClosets(ctx, grid, p) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x] !== 'C') continue;
        const px = x * TILE, py = y * TILE;
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(px + 3, py + 2, TILE - 6, TILE - 4);
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(px + 6, py + 5, TILE - 12, TILE - 10);
        ctx.strokeStyle = '#2c1d10'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + TILE / 2, py + 5); ctx.lineTo(px + TILE / 2, py + TILE - 5); ctx.stroke();
      }
    }
  }

  drawProps(ctx, grid, p, dt) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        const px = x * TILE, py = y * TILE;
        if (c === 'T') {
          ctx.fillStyle = '#3a2a18';
          ctx.beginPath(); ctx.roundRect(px + 3, py + 4, TILE - 6, TILE - 8, 5); ctx.fill();
          ctx.fillStyle = '#5a4126';
          ctx.beginPath(); ctx.roundRect(px + 5, py + 6, TILE - 10, TILE - 12, 4); ctx.fill();
          ctx.fillStyle = '#c9a24b';
          ctx.beginPath(); ctx.arc(px + 14, py + 16, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#7fb069';
          ctx.beginPath(); ctx.arc(px + 26, py + 24, 3, 0, Math.PI * 2); ctx.fill();
        } else if (c === 'A') {
          ctx.fillStyle = '#7a4a2a';
          ctx.beginPath(); ctx.arc(px + 20, py + 26, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#3f7d44';
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + 0.4;
            ctx.beginPath();
            ctx.ellipse(px + 20 + Math.cos(a) * 8, py + 16 + Math.sin(a) * 6, 7, 4, a, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (c === 'o') {
          const flick = 0.8 + Math.sin(dt * 0.001 * 2 + x) * 0.1;
          const g = ctx.createRadialGradient(px + 20, py + 20, 4, px + 20, py + 20, 60);
          g.addColorStop(0, `rgba(255,220,140,${0.35 * flick})`);
          g.addColorStop(1, 'rgba(255,220,140,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px + 20, py + 20, 60, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.arc(px + 20, py + 20, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  conePath(ctx, x, y, facing, range, half) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, facing - half, facing + half);
    ctx.closePath();
  }

  drawCones(ctx, game) {
    // guard cones
    for (const gd of game.guards) {
      const col = gd.state === 'alarmed' ? '255,70,80' : gd.state === 'suspicious' ? '255,176,66' : '120,200,160';
      const range = gd.state === 'alarmed' ? 230 : 210;
      ctx.save();
      ctx.globalAlpha = gd.state === 'calm' ? 0.22 : 0.38;
      ctx.fillStyle = `rgb(${col})`;
      this.conePath(ctx, gd.x, gd.y, gd.facing, range, 0.62);
      ctx.fill();
      ctx.globalAlpha = gd.state === 'calm' ? 0.4 : 0.6;
      ctx.strokeStyle = `rgb(${col})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // camera cones
    for (const cam of game.cameras) {
      if (cam.disabled) continue;
      ctx.save();
      ctx.globalAlpha = cam.sees > 0.12 ? 0.45 : 0.26;
      ctx.fillStyle = cam.sees > 0.12 ? '#ff5b6a' : '#ffd166';
      this.conePath(ctx, cam.x, cam.y, cam.facing, 230, 0.5);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = cam.sees > 0.12 ? '#ff5b6a' : '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawCameras(ctx, game, dt) {
    for (const cam of game.cameras) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.rotate(cam.facing);
      if (cam.disabled) {
        ctx.fillStyle = '#5a5a5a';
        ctx.fillRect(-5, -7, 20, 14);
        ctx.fillStyle = '#ffcf5c';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('✕', 20, -11);
      } else {
        ctx.fillStyle = '#2c3542';
        ctx.fillRect(-5, -7, 20, 14);
        ctx.strokeStyle = '#5a6a80'; ctx.lineWidth = 2;
        ctx.strokeRect(-5, -7, 20, 14);
        ctx.fillStyle = cam.sees > 0.12 ? '#ff3b4d' : '#ffcf5c';
        ctx.beginPath(); ctx.arc(16, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(17, -1, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (!cam.disabled && cam.hack > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cam.x - 22, cam.y - 34, 44, 7);
        ctx.fillStyle = '#37e08a';
        ctx.fillRect(cam.x - 21, cam.y - 33, 42 * cam.hack, 5);
        ctx.restore();
      }
    }
  }

  drawGuards(ctx, game, dt) {
    for (const gd of game.guards) {
      ctx.save();
      ctx.translate(gd.x, gd.y);
      // body
      ctx.fillStyle = '#1d2a3a';
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = gd.state === 'alarmed' ? '#ff4d5e' : gd.state === 'suspicious' ? '#ffb042' : '#5a7d8c';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      // facing tick + cap
      ctx.rotate(gd.facing);
      ctx.fillStyle = '#e8e4d8';
      ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(8, -7, 8, 14);
      ctx.restore();
      // state bubble
      if (gd.state !== 'calm') {
        ctx.save();
        ctx.fillStyle = gd.state === 'alarmed' ? '#ff4d5e' : '#ffb042';
        ctx.beginPath(); ctx.arc(gd.x, gd.y - 26, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(gd.state === 'alarmed' ? '!' : '?', gd.x, gd.y - 25);
        ctx.restore();
      }
    }
  }

  drawPlayer(ctx, game, dt) {
    const pl = game.player;
    if (pl.hidden) {
      // hidden inside a closet: show a small "hidden" tag at the closet
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pl.x - 30, pl.y - 34, 60, 15);
      ctx.fillStyle = '#8be0b0';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('HIDDEN', pl.x, pl.y - 26);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(pl.x, pl.y);
    const sneaking = pl.sneak;
    const r = sneaking ? 12 : 14;
    // gold glow so the thief reads at a glance
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
    glow.addColorStop(0, 'rgba(255,214,110,0.4)');
    glow.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 9, r, 5, 0, 0, Math.PI * 2); ctx.fill();
    // cloak
    ctx.fillStyle = '#31234a';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd76e';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    // hood + face
    ctx.rotate(pl.facing);
    ctx.fillStyle = '#e8dcc0';
    ctx.beginPath(); ctx.arc(5, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#241a33';
    ctx.beginPath(); ctx.arc(7, -2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (pl.sneak) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(pl.x - 24, pl.y - 30, 48, 13);
      ctx.fillStyle = '#9fd8ff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SNEAKING', pl.x, pl.y - 23);
      ctx.restore();
    }
  }

  drawParticles(ctx, game, dt) {
    for (const pt of game.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  drawLighting(ctx, game, dt) {
    const lights = [];
    lights.push({ x: game.player.x, y: game.player.y, r: game.player.sneak ? 150 : 200, a: 0.92 });
    for (const l of game.loot) if (!l.taken) lights.push({ x: l.x, y: l.y, r: 85, a: 0.6 });
    if (game.exit) lights.push({ x: game.exit.x, y: game.exit.y, r: 110, a: 0.75 });
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (game.grid[y][x] === 'o') lights.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, r: 150, a: 0.55 });
      }
    }
    ctx.save();
    ctx.fillStyle = 'rgba(3,5,14,0.32)';
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    ctx.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const g = ctx.createRadialGradient(L.x, L.y, 8, L.x, L.y, L.r);
      g.addColorStop(0, `rgba(255,255,255,${L.a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(ctx) {
    const g = ctx.createRadialGradient(640, 360, 300, 640, 360, 720);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);
  }
}
