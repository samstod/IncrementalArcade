// DEFCON LOOP art pass: neon-on-black raster arcade. Phosphor trails via
// gradient strokes, glow via shadowBlur, CRT scanlines/vignette live in CSS.
// Rendering reads sim state only — it never mutates it.

import { McState, projPos, explosionRadius, W, H, GROUND } from './sim';

const PLAYER_TRAIL = '#ffd23f';
const ECHO_TRAIL = 'rgba(64, 224, 255, 0.55)';
const ENEMY_TRAIL = '#ff3b3b';
const CITY_COLOR = '#3fd2ff';
const RUIN_COLOR = '#1a3340';
const BATTERY_COLOR = '#ff9f1c';

export function mcRender(ctx: CanvasRenderingContext2D, state: McState): void {
  const t = state.tick;
  ctx.save();
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, W, H);

  if (state.shake > 0) {
    const s = state.shake;
    ctx.translate(Math.sin(t * 1.7) * s * 0.4, Math.cos(t * 2.3) * s * 0.3);
  }

  drawGround(ctx);
  drawCities(ctx, state);
  drawBatteries(ctx, state, t);
  drawMissiles(ctx, state, t);
  drawInterceptors(ctx, state, t);
  drawExplosions(ctx, state, t);
  drawBanner(ctx, state, t);

  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, GROUND, 0, H);
  g.addColorStop(0, '#3a1a58');
  g.addColorStop(1, '#12081f');
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = '#b14aed';
  ctx.shadowColor = '#b14aed';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Chunky little skylines, one variant per city slot.
const CITY_BLOCKS: number[][] = [
  [10, 18, 8, 22, 14],
  [16, 10, 20, 12, 8],
  [8, 14, 24, 10, 16],
  [20, 8, 14, 18, 10],
  [12, 22, 10, 16, 8],
  [14, 8, 18, 24, 12],
];

function drawCities(ctx: CanvasRenderingContext2D, state: McState): void {
  state.cities.forEach((c, i) => {
    const alive = c.hp > 0;
    ctx.shadowBlur = alive ? 10 : 0;
    ctx.shadowColor = CITY_COLOR;
    ctx.fillStyle = alive ? CITY_COLOR : RUIN_COLOR;
    const blocks = CITY_BLOCKS[i % CITY_BLOCKS.length];
    const bw = 8;
    blocks.forEach((h, bi) => {
      const bh = alive ? h : Math.min(4, h);
      ctx.fillRect(c.x - 20 + bi * bw, GROUND - bh, bw - 1, bh);
    });
    if (alive && c.hp > 1) {
      ctx.fillStyle = '#bff4ff';
      for (let hp = 1; hp < c.hp; hp++)
        ctx.fillRect(c.x - 12 + (hp - 1) * 7, GROUND - 32, 4, 4);
    }
    ctx.shadowBlur = 0;
  });
}

function drawBatteries(ctx: CanvasRenderingContext2D, state: McState, t: number): void {
  // Live player's batteries, bright; echo instances as stacked translucent
  // outlines lifted a few pixels per echo so the crowd of ghosts reads.
  state.players.forEach((p, pi) => {
    const ghost = pi > 0;
    const lift = ghost ? pi * 4 : 0;
    ctx.globalAlpha = ghost ? 0.28 : 1;
    for (const b of p.batteries) {
      ctx.strokeStyle = ghost ? '#40e0ff' : BATTERY_COLOR;
      ctx.fillStyle = ghost ? 'transparent' : '#7a4a0e';
      ctx.shadowBlur = ghost ? 4 : 10;
      ctx.shadowColor = ghost ? '#40e0ff' : BATTERY_COLOR;
      ctx.beginPath();
      ctx.moveTo(b.x - 22, GROUND - lift);
      ctx.lineTo(b.x, GROUND - 18 - lift);
      ctx.lineTo(b.x + 22, GROUND - lift);
      ctx.closePath();
      if (!ghost) ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!ghost) {
        ctx.fillStyle = b.readyAt > t ? '#5a3a10' : '#ffd23f';
        const dots = Math.min(b.ammo, 10);
        for (let d = 0; d < dots; d++)
          ctx.fillRect(b.x - 15 + (d % 5) * 7, GROUND + 6 + Math.floor(d / 5) * 6, 4, 3);
      }
    }
    ctx.globalAlpha = 1;
  });
}

function trail(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  color: string, glow: string, width: number,
): void {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, 'transparent');
  g.addColorStop(1, color);
  ctx.strokeStyle = g;
  ctx.lineWidth = width;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
}

function drawMissiles(ctx: CanvasRenderingContext2D, state: McState, t: number): void {
  for (const m of state.missiles) {
    if (!m.alive) continue;
    const pos = projPos(m, t);
    if (pos.f <= 0) continue;
    trail(ctx, m.sx, m.sy, pos.x, pos.y, ENEMY_TRAIL, ENEMY_TRAIL, m.isChild ? 1 : 1.5);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = ENEMY_TRAIL;
    ctx.shadowBlur = 10;
    ctx.fillRect(pos.x - 1.5, pos.y - 1.5, 3, 3);
    ctx.shadowBlur = 0;
  }
}

function drawInterceptors(ctx: CanvasRenderingContext2D, state: McState, t: number): void {
  for (const ic of state.interceptors) {
    if (!ic.alive) continue;
    const pos = projPos(ic, t);
    const echo = ic.owner > 0;
    trail(
      ctx, ic.sx, ic.sy, pos.x, pos.y,
      echo ? ECHO_TRAIL : PLAYER_TRAIL,
      echo ? '#40e0ff' : PLAYER_TRAIL,
      echo ? 1 : 2,
    );
    // Target reticle
    ctx.strokeStyle = echo ? ECHO_TRAIL : 'rgba(255, 210, 63, 0.8)';
    ctx.beginPath();
    ctx.moveTo(ic.tx - 4, ic.ty);
    ctx.lineTo(ic.tx + 4, ic.ty);
    ctx.moveTo(ic.tx, ic.ty - 4);
    ctx.lineTo(ic.tx, ic.ty + 4);
    ctx.stroke();
  }
}

function drawExplosions(ctx: CanvasRenderingContext2D, state: McState, t: number): void {
  for (const e of state.explosions) {
    const r = explosionRadius(e, t);
    if (r <= 0) continue;
    const enemy = e.owner < 0;
    const echo = e.owner > 0;
    const core = enemy ? '#ff6b4a' : echo ? '#9ff3ff' : '#fff7d6';
    const rim = enemy ? '#ff3b3b' : echo ? '#40e0ff' : '#ffd23f';
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    g.addColorStop(0, core);
    g.addColorStop(0.6, rim);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = echo ? 0.5 : 0.9;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, state: McState, t: number): void {
  // Era title card during the opening seconds of every loop.
  if (t < 150) {
    const a = t < 30 ? t / 30 : t > 110 ? Math.max(0, (150 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff3b3b';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur = 18;
    ctx.fillText('1983 — DEFCON LOOP', W / 2, 220);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#3fd2ff';
    ctx.shadowColor = '#3fd2ff';
    ctx.fillText('HOLD THE LINE. YOU WILL FAIL. FAIL DEEPER.', W / 2, 252);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
  if (state.banner && t < state.banner.until) {
    const remain = state.banner.until - t;
    ctx.globalAlpha = Math.min(1, remain / 40);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 12;
    ctx.fillText(state.banner.text, W / 2, 140);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}
