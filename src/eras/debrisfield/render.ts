// DEBRIS FIELD art pass: the colony ship's holographic tactical display.
// Everything is translucent projected light — cyan for friendlies, threat
// amber for wrecks — with chromatic fringing (each stroke ghosted in warm
// and cool offsets), a scan band sweeping the tank, hex-ring projection
// geometry, and occasional glitch slips where the projector stutters.

import { mulberry32 } from '../../core/rng';
import {
  DebrisState, Hulk, HULK_RADIUS, BOOM_LIFE,
  DW, DH, CX, CY, COLONY_R,
} from './sim';

const CYAN = 'rgba(96, 224, 255, 0.95)';
const CYAN_DIM = 'rgba(96, 224, 255, 0.45)';
const CYAN_FAINT = 'rgba(96, 224, 255, 0.1)';
const CORE = '#e6fbff';
const AMBER = 'rgba(255, 178, 74, 0.95)';
const AMBER_DIM = 'rgba(255, 178, 74, 0.5)';
const RED = 'rgba(255, 96, 80, 0.9)';
const FRINGE_WARM = 'rgba(255, 90, 150, 0.22)';
const FRINGE_COOL = 'rgba(90, 130, 255, 0.22)';

function hash(n: number): number {
  return mulberry32(n >>> 0)();
}

