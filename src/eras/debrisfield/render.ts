// DEBRIS FIELD art pass: classic vector — pure stroked paths, white cores
// with colored glow via shadowBlur, a seeded starfield, nothing filled that
// can be drawn as line. Echo fighters glow cyan and translucent.

import { mulberry32 } from '../../core/rng';
import {
  DebrisState, Hulk, HULK_RADIUS, BOOM_LIFE,
  DW, DH, CX, CY, COLONY_R,
} from './sim';

const WHITE = '#f4f8ff';
const GLOW = '#9fc4ff';
const ECHO = 'rgba(64, 224, 255, 0.5)';
const ECHO_GLOW = '#40e0ff';
const ENEMY_GLOW = '#ff7a5c';
const COLONY_GLOW = '#7affc4';

interface Star { x: number; y: number; b: number }
let stars: Star[] | null = null;

function starfield(): Star[] {
  if (!stars) {
    const rng = mulberry32(0xdeb515);
    stars = Array.from({ length: 90 }, () => ({
      x: rng() * DW,
      y: rng() * DH,
      b: 0.25 + rng() * 0.6,
    }));
  }
  return stars;
}

function hulkPath(ctx: CanvasRenderingContext2D, h: Hulk, t: number): void {
  const r = HULK_RADIUS[h.size];
  const rot = h.spin * (t - h.born);
  ctx.beginPath();
  h.verts.forEach((m, i) => {
    const a = rot + (i / h.verts.length) * Math.PI * 2;
    const px = h.x + Math.cos(a) * r * m;
    const py = h.y + Math.sin(a) * r * m;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

export function debrisRender(ctx: CanvasRenderingContext2D, state: DebrisState): void {
  const t = state.tick;
  ctx.save();
  ctx.fillStyle = '#020308';
  ctx.fillRect(0, 0, DW, DH);

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.9) * state.shake * 0.4, Math.cos(t * 2.6) * state.shake * 0.35);

  for (const s of starfield()) {
    ctx.globalAlpha = s.b;
    ctx.fillStyle = WHITE;
    ctx.fillRect(s.x, s.y, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  // ── The colony ship: a hexagonal station with running lights ──
  const hitFlash = t - state.colonyHitAt < 14;
  ctx.strokeStyle = hitFlash ? '#ff7a5c' : WHITE;
  ctx.shadowColor = hitFlash ? ENEMY_GLOW : COLONY_GLOW;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.001;
    const px = CX + Math.cos(a) * COLONY_R;
    const py = CY + Math.sin(a) * COLONY_R;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * 0.001 + Math.PI / 6;
    const px = CX + Math.cos(a) * COLONY_R * 0.55;
    const py = CY + Math.sin(a) * COLONY_R * 0.55;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  // Running lights blink in sequence.
  for (let i = 0; i < 6; i++) {
    if (Math.floor(t / 20) % 6 !== i) continue;
    const a = (i / 6) * Math.PI * 2 + t * 0.001;
    ctx.fillStyle = COLONY_GLOW;
    ctx.fillRect(CX + Math.cos(a) * COLONY_R - 1.5, CY + Math.sin(a) * COLONY_R - 1.5, 3, 3);
  }
  ctx.shadowBlur = 0;

  // Hull integrity arc around the station.
  const frac = Math.max(0, state.colonyHp / state.stats.colonyMaxHp);
  ctx.strokeStyle = frac > 0.35 ? COLONY_GLOW : ENEMY_GLOW;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(CX, CY, COLONY_R + 12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;

  // ── Hulks: slow-tumbling wrecks ──
  ctx.strokeStyle = WHITE;
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.6;
  for (const h of state.hulks) {
    if (!h.alive || h.born > t) continue;
    hulkPath(ctx, h, t);
    ctx.stroke();
    if (h.hp < h.maxHp) {
      // Damage scar: a crack through the silhouette.
      ctx.beginPath();
      ctx.moveTo(h.x - 5, h.y + 4);
      ctx.lineTo(h.x + 2, h.y - 2);
      ctx.lineTo(h.x + 6, h.y + 3);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // ── Bullets: short tracers ──
  for (const b of state.bullets) {
    if (!b.alive) continue;
    const echo = b.owner > 0;
    ctx.strokeStyle = echo ? ECHO : WHITE;
    ctx.shadowColor = echo ? ECHO_GLOW : GLOW;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // ── Fighters ──
  state.players.forEach((s, pi) => {
    if (s.dead) return;
    const echo = pi > 0;
    const blink = t < s.invulnUntil && Math.floor(t / 6) % 2 === 0;
    if (blink) return;
    ctx.strokeStyle = echo ? ECHO : WHITE;
    ctx.shadowColor = echo ? ECHO_GLOW : GLOW;
    ctx.shadowBlur = echo ? 6 : 10;
    ctx.lineWidth = echo ? 1.3 : 1.8;
    const a = s.angle;
    const nose = { x: s.x + Math.cos(a) * 12, y: s.y + Math.sin(a) * 12 };
    const l = { x: s.x + Math.cos(a + 2.5) * 9, y: s.y + Math.sin(a + 2.5) * 9 };
    const r = { x: s.x + Math.cos(a - 2.5) * 9, y: s.y + Math.sin(a - 2.5) * 9 };
    const tail = { x: s.x - Math.cos(a) * 4, y: s.y - Math.sin(a) * 4 };
    ctx.beginPath();
    ctx.moveTo(nose.x, nose.y);
    ctx.lineTo(l.x, l.y);
    ctx.lineTo(tail.x, tail.y);
    ctx.lineTo(r.x, r.y);
    ctx.closePath();
    ctx.stroke();
    // Thruster flame flickers while moving.
    if (Math.hypot(s.vx, s.vy) > 0.4 && Math.floor(t / 3) % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(l.x * 0.5 + tail.x * 0.5, l.y * 0.5 + tail.y * 0.5);
      ctx.lineTo(s.x - Math.cos(a) * (10 + (t % 5)), s.y - Math.sin(a) * (10 + (t % 5)));
      ctx.lineTo(r.x * 0.5 + tail.x * 0.5, r.y * 0.5 + tail.y * 0.5);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  });
  ctx.shadowBlur = 0;

  // ── Explosions: expanding vector shards ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const rad = 3 + age * (bm.big ? 1.6 : 1.0);
    ctx.globalAlpha = Math.max(0, 1 - age / BOOM_LIFE);
    ctx.strokeStyle = bm.owner === -1 ? ENEMY_GLOW : bm.owner === 0 ? WHITE : ECHO;
    ctx.shadowColor = bm.owner === -1 ? ENEMY_GLOW : bm.owner === 0 ? GLOW : ECHO_GLOW;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + bm.born * 0.7;
      ctx.moveTo(bm.x + Math.cos(a) * rad * 0.4, bm.y + Math.sin(a) * rad * 0.4);
      ctx.lineTo(bm.x + Math.cos(a) * rad, bm.y + Math.sin(a) * rad);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // ── Banners ──
  ctx.textAlign = 'center';
  if (t < 160) {
    const alpha = t < 30 ? t / 30 : t > 120 ? Math.max(0, (160 - t) / 40) : 1;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = WHITE;
    ctx.shadowColor = GLOW;
    ctx.shadowBlur = 12;
    ctx.font = '300 34px monospace';
    ctx.strokeText('2286 — DEBRIS FIELD', DW / 2, 150);
    ctx.font = '300 15px monospace';
    ctx.strokeText('THE FLEET IS ALREADY DEAD. HOLD WHAT REMAINS.', DW / 2, 180);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.strokeStyle = WHITE;
    ctx.shadowColor = GLOW;
    ctx.shadowBlur = 10;
    ctx.font = '300 24px monospace';
    ctx.strokeText(state.banner.text, DW / 2, 120);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
