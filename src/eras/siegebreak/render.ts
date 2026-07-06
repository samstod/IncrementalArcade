// SIEGEBREAK art pass: a woven tapestry. The siege is embroidered in wool
// on linen, Bayeux-style: flat wool fills, dashed outlines that read as
// stitching, decorative border bands top and bottom, and a Latin caption.
// Impacts unravel as loops of loose red thread. The linen (weave, slubs,
// border motifs) is pre-rendered once from a fixed seed.

import { mulberry32 } from '../../core/rng';
import {
  SiegeState, Unit, unitPos, boltY, arrowPos,
  SW, SH, WALL_Y, GATE_X, GATE_HALF,
} from './sim';

// Bayeux wool
const LINEN = '#d9c69c';
const THREAD = '#4a3020';        // dark brown stitching
const RED = '#a04326';           // terracotta
const OLIVE = '#6b6b2a';
const GOLD = '#c49a3a';
const SLATE = '#4a5e78';
const SKIN = '#d9b98c';
const PALE = '#efe3c2';          // caption cloth

const BORDER_H = 44;

let linen: HTMLCanvasElement | null = null;

function makeLinen(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0x7a9e57);

  ctx.fillStyle = LINEN;
  ctx.fillRect(0, 0, SW, SH);
  // The weave: fine warp and weft.
  ctx.strokeStyle = 'rgba(90, 70, 40, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0.5; y < SH; y += 3) {
    ctx.moveTo(0, y);
    ctx.lineTo(SW, y);
  }
  for (let x = 0.5; x < SW; x += 3) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SH);
  }
  ctx.stroke();
  // Banded dye variation across weft rows.
  for (let y = 0; y < SH; y += 36) {
    ctx.fillStyle = `rgba(160, 130, 80, ${0.03 + rng() * 0.05})`;
    ctx.fillRect(0, y, SW, 18);
  }
  // Slubs and age stains.
  for (let i = 0; i < 130; i++) {
    ctx.fillStyle = `rgba(110, 85, 50, ${0.06 + rng() * 0.1})`;
    ctx.fillRect(rng() * SW, rng() * SH, 4 + rng() * 12, 1.5);
  }
  for (let i = 0; i < 14; i++) {
    const x = rng() * SW, y = rng() * SH, r = 20 + rng() * 60;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(140, 105, 55, ${0.05 + rng() * 0.06})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ── Border bands, Bayeux-style ──
  for (const y0 of [0, SH - BORDER_H]) {
    ctx.fillStyle = RED;
    ctx.fillRect(0, y0, SW, BORDER_H);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y0, SW, 3);
    ctx.fillRect(0, y0 + BORDER_H - 3, SW, 3);
    // Gold rails.
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y0 + 7);
    ctx.lineTo(SW, y0 + 7);
    ctx.moveTo(0, y0 + BORDER_H - 7);
    ctx.lineTo(SW, y0 + BORDER_H - 7);
    ctx.stroke();
    ctx.setLineDash([]);
    // Alternating embroidered beasts: diamonds and little birds.
    for (let x = 26; x < SW - 10; x += 52) {
      const mid = y0 + BORDER_H / 2;
      if ((x / 52) % 2 < 1) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(x, mid - 9);
        ctx.lineTo(x + 9, mid);
        ctx.lineTo(x, mid + 9);
        ctx.lineTo(x - 9, mid);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = OLIVE;
        ctx.fillStyle = OLIVE;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); // a stitched bird
        ctx.ellipse(x, mid + 1, 6, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 6, mid - 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 5, mid);
        ctx.lineTo(x - 10, mid - 5);
        ctx.moveTo(x, mid + 4);
        ctx.lineTo(x - 2, mid + 8);
        ctx.moveTo(x + 2, mid + 4);
        ctx.lineTo(x + 4, mid + 8);
        ctx.stroke();
      }
    }
  }
  return c;
}