/** A stroke of projected light: chromatic ghosts, then the beam itself. */
function holo(ctx: CanvasRenderingContext2D, path: () => void, color: string, width = 1.5, glow = 8): void {
  ctx.lineWidth = width;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = FRINGE_WARM;
  ctx.save();
  ctx.translate(-1.4, 0.4);
  path();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = FRINGE_COOL;
  ctx.save();
  ctx.translate(1.4, -0.4);
  path();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  path();
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function hulkPath(ctx: CanvasRenderingContext2D, h: Hulk, t: number): () => void {
  return () => {
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
  };
}

export function debrisRender(ctx: CanvasRenderingContext2D, state: DebrisState): void {
  const t = state.tick;
  ctx.save();
  ctx.fillStyle = '#020609';
  ctx.fillRect(0, 0, DW, DH);

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.9) * state.shake * 0.4, Math.cos(t * 2.6) * state.shake * 0.35);

  // ── The projection tank: concentric rings and bearing spokes ──
  ctx.strokeStyle = CYAN_FAINT;
  ctx.lineWidth = 1;
  for (const r of [120, 220, 320]) {
    ctx.beginPath();
    ctx.ellipse(CX, CY, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.0006;
    ctx.moveTo(CX + Math.cos(a) * 60, CY + Math.sin(a) * 48);
    ctx.lineTo(CX + Math.cos(a) * 330, CY + Math.sin(a) * 264);
  }
  ctx.stroke();

  // ── The colony: bright cyan projection with a rotating status ring ──
  const hitFlash = t - state.colonyHitAt < 14;
  holo(ctx, () => {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.001;
      const px = CX + Math.cos(a) * COLONY_R;
      const py = CY + Math.sin(a) * COLONY_R;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }, hitFlash ? RED : CYAN, 2, 12);
  // Rotating dashed halo.
  ctx.strokeStyle = CYAN_DIM;
  ctx.setLineDash([10, 14]);
  ctx.lineDashOffset = -t * 0.6;
  ctx.beginPath();
  ctx.arc(CX, CY, COLONY_R + 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Integrity arc.
  const frac = Math.max(0, state.colonyHp / state.stats.colonyMaxHp);
  ctx.strokeStyle = frac > 0.35 ? CYAN : RED;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 8;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(CX, CY, COLONY_R + 12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
  ctx.fillStyle = CYAN_DIM;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CV-EXODUS', CX, CY + COLONY_R + 36);

  // ── Wrecks: threat-amber projections, bracketed when close ──
  for (const h of state.hulks) {
    if (!h.alive || h.born > t) continue;
    holo(ctx, hulkPath(ctx, h, t), h.size === 2 ? AMBER : AMBER_DIM, 1.5, 6);
    const d = Math.hypot(h.x - CX, h.y - CY);
    if (d < 150 && Math.floor(t / 12) % 2 === 0) {
      // Proximity alert brackets.
      const r = HULK_RADIUS[h.size] + 7;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.moveTo(h.x + sx * r, h.y + sy * r - sy * 6);
        ctx.lineTo(h.x + sx * r, h.y + sy * r);
        ctx.lineTo(h.x + sx * r - sx * 6, h.y + sy * r);
      }
      ctx.stroke();
    }
    if (h.hp < h.maxHp) {
      ctx.strokeStyle = AMBER_DIM;
      ctx.beginPath();
      ctx.moveTo(h.x - 5, h.y + 4);
      ctx.lineTo(h.x + 2, h.y - 2);
      ctx.lineTo(h.x + 6, h.y + 3);
      ctx.stroke();
    }
  }

  // ── Bullets: coherent light ──
  for (const b of state.bullets) {
    if (!b.alive) continue;
    const echo = b.owner > 0;
    ctx.strokeStyle = echo ? CYAN_DIM : CORE;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 6;
    ctx.lineWidth = echo ? 1 : 1.6;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 1.6, b.y - b.vy * 1.6);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // ── Fighters: cyan wedges, echoes dimmer projections ──
  state.players.forEach((s, pi) => {
    if (s.dead) return;
    const echo = pi > 0;
    const blink = t < s.invulnUntil && Math.floor(t / 6) % 2 === 0;
    if (blink) return;
    const a = s.angle;
    const nose = { x: s.x + Math.cos(a) * 12, y: s.y + Math.sin(a) * 12 };
    const l = { x: s.x + Math.cos(a + 2.5) * 9, y: s.y + Math.sin(a + 2.5) * 9 };
    const r = { x: s.x + Math.cos(a - 2.5) * 9, y: s.y + Math.sin(a - 2.5) * 9 };
    const tail = { x: s.x - Math.cos(a) * 4, y: s.y - Math.sin(a) * 4 };
    holo(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(nose.x, nose.y);
      ctx.lineTo(l.x, l.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.lineTo(r.x, r.y);
      ctx.closePath();
    }, echo ? CYAN_DIM : CYAN, echo ? 1.2 : 1.8, echo ? 5 : 10);
    if (Math.hypot(s.vx, s.vy) > 0.4 && Math.floor(t / 3) % 2 === 0) {
      ctx.strokeStyle = echo ? CYAN_FAINT : CYAN_DIM;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(s.x - Math.cos(a) * (12 + (t % 5)), s.y - Math.sin(a) * (12 + (t % 5)));
      ctx.stroke();
    }
  });

  // ── Detonations: collapsing bracket rings ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const rad = 3 + age * (bm.big ? 1.6 : 1.0);
    ctx.globalAlpha = Math.max(0, 1 - age / BOOM_LIFE);
    const col = bm.owner === -1 ? RED : bm.owner === 0 ? CYAN : CYAN_DIM;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2 + age * 0.1;
      ctx.arc(bm.x, bm.y, rad, a0, a0 + 0.9);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // ── Projector artifacts ──
  // Scan band sweeping the tank.
  const scanY = ((t * 1.6) % (DH + 120)) - 60;
  const band = ctx.createLinearGradient(0, scanY - 26, 0, scanY + 26);
  band.addColorStop(0, 'transparent');
  band.addColorStop(0.5, 'rgba(140, 235, 255, 0.06)');
  band.addColorStop(1, 'transparent');
  ctx.fillStyle = band;
  ctx.fillRect(0, scanY - 26, DW, 52);
  // Glitch slip: the projector stutters and a slice of the image jumps.
  const g = hash(Math.floor(t / 53) * 13 + 1);
  if (g < 0.28 && t % 53 < 4) {
    const sy = Math.floor(g * DH);
    const off = Math.floor((hash(t) - 0.5) * 18);
    ctx.drawImage(ctx.canvas, 0, sy, DW, 12, off, sy, DW, 12);
  }

  // ── Readouts ──
  const contacts = state.hulks.filter((h) => h.alive && h.born <= t).length;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = CYAN_DIM;
  ctx.fillText('TAC-HOLO // DEBRIS FIELD 2286', 14, 22);
  ctx.textAlign = 'right';
  ctx.fillStyle = contacts > 14 ? RED : CYAN_DIM;
  ctx.fillText(`CONTACTS ${String(contacts).padStart(2, '0')}`, DW - 14, 22);
  ctx.textAlign = 'center';

  // ── Banners ──
  if (t < 160) {
    const alpha = t < 30 ? t / 30 : t > 120 ? Math.max(0, (160 - t) / 40) : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = CYAN;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 14;
    ctx.font = '300 34px monospace';
    ctx.fillText('2286 — DEBRIS FIELD', DW / 2, 150);
    ctx.font = '300 15px monospace';
    ctx.fillStyle = CYAN_DIM;
    ctx.fillText('THE FLEET IS ALREADY DEAD. HOLD WHAT REMAINS.', DW / 2, 180);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = CYAN;
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 10;
    ctx.font = '300 24px monospace';
    ctx.fillText(state.banner.text, DW / 2, 120);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
