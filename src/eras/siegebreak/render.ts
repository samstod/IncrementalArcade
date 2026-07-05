// SIEGEBREAK art pass: two-tone parchment / woodcut. Everything is ink on
// aged paper — hatched fills, heavy outlines, a wax-red accent for banners.
// The parchment texture is pre-rendered once from a fixed seed.

import { mulberry32 } from '../../core/rng';
import {
  SiegeState, Unit, unitPos, boltY, arrowPos,
  SW, SH, WALL_Y, GATE_X, GATE_HALF,
} from './sim';

const INK = '#2b1c0d';
const INK_FADE = 'rgba(43, 28, 13, 0.45)';
const WAX = '#8a2318';
const PARCH = '#e7d7ab';

let parchment: HTMLCanvasElement | null = null;

function makeParchment(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PARCH;
  ctx.fillRect(0, 0, SW, SH);
  const rng = mulberry32(0x9a9c);
  // Age stains
  for (let i = 0; i < 70; i++) {
    const x = rng() * SW, y = rng() * SH, r = 10 + rng() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150, 110, 50, ${0.02 + rng() * 0.05})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fibrous flecks
  ctx.strokeStyle = 'rgba(120, 90, 40, 0.12)';
  for (let i = 0; i < 250; i++) {
    const x = rng() * SW, y = rng() * SH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 8, y + (rng() - 0.5) * 3);
    ctx.stroke();
  }
  // Darkened edges
  const eg = ctx.createRadialGradient(SW / 2, SH / 2, SH / 2.4, SW / 2, SH / 2, SH);
  eg.addColorStop(0, 'transparent');
  eg.addColorStop(1, 'rgba(90, 60, 20, 0.35)');
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, SW, SH);
  return c;
}

function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap = 5): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let d = -h; d < w; d += gap) {
    ctx.moveTo(x + d, y + h);
    ctx.lineTo(x + d + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = 2;
  if (u.kind === 'shieldman') {
    // Kite shield with a cross, helmet dome above.
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 8);
    ctx.lineTo(x + 9, y - 8);
    ctx.lineTo(x + 7, y + 6);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 7, y + 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 10);
    ctx.moveTo(x - 8, y - 1);
    ctx.lineTo(x + 8, y - 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 12, 4, Math.PI, 0);
    ctx.stroke();
  } else if (u.kind === 'archer') {
    // Bow arc + drawn string, hooded head.
    ctx.beginPath();
    ctx.arc(x, y, 9, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 8);
    ctx.lineTo(x - 5, y);
    ctx.lineTo(x + 3, y + 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 8, y - 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Footman: helmet, torso wedge, spear.
    ctx.beginPath();
    ctx.arc(x, y - 8, 4.5, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 3);
    ctx.lineTo(x + 6, y - 3);
    ctx.lineTo(x + 3, y + 10);
    ctx.lineTo(x - 3, y + 10);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 10);
    ctx.lineTo(x + 8, y - 14);
    ctx.moveTo(x + 5, y - 11);
    ctx.lineTo(x + 8, y - 15);
    ctx.lineTo(x + 11, y - 11);
    ctx.stroke();
  }
  // Wounds: a wax slash across hurt units.
  if (u.hp < u.maxHp) {
    ctx.strokeStyle = WAX;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 8);
    ctx.lineTo(x + 8, y - 10);
    ctx.stroke();
  }
}

