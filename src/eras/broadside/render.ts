// BROADSIDE art pass: 16-bit Amiga painterly. Banded gradients instead of
// smooth ones (the classic copper-list sky), bevelled bricks, a chunky
// galleon, teal sea with animated light bands. No smooth blends anywhere —
// every surface steps through its palette.

import {
  BroadState, Brick, brickX, brickY, mortarY, dropY, paddleHalf, BOOM_LIFE,
  BW, BH, BRICK_W, BRICK_H, BLOCKADE_Y, SHIP_Y, BALL_R,
} from './sim';

const SKY_BANDS = ['#2d1b4e', '#4a2560', '#743a6a', '#a34f68', '#cf6a5d', '#e98f52', '#f7b653'];
const SEA_BANDS = ['#12474f', '#0f3d46', '#0c343d', '#092b34'];
const SEA_LIGHT = '#2f7a7a';
const HULL_DARK = '#3a2417';
const HULL_MID = '#5d3a22';
const HULL_LIGHT = '#8a5a30';
const SAIL = '#e8dcc0';
const SAIL_SHADE = '#c9b892';

interface BrickPalette { light: string; mid: string; dark: string }
const BRICK_STYLE: Record<Brick['kind'], BrickPalette> = {
  plain: { light: '#d9b98a', mid: '#b99260', dark: '#8a6a42' },
  tough: { light: '#9aa3ab', mid: '#6f7a84', dark: '#4a525a' },
  keg: { light: '#b0623a', mid: '#8a4527', dark: '#5f2d18' },
  flotsam: { light: '#5fb8a5', mid: '#3f8f80', dark: '#2a6459' },
};

function bands(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  colors: string[],
): void {
  const step = h / colors.length;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y + i * step, w, Math.ceil(step));
  });
}