/** Stitched outline: dashes read as thread. */
function stitch(ctx: CanvasRenderingContext2D, color = THREAD, width = 1.6): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([3, 2]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function roman(n: number): string {
  const table: [number, string][] = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out || 'I';
}

function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number): void {
  if (u.kind === 'shieldman') {
    // Terracotta tunic behind a gold kite shield with a cross.
    ctx.fillStyle = RED;
    ctx.fillRect(x - 5, y - 4, 10, 13);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 7);
    ctx.lineTo(x + 8, y - 7);
    ctx.lineTo(x + 6, y + 5);
    ctx.lineTo(x, y + 11);
    ctx.lineTo(x - 6, y + 5);
    ctx.closePath();
    ctx.fill();
    stitch(ctx);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 9);
    ctx.moveTo(x - 6, y - 1);
    ctx.lineTo(x + 6, y - 1);
    ctx.stroke();
  } else if (u.kind === 'archer') {
    // Slate hood and tunic, bow at full draw.
    ctx.fillStyle = SLATE;
    ctx.fillRect(x - 4, y - 3, 8, 12);
    ctx.beginPath();
    ctx.rect(x - 4, y - 3, 8, 12);
    stitch(ctx);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(x - 1, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SLATE;
    ctx.beginPath(); // hood
    ctx.arc(x - 1, y - 7, 3.4, Math.PI * 0.9, Math.PI * 2.05);
    ctx.fill();
    ctx.strokeStyle = THREAD;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x + 4, y, 7, -Math.PI * 0.45, Math.PI * 0.45); // bow
    ctx.moveTo(x + 4 + Math.cos(-Math.PI * 0.45) * 7, y + Math.sin(-Math.PI * 0.45) * 7);
    ctx.lineTo(x + 4 + Math.cos(Math.PI * 0.45) * 7, y + Math.sin(Math.PI * 0.45) * 7);
    ctx.stroke();
  } else {
    // Footman: olive tunic, nasal helm, levelled spear.
    ctx.fillStyle = OLIVE;
    ctx.fillRect(x - 4, y - 3, 8, 12);
    ctx.beginPath();
    ctx.rect(x - 4, y - 3, 8, 12);
    stitch(ctx);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(x, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath(); // helm
    ctx.arc(x, y - 7, 3.2, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = THREAD;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 6);
    ctx.lineTo(x + 9, y - 8);
    ctx.stroke();
  }
  // Wounds: loose red thread.
  if (u.hp < u.maxHp) {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 7);
    ctx.lineTo(x + 7, y - 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function siegeRender(ctx: CanvasRenderingContext2D, state: SiegeState): void {
  const t = state.tick;
  if (!linen) linen = makeLinen();

  ctx.save();
  ctx.drawImage(linen, 0, 0);
  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.8) * state.shake * 0.35, Math.cos(t * 2.4) * state.shake * 0.3);

  // ── The wall: embroidered stone courses ──
  ctx.fillStyle = '#c2a468';
  ctx.fillRect(0, WALL_Y, SW, SH - BORDER_H - WALL_Y);
  ctx.strokeStyle = THREAD;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([4, 3]);
  for (let row = 0; row < 3; row++) {
    const y = WALL_Y + 8 + row * 16;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SW, y);
    ctx.stroke();
    for (let x = (row % 2) * 28 + 14; x < SW; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Merlons: gold-stitched crenels that fray as they crumble.
  for (const m of state.merlons) {
    const frac = Math.max(0, m.hp / state.stats.merlonMaxHp);
    const h = 8 + 20 * frac;
    for (let i = -1; i <= 1; i++) {
      const bx = m.x + i * 22;
      ctx.fillStyle = m.hp > 0 ? '#b58e4e' : 'rgba(120, 95, 55, 0.35)';
      ctx.fillRect(bx - 8, WALL_Y - h, 16, h);
      ctx.beginPath();
      ctx.rect(bx - 8, WALL_Y - h, 16, h);
      stitch(ctx, m.hp > 0 ? GOLD : THREAD, m.hp > 0 ? 1.6 : 1);
    }
  }

  // The gate: stitched oak arch — what the archers are aiming for.
  ctx.fillStyle = '#8a5a30';
  ctx.beginPath();
  ctx.moveTo(GATE_X - 42, SH - BORDER_H);
  ctx.lineTo(GATE_X - 42, WALL_Y + 40);
  ctx.arc(GATE_X, WALL_Y + 40, 42, Math.PI, 0);
  ctx.lineTo(GATE_X + 42, SH - BORDER_H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(GATE_X - 42, SH - BORDER_H);
  ctx.lineTo(GATE_X - 42, WALL_Y + 40);
  ctx.arc(GATE_X, WALL_Y + 40, 42, Math.PI, 0);
  ctx.lineTo(GATE_X + 42, SH - BORDER_H);
  stitch(ctx, GOLD, 1.8);
  ctx.strokeStyle = THREAD;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 3]);
  for (let gx = -28; gx <= 28; gx += 14) {
    ctx.beginPath();
    ctx.moveTo(GATE_X + gx, SH - BORDER_H);
    ctx.lineTo(GATE_X + gx, WALL_Y + 40 - Math.sqrt(Math.max(0, 42 * 42 - gx * gx)) + 42);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Threat span along the parapet.
  ctx.strokeStyle = 'rgba(160, 67, 38, 0.5)';
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(GATE_X - GATE_HALF, WALL_Y - 2);
  ctx.lineTo(GATE_X + GATE_HALF, WALL_Y - 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Gate HP: a row of stitched gold bars; losses unravel in red.
  for (let i = 0; i < state.stats.gateMaxHp; i++) {
    const gx = GATE_X - state.stats.gateMaxHp * 5 + i * 10;
    if (i < state.gateHp) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(gx, WALL_Y + 46);
      ctx.lineTo(gx, WALL_Y + 62);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = RED;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(gx - 3, WALL_Y + 48);
      ctx.lineTo(gx + 3, WALL_Y + 60);
      ctx.moveTo(gx + 3, WALL_Y + 48);
      ctx.lineTo(gx - 3, WALL_Y + 60);
      ctx.stroke();
    }
  }

  // ── The besieging host ──
  for (const u of state.units) {
    if (!u.alive) continue;
    const pos = unitPos(state, u);
    if (pos.y < BORDER_H + 10) continue;
    drawUnit(ctx, u, pos.x, pos.y);
  }

  // Arrows: brown thread with a barbed head.
  ctx.strokeStyle = THREAD;
  ctx.lineWidth = 1.3;
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

  // Bolts: heavy gold-stitched quarrels; echo bolts in pale thread.
  for (const b of state.bolts) {
    const y = boltY(b, t);
    ctx.strokeStyle = b.owner === 0 ? GOLD : 'rgba(239, 227, 194, 0.7)';
    ctx.lineWidth = b.owner === 0 ? 3 : 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(b.x, y + 16);
    ctx.lineTo(b.x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(b.x - 4, y + 4);
    ctx.lineTo(b.x, y - 2);
    ctx.lineTo(b.x + 4, y + 4);
    ctx.stroke();
  }

  // ── Ballistae: stitched timber, the echoes in pale thread ──
  state.players.forEach((g, pi) => {
    const ghost = pi > 0;
    const x = g.x, y = WALL_Y - 6;
    ctx.globalAlpha = ghost ? 0.5 : 1;
    ctx.strokeStyle = ghost ? PALE : '#6a4526';
    ctx.lineWidth = ghost ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x + 16, y);
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    ctx.strokeStyle = ghost ? PALE : GOLD;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x, y - 8);
    ctx.lineTo(x + 16, y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!ghost) {
      const frac = Math.min(1, (t - g.lastShot) / state.stats.reload);
      ctx.strokeStyle = GOLD;
      ctx.beginPath();
      ctx.arc(x, y + 10, 6, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });

  // ── Impacts: the weave unravels in loops of loose thread ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = 3 + age * 0.7;
    ctx.globalAlpha = Math.max(0, 1 - age / 22);
    ctx.strokeStyle = bm.owner === -1 ? RED : bm.owner === 0 ? GOLD : PALE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bm.x, bm.y, r, 0.4, Math.PI * 1.7);
    ctx.arc(bm.x + r * 0.5, bm.y - r * 0.3, r * 0.55, Math.PI, Math.PI * 2.6);
    ctx.stroke();
    ctx.beginPath(); // the loose tail
    ctx.moveTo(bm.x + r * 0.8, bm.y + r * 0.4);
    ctx.lineTo(bm.x + r * 1.6, bm.y + r * 0.9);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Captions, embroidered in the borders ──
  ctx.textAlign = 'center';
  ctx.fillStyle = PALE;
  ctx.font = 'bold 19px Georgia, serif';
  ctx.fillText('ANNO MCCL — HIC OPPVGNATVR CASTELLVM', SW / 2, 29);
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = PALE;
    ctx.font = 'bold 20px Georgia, serif';
    ctx.fillText(`ASSALTVS ${roman(state.wave)}`, SW / 2, SH - 17);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(239, 227, 194, 0.65)';
    ctx.font = 'italic 15px Georgia, serif';
    ctx.fillText('ye cannot hold the wall — hold it longer anyway', SW / 2, SH - 17);
  }
  if (t < 170) {
    const a = t < 30 ? t / 30 : t > 130 ? Math.max(0, (170 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = THREAD;
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('SIEGEBREAK', SW / 2, 220);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(SW / 2 - 140, 232);
    ctx.lineTo(SW / 2 + 140, 232);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
