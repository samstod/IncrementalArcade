// BROADSIDE art pass: an aged naval oil painting. Turner-ish smoke-and-fire
// sky, dark glazed sea with painted whitecaps, a gilt frame with a brass
// title plaque, and the whole scene finished under brushstroke texture and
// craquelure. Impacts bloom as oil smoke; splashes fan white spray.
// Frame, sky, brushwork, and craquelure are pre-rendered once.

import { mulberry32 } from '../../core/rng';
import {
  BroadState, Brick, brickX, brickY, mortarY, dropY, paddleHalf, BOOM_LIFE,
  BW, BH, BRICK_W, BRICK_H, BLOCKADE_Y, SHIP_Y, BALL_R,
} from './sim';

const FRAME = 24;

interface BrickPaint { base: string; light: string; dark: string }
const BRICK_STYLE: Record<Brick['kind'], BrickPaint> = {
  plain: { base: '#8f7a55', light: '#b39a6c', dark: '#5f5138' },
  tough: { base: '#6d6d68', light: '#8f8f88', dark: '#45453f' },
  keg: { base: '#7a4a2c', light: '#9c6038', dark: '#4a2c18' },
  flotsam: { base: '#4f7568', light: '#6a9484', dark: '#31493f' },
};

let sky: HTMLCanvasElement | null = null;
let finish: HTMLCanvasElement | null = null; // brushwork + craquelure + vignette
let gilt: HTMLCanvasElement | null = null;