export function siegeRender(ctx: CanvasRenderingContext2D, state: SiegeState): void {
  const t = state.tick;
  if (!parchment) parchment = makeParchment();

  ctx.save();
  ctx.drawImage(parchment, 0, 0);
  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.8) * state.shake * 0.35, Math.cos(t * 2.4) * state.shake * 0.3);

  // ── The wall: stone courses + crenellated merlons ──
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(0, WALL_Y, SW, SH - WALL_Y);
  hatch(ctx, 0, WALL_Y, SW, 26, 9);
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 3; row++) {
    const y = WALL_Y + 26 + row * 22;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SW, y);
    ctx.stroke();
    for (let x = (row % 2) * 30; x < SW; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 22);
      ctx.stroke();
    }
  }

  for (const m of state.merlons) {
    const full = state.stats.merlonMaxHp;
    const frac = Math.max(0, m.hp / full);
    const h = 8 + 20 * frac;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = m.hp > 0 ? INK : INK_FADE;
    // Three crenels per merlon block, height melts with damage.
    for (let i = -1; i <= 1; i++) {
      const bx = m.x + i * 22;
      ctx.strokeRect(bx - 8, WALL_Y - h, 16, h);
      if (m.hp > 0) hatch(ctx, bx - 8, WALL_Y - h, 16, h, 6);
    }
  }

  // The gate: an arch of timbers at the wall's center — this is what the
  // archers are aiming for.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(GATE_X - 42, SH);
  ctx.lineTo(GATE_X - 42, WALL_Y + 40);
  ctx.arc(GATE_X, WALL_Y + 40, 42, Math.PI, 0);
  ctx.lineTo(GATE_X + 42, SH);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let gx = -30; gx <= 30; gx += 12) {
    ctx.beginPath();
    ctx.moveTo(GATE_X + gx, SH);
    ctx.lineTo(GATE_X + gx, WALL_Y + 40 - Math.sqrt(Math.max(0, 42 * 42 - gx * gx)) + 42);
    ctx.stroke();
  }
  // Threat zone ticks along the parapet edge.
  ctx.strokeStyle = INK_FADE;
  ctx.beginPath();
  ctx.moveTo(GATE_X - GATE_HALF, WALL_Y - 2);
  ctx.lineTo(GATE_X + GATE_HALF, WALL_Y - 2);
  ctx.stroke();

  // Gate HP: timber tally marks under the wall face.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (let i = 0; i < state.stats.gateMaxHp; i++) {
    const gx = SW / 2 - state.stats.gateMaxHp * 5 + i * 10;
    ctx.beginPath();
    ctx.moveTo(gx, WALL_Y + 34);
    ctx.lineTo(gx, WALL_Y + 52);
    ctx.stroke();
    if (i >= state.gateHp) {
      ctx.strokeStyle = WAX;
      ctx.beginPath();
      ctx.moveTo(gx - 4, WALL_Y + 36);
      ctx.lineTo(gx + 4, WALL_Y + 50);
      ctx.stroke();
      ctx.strokeStyle = INK;
    }
  }

  // ── Besiegers ──
  for (const u of state.units) {
    if (!u.alive) continue;
    const pos = unitPos(state, u);
    if (pos.y < 20) continue;
    drawUnit(ctx, u, pos.x, pos.y);
  }

  // Arrows: thin falling strokes with barbs, angled along their flight.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  for (const a of state.arrows) {
    if (!a.alive) continue;
    const pos = arrowPos(a, t);
    const prev = arrowPos(a, t - 4);
    const dx = (pos.x - prev.x) * 2;
    ctx.beginPath();
    ctx.moveTo(pos.x - dx, pos.y - 10);
    ctx.lineTo(pos.x, pos.y + 2);
    ctx.moveTo(pos.x - 3, pos.y - 1);
    ctx.lineTo(pos.x, pos.y + 3);
    ctx.lineTo(pos.x + 3, pos.y - 1);
    ctx.stroke();
  }

  // Bolts: heavy quarrels, echo bolts in faded ink.
  for (const b of state.bolts) {
    const y = boltY(b, t);
    ctx.strokeStyle = b.owner === 0 ? INK : INK_FADE;
    ctx.lineWidth = b.owner === 0 ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x, y + 16);
    ctx.lineTo(b.x, y);
    ctx.moveTo(b.x - 4, y + 4);
    ctx.lineTo(b.x, y - 2);
    ctx.lineTo(b.x + 4, y + 4);
    ctx.stroke();
  }

  // Ballistae: the live one solid, echoes as faded sketches.
  state.players.forEach((g, pi) => {
    const ghost = pi > 0;
    const x = g.x;
    const y = WALL_Y - 6;
    ctx.strokeStyle = ghost ? INK_FADE : INK;
    ctx.lineWidth = ghost ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x + 16, y);           // bow arm
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x, y - 8);            // string
    ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x, y - 18);           // stock + loaded quarrel
    ctx.stroke();
    if (!ghost) {
      // Reload gauge: a small winding crank arc.
      const frac = Math.min(1, (t - g.lastShot) / state.stats.reload);
      ctx.beginPath();
      ctx.arc(x, y + 10, 6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  });

  // Kill/impact marks: woodcut burst stars.
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = 4 + age * 0.8;
    ctx.strokeStyle = bm.owner === -1 ? WAX : bm.owner === 0 ? INK : INK_FADE;
    ctx.lineWidth = Math.max(1, 3 - age * 0.12);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.5;
      ctx.moveTo(bm.x + Math.cos(ang) * r * 0.35, bm.y + Math.sin(ang) * r * 0.35);
      ctx.lineTo(bm.x + Math.cos(ang) * r, bm.y + Math.sin(ang) * r);
    }
    ctx.stroke();
  }

  // ── Manuscript banners ──
  ctx.textAlign = 'center';
  if (t < 170) {
    const a = t < 30 ? t / 30 : t > 130 ? Math.max(0, (170 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = WAX;
    ctx.font = 'bold italic 40px Georgia, serif';
    ctx.fillText('Anno 1250 — SIEGEBREAK', SW / 2, 230);
    ctx.fillStyle = INK;
    ctx.font = 'italic 17px Georgia, serif';
    ctx.fillText('Ye cannot hold the wall. Hold it longer anyway.', SW / 2, 262);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = WAX;
    ctx.font = 'bold italic 30px Georgia, serif';
    ctx.fillText(state.banner.text.replace('WAVE', 'ASSAULT'), SW / 2, 150);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