export function broadRender(ctx: CanvasRenderingContext2D, state: BroadState): void {
  const t = state.tick;
  ctx.save();

  bands(ctx, 0, 0, BW, SHIP_Y + 8, SKY_BANDS);
  // Low sun, stepped disc.
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(BW - 180, SHIP_Y - 62, 60, 8);
  ctx.fillRect(BW - 188, SHIP_Y - 54, 76, 10);
  ctx.fillRect(BW - 180, SHIP_Y - 44, 60, 8);

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.7) * state.shake * 0.4, Math.cos(t * 2.5) * state.shake * 0.3);

  // Sea with sliding light bands — the waterline sits at the ship's hull.
  const waterline = SHIP_Y + 8;
  bands(ctx, 0, waterline, BW, BH - waterline, SEA_BANDS);
  ctx.fillStyle = SEA_LIGHT;
  for (let i = 0; i < 9; i++) {
    const wx = ((i * 107 + Math.floor(t / 4)) % (BW + 60)) - 30;
    ctx.fillRect(wx, waterline + 4 + (i % 3) * 16, 34, 3);
  }

  // Blockade line: buoys marking where the wall becomes a boarding action.
  ctx.fillStyle = 'rgba(247, 182, 83, 0.5)';
  for (let x = 14; x < BW; x += 46) ctx.fillRect(x, BLOCKADE_Y, 20, 2);

  // ── The fortress wall ──
  for (const b of state.bricks) {
    if (!b.alive) continue;
    const x = brickX(b), y = brickY(b);
    if (y + BRICK_H < 0) continue;
    const pal = BRICK_STYLE[b.kind];
    const hurt = b.hp < b.maxHp;
    ctx.fillStyle = hurt ? pal.dark : pal.mid;
    ctx.fillRect(x + 1, y + 1, BRICK_W - 2, BRICK_H - 2);
    ctx.fillStyle = pal.light;
    ctx.fillRect(x + 1, y + 1, BRICK_W - 2, 3); // bevel top
    ctx.fillRect(x + 1, y + 1, 3, BRICK_H - 2); // bevel left
    ctx.fillStyle = pal.dark;
    ctx.fillRect(x + 1, y + BRICK_H - 4, BRICK_W - 2, 3);
    ctx.fillRect(x + BRICK_W - 4, y + 1, 3, BRICK_H - 2);
    if (b.kind === 'keg') {
      ctx.fillStyle = '#2a1208';
      ctx.fillRect(x + BRICK_W / 2 - 2, y + 4, 4, BRICK_H - 8);
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(x + BRICK_W / 2 - 1, y + 2, 2, 3); // fuse spark
    } else if (b.kind === 'flotsam') {
      ctx.strokeStyle = '#1d4a42';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 8, y + 5, BRICK_W - 16, BRICK_H - 10);
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 5);
      ctx.lineTo(x + BRICK_W - 8, y + BRICK_H - 5);
      ctx.stroke();
    } else if (hurt) {
      ctx.strokeStyle = pal.light;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + BRICK_H - 3);
      ctx.lineTo(x + BRICK_W / 2, y + 5);
      ctx.lineTo(x + BRICK_W - 10, y + BRICK_H - 5);
      ctx.stroke();
    }
  }

  // Flotsam pickups bobbing down.
  for (const d of state.drops) {
    if (!d.alive) continue;
    const y = dropY(d, t);
    const pal = d.kind === 'grape' ? '#f7b653' : d.kind === 'wide' ? '#5fb8a5' : '#ffd98a';
    ctx.fillStyle = pal;
    ctx.fillRect(d.x - 8, y - 8, 16, 16);
    ctx.fillStyle = '#2d1b4e';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d.kind === 'grape' ? '×2' : d.kind === 'wide' ? '⇔' : '$', d.x, y + 4);
    ctx.textAlign = 'left';
  }

  // Mortar shells.
  for (const m of state.mortars) {
    if (!m.alive) continue;
    const y = mortarY(m, t);
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(m.x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cf6a5d';
    ctx.fillRect(m.x - 1, y - 14, 2, 8); // falling flame
  }

  // ── Ships: the live galleon and its ghost fleet ──
  state.players.forEach((p, pi) => {
    const ghost = pi > 0;
    const half = paddleHalf(state, p);
    ctx.globalAlpha = ghost ? 0.35 : 1;
    // Hull
    ctx.fillStyle = HULL_MID;
    ctx.beginPath();
    ctx.moveTo(p.x - half, SHIP_Y - 6);
    ctx.lineTo(p.x + half, SHIP_Y - 6);
    ctx.lineTo(p.x + half - 10, SHIP_Y + 14);
    ctx.lineTo(p.x - half + 10, SHIP_Y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = HULL_LIGHT;
    ctx.fillRect(p.x - half, SHIP_Y - 6, half * 2, 4);
    ctx.fillStyle = HULL_DARK;
    for (let gx = -half + 12; gx < half - 8; gx += 16)
      ctx.fillRect(p.x + gx, SHIP_Y + 2, 6, 4); // gunports
    // Mast + sail
    ctx.fillStyle = HULL_DARK;
    ctx.fillRect(p.x - 2, SHIP_Y - 40, 4, 36);
    ctx.fillStyle = ghost ? SAIL_SHADE : SAIL;
    ctx.beginPath();
    ctx.moveTo(p.x + 2, SHIP_Y - 38);
    ctx.quadraticCurveTo(p.x + half * 0.8, SHIP_Y - 26, p.x + 2, SHIP_Y - 12);
    ctx.closePath();
    ctx.fill();
    // Reload: a little hoist flag climbing the mast.
    if (!ghost && p.respawnAt >= 0) {
      const frac = Math.max(0, Math.min(1, 1 - (p.respawnAt - t) / state.stats.reload));
      ctx.fillStyle = '#f7b653';
      ctx.fillRect(p.x - 10, SHIP_Y - 12 - frac * 24, 8, 5);
    }
    ctx.globalAlpha = 1;
  });

  // Cannonballs.
  for (const ball of state.balls) {
    if (!ball.alive) continue;
    const echo = ball.owner > 0;
    ctx.globalAlpha = echo ? 0.45 : 1;
    ctx.fillStyle = '#14100c';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = echo ? '#5fb8a5' : '#f7b653';
    ctx.fillRect(ball.x - 2, ball.y - 3, 2, 2); // glint
    ctx.globalAlpha = 1;
  }

  // Explosions: stepped rings, painterly and chunky.
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = 4 + age * 1.1;
    const enemy = bm.owner === -1;
    ctx.globalAlpha = Math.max(0, 1 - age / BOOM_LIFE);
    ctx.strokeStyle = enemy ? '#cf6a5d' : bm.owner === 0 ? '#f7b653' : '#5fb8a5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bm.x, bm.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bm.x, bm.y, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Hull integrity: planks along the bottom rail.
  for (let i = 0; i < state.stats.hullMaxHp; i++) {
    ctx.fillStyle = i < state.hullHp ? HULL_LIGHT : '#4a2020';
    ctx.fillRect(10 + i * 14, BH - 14, 10, 6);
  }

  // ── Title + wave banners ──
  ctx.textAlign = 'center';
  if (t < 160) {
    const a = t < 30 ? t / 30 : t > 120 ? Math.max(0, (160 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#f7b653';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.fillText('1720 — BROADSIDE', BW / 2, 230);
    ctx.fillStyle = '#e8dcc0';
    ctx.font = '16px Georgia, serif';
    ctx.fillText('The fortress rebuilds faster than you can raze it. Raze anyway.', BW / 2, 260);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = '#f7b653';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText(state.banner.text, BW / 2, 150);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