function makeSky(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x51b7);
  const g = ctx.createLinearGradient(0, 0, 0, SHIP_Y + 8);
  g.addColorStop(0, '#2e2438');
  g.addColorStop(0.45, '#7a4438');
  g.addColorStop(0.75, '#c47a44');
  g.addColorStop(1, '#e8b061');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, BW, SHIP_Y + 8);
  // The low sun, glazed.
  const sun = ctx.createRadialGradient(620, SHIP_Y - 60, 4, 620, SHIP_Y - 60, 90);
  sun.addColorStop(0, 'rgba(255, 236, 190, 0.95)');
  sun.addColorStop(0.3, 'rgba(255, 205, 130, 0.5)');
  sun.addColorStop(1, 'transparent');
  ctx.fillStyle = sun;
  ctx.fillRect(500, SHIP_Y - 180, 240, 240);
  // Battle smoke hanging in the sky.
  for (let i = 0; i < 26; i++) {
    const x = rng() * BW, y = 40 + rng() * (SHIP_Y - 120), r = 26 + rng() * 70;
    const s = ctx.createRadialGradient(x, y, 0, x, y, r);
    s.addColorStop(0, `rgba(46, 36, 40, ${0.06 + rng() * 0.1})`);
    s.addColorStop(1, 'transparent');
    ctx.fillStyle = s;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

function makeFinish(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0xc4ac);
  // Brushwork: directional strokes of light and shadow.
  for (let i = 0; i < 900; i++) {
    const x = rng() * BW, y = rng() * BH;
    const len = 8 + rng() * 26, a = -0.15 + rng() * 0.3;
    ctx.strokeStyle = rng() < 0.5
      ? `rgba(255, 245, 225, ${0.02 + rng() * 0.04})`
      : `rgba(30, 20, 15, ${0.02 + rng() * 0.045})`;
    ctx.lineWidth = 1 + rng() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // Craquelure: a web of fine varnish cracks.
  ctx.strokeStyle = 'rgba(35, 25, 15, 0.13)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 70; i++) {
    let x = rng() * BW, y = rng() * BH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 7; s++) {
      x += (rng() - 0.5) * 60;
      y += (rng() - 0.5) * 46;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Old varnish vignette.
  const v = ctx.createRadialGradient(BW / 2, BH / 2, BH * 0.4, BW / 2, BH / 2, BH * 0.85);
  v.addColorStop(0, 'transparent');
  v.addColorStop(1, 'rgba(24, 14, 6, 0.4)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, BW, BH);
  return c;
}

function makeGilt(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = BW;
  c.height = BH;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x91d7);
  const bands = [
    { o: 0, w: 6, col: '#3a2a12' },
    { o: 6, w: 5, col: '#a9852f' },
    { o: 11, w: 8, col: '#d9b45a' },
    { o: 19, w: 3, col: '#8a6a24' },
    { o: 22, w: 2, col: '#2c1f0c' },
  ];
  for (const b of bands) {
    ctx.fillStyle = b.col;
    ctx.fillRect(b.o, b.o, BW - b.o * 2, b.w); // top
    ctx.fillRect(b.o, BH - b.o - b.w, BW - b.o * 2, b.w); // bottom
    ctx.fillRect(b.o, b.o, b.w, BH - b.o * 2); // left
    ctx.fillRect(BW - b.o - b.w, b.o, b.w, BH - b.o * 2); // right
  }
  // Gadrooning: little bright beads along the mid band.
  ctx.fillStyle = '#eccf7e';
  for (let x = 14; x < BW - 10; x += 14) {
    ctx.fillRect(x, 12, 6, 3);
    ctx.fillRect(x, BH - 15, 6, 3);
  }
  for (let y = 14; y < BH - 10; y += 14) {
    ctx.fillRect(12, y, 3, 6);
    ctx.fillRect(BW - 15, y, 3, 6);
  }
  // Wear on the gilt.
  ctx.fillStyle = 'rgba(60, 42, 16, 0.35)';
  for (let i = 0; i < 60; i++) {
    const edge = Math.floor(rng() * 4);
    const along = rng() * BW;
    const [x, y] = edge === 0 ? [along, rng() * FRAME] : edge === 1 ? [along, BH - rng() * FRAME]
      : edge === 2 ? [rng() * FRAME, along * (BH / BW)] : [BW - rng() * FRAME, along * (BH / BW)];
    ctx.fillRect(x, y, 2 + rng() * 5, 1.5);
  }
  // Brass title plaque, bottom center.
  const pw = 300, ph = 20, px = BW / 2 - pw / 2, py = BH - 22;
  ctx.fillStyle = '#b08c3a';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#6e5518';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
  ctx.fillStyle = '#3a2a10';
  ctx.font = 'italic 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('“The Bombardment of the Fortress” — 1720, oil on canvas', BW / 2, py + 14);
  return c;
}

export function broadRender(ctx: CanvasRenderingContext2D, state: BroadState): void {
  const t = state.tick;
  if (!sky) sky = makeSky();
  if (!finish) finish = makeFinish();
  if (!gilt) gilt = makeGilt();

  ctx.save();
  ctx.drawImage(sky, 0, 0);
  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.7) * state.shake * 0.4, Math.cos(t * 2.5) * state.shake * 0.3);

  // ── The sea: dark glaze with painted light ──
  const waterline = SHIP_Y + 8;
  const seaG = ctx.createLinearGradient(0, waterline, 0, BH);
  seaG.addColorStop(0, '#274e4c');
  seaG.addColorStop(1, '#0c2028');
  ctx.fillStyle = seaG;
  ctx.fillRect(0, waterline, BW, BH - waterline);
  // Sun path shimmer.
  ctx.fillStyle = 'rgba(240, 200, 130, 0.18)';
  for (let i = 0; i < 10; i++)
    ctx.fillRect(596 + (i % 3) * 14, waterline + 4 + i * 6, 34 - i * 2.5, 2);
  // Whitecap strokes rolling by.
  ctx.strokeStyle = 'rgba(216, 226, 220, 0.4)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 9; i++) {
    const wx = ((i * 107 + Math.floor(t / 4)) % (BW + 60)) - 30;
    const wy = waterline + 6 + (i % 3) * 16;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + 17, wy - 3, wx + 34, wy);
    ctx.stroke();
  }

  // Blockade line: painted buoys.
  ctx.fillStyle = 'rgba(232, 176, 97, 0.55)';
  for (let x = 14; x < BW; x += 46) {
    ctx.beginPath();
    ctx.arc(x + 10, BLOCKADE_Y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── The fortress wall: painted masonry ──
  for (const b of state.bricks) {
    if (!b.alive) continue;
    const x = brickX(b), y = brickY(b);
    if (y + BRICK_H < FRAME) continue;
    const pal = BRICK_STYLE[b.kind];
    ctx.fillStyle = b.hp < b.maxHp ? pal.dark : pal.base;
    ctx.fillRect(x + 1, y + 1, BRICK_W - 2, BRICK_H - 2);
    // A dab of light on the sun side, shadow beneath.
    ctx.fillStyle = pal.light;
    ctx.beginPath();
    ctx.ellipse(x + BRICK_W * 0.68, y + 5, BRICK_W * 0.26, 3, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.dark;
    ctx.fillRect(x + 1, y + BRICK_H - 4, BRICK_W - 2, 3);
    if (b.kind === 'keg') {
      ctx.fillStyle = '#2a1208';
      ctx.fillRect(x + BRICK_W / 2 - 2, y + 4, 4, BRICK_H - 8);
      ctx.fillStyle = '#f5cf7a';
      ctx.fillRect(x + BRICK_W / 2 - 1, y + 2, 2, 3);
    } else if (b.kind === 'flotsam') {
      ctx.strokeStyle = '#2c4238';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x + 9, y + 5, BRICK_W - 18, BRICK_H - 10);
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 5);
      ctx.lineTo(x + BRICK_W - 9, y + BRICK_H - 5);
      ctx.stroke();
    } else if (b.hp < b.maxHp) {
      ctx.strokeStyle = 'rgba(20, 12, 6, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + BRICK_H - 3);
      ctx.lineTo(x + BRICK_W / 2, y + 5);
      ctx.lineTo(x + BRICK_W - 10, y + BRICK_H - 5);
      ctx.stroke();
    }
  }

  // Flotsam pickups: painted crates and casks bobbing down.
  for (const d of state.drops) {
    if (!d.alive) continue;
    const y = dropY(d, t);
    const col = d.kind === 'grape' ? '#c8963c' : d.kind === 'wide' ? '#4f7568' : '#e0b95d';
    ctx.fillStyle = col;
    ctx.fillRect(d.x - 8, y - 8, 16, 16);
    ctx.strokeStyle = 'rgba(30, 20, 10, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(d.x - 8, y - 8, 16, 16);
    ctx.fillStyle = '#2a1c0c';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.kind === 'grape' ? '×2' : d.kind === 'wide' ? '⇔' : '$', d.x, y + 4);
    ctx.textAlign = 'left';
  }

  // Mortar shells: dark iron with a smoking fuse arc.
  for (const m of state.mortars) {
    if (!m.alive) continue;
    const y = mortarY(m, t);
    ctx.fillStyle = '#17130f';
    ctx.beginPath();
    ctx.arc(m.x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220, 210, 195, 0.35)';
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(m.x + Math.sin((t + k * 7) * 0.3) * 2, y - 8 - k * 6, 2 + k, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Ships: the flagship in oils, the ghost squadron in haze ──
  state.players.forEach((p, pi) => {
    const ghost = pi > 0;
    const half = paddleHalf(state, p);
    ctx.globalAlpha = ghost ? 0.35 : 1;
    // Hull with sheer curve and gilt stripe.
    ctx.fillStyle = ghost ? '#5b6a70' : '#33241a';
    ctx.beginPath();
    ctx.moveTo(p.x - half, SHIP_Y - 6);
    ctx.quadraticCurveTo(p.x, SHIP_Y - 1, p.x + half, SHIP_Y - 6);
    ctx.lineTo(p.x + half - 9, SHIP_Y + 14);
    ctx.quadraticCurveTo(p.x, SHIP_Y + 18, p.x - half + 9, SHIP_Y + 14);
    ctx.closePath();
    ctx.fill();
    if (!ghost) {
      ctx.strokeStyle = '#c8963c';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x - half + 4, SHIP_Y);
      ctx.quadraticCurveTo(p.x, SHIP_Y + 4, p.x + half - 4, SHIP_Y);
      ctx.stroke();
      ctx.fillStyle = '#0f0b08';
      for (let gx = -half + 12; gx < half - 8; gx += 16)
        ctx.fillRect(p.x + gx, SHIP_Y + 4, 6, 4);
    }
    // Masts and lit canvas.
    ctx.fillStyle = ghost ? '#5b6a70' : '#241a12';
    ctx.fillRect(p.x - 20, SHIP_Y - 40, 3, 36);
    ctx.fillRect(p.x + 14, SHIP_Y - 34, 3, 30);
    const sailFill = ghost ? 'rgba(200, 210, 210, 0.5)' : '#e8dcc4';
    const sailShade = ghost ? 'rgba(150, 160, 165, 0.5)' : '#bfae8e';
    for (const [mx, top, w] of [[-18.5, SHIP_Y - 38, 20], [15.5, SHIP_Y - 32, 16]] as const) {
      ctx.fillStyle = sailFill;
      ctx.beginPath();
      ctx.moveTo(p.x + mx, top);
      ctx.quadraticCurveTo(p.x + mx + w, top + 12, p.x + mx, top + 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = sailShade;
      ctx.beginPath();
      ctx.moveTo(p.x + mx, top + 6);
      ctx.quadraticCurveTo(p.x + mx + w * 0.55, top + 14, p.x + mx, top + 24);
      ctx.closePath();
      ctx.fill();
    }
    // Reload: a pennant climbing the mainmast.
    if (!ghost && p.respawnAt >= 0) {
      const frac = Math.max(0, Math.min(1, 1 - (p.respawnAt - t) / state.stats.reload));
      ctx.fillStyle = '#c03a26';
      ctx.fillRect(p.x - 17, SHIP_Y - 12 - frac * 24, 9, 5);
    }
    ctx.globalAlpha = 1;
  });

  // Cannonballs: iron spheres with a specular glint and motion smear.
  for (const ball of state.balls) {
    if (!ball.alive) continue;
    const echo = ball.owner > 0;
    ctx.globalAlpha = echo ? 0.4 : 1;
    ctx.strokeStyle = 'rgba(20, 16, 12, 0.35)';
    ctx.lineWidth = BALL_R * 1.4;
    ctx.beginPath();
    ctx.moveTo(ball.x - ball.vx * 1.8, ball.y - ball.vy * 1.8);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
    ctx.fillStyle = '#14100c';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = echo ? '#8fb5aa' : '#f0cf8a';
    ctx.beginPath();
    ctx.arc(ball.x - 1.6, ball.y - 1.8, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Impacts: oil smoke and fire; splashes fan spray at the waterline ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const fade = Math.max(0, 1 - age / BOOM_LIFE);
    const r = 4 + age * 1.1;
    ctx.globalAlpha = fade;
    if (bm.y >= waterline - 4) {
      // Sea splash: white spray fan.
      ctx.strokeStyle = 'rgba(226, 234, 228, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(bm.x, waterline + 2);
        ctx.lineTo(bm.x + i * r * 0.4, waterline - r * (1 - Math.abs(i) * 0.25));
      }
      ctx.stroke();
    } else {
      const smoke = ctx.createRadialGradient(bm.x, bm.y, 0, bm.x, bm.y, r * 1.6);
      smoke.addColorStop(0, 'rgba(255, 214, 140, 0.9)');
      smoke.addColorStop(0.35, 'rgba(200, 90, 40, 0.55)');
      smoke.addColorStop(1, 'rgba(40, 30, 26, 0)');
      ctx.fillStyle = smoke;
      ctx.beginPath();
      ctx.arc(bm.x, bm.y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(50, 42, 40, 0.4)';
      ctx.beginPath();
      ctx.arc(bm.x + 2, bm.y - r, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Hull integrity: painted planks just above the frame.
  for (let i = 0; i < state.stats.hullMaxHp; i++) {
    ctx.fillStyle = i < state.hullHp ? '#a67c3f' : '#3d201a';
    ctx.fillRect(32 + i * 13, BH - 36, 9, 6);
  }

  // ── The varnish and the frame ──
  ctx.drawImage(finish, 0, 0);
  ctx.restore();
  ctx.drawImage(gilt, 0, 0);

  // Wave title: a small painted cartouche under the top frame.
  ctx.textAlign = 'center';
  if (t < 160) {
    const a = t < 30 ? t / 30 : t > 120 ? Math.max(0, (160 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(240, 222, 180, 0.9)';
    ctx.font = 'italic bold 32px Georgia, serif';
    ctx.fillText('1720 — BROADSIDE', BW / 2, 220);
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillText('The fortress rebuilds faster than you can raze it. Raze anyway.', BW / 2, 250);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = 'rgba(240, 222, 180, 0.95)';
    ctx.font = 'italic bold 22px Georgia, serif';
    ctx.fillText(state.banner.text, BW / 2, 52);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}
