// PRIMEVAL art pass: cave painting. The hunt is daubed on torch-lit rock in
// ochre, charcoal, and white clay — the megapede is a charcoal serpent, the
// hunters are Lascaux stick figures, and the tribe's lives are a row of
// ochre handprints. Strokes are doubled with small offsets for a chalky,
// hand-daubed edge. The rock wall is pre-rendered once from a fixed seed;
// firelight breathes over it every frame.
//
// The sim still runs in its 160×120 world — rendering scales up 5× so the
// paint stays smooth, not pixelated.

import { mulberry32 } from '../../core/rng';
import {
  PrimevalState, spiderPos, fernIdx,
  PW, PH, CELL, COLS, ROWS, CAMP_ROW, HUNTER_TOP,
} from './sim';

const SCALE = 5; // 160×120 sim world → 800×600 canvas

const OCHRE = '#9c4a1e';
const OCHRE_LIGHT = '#c8763a';
const YELLOW_OCHRE = '#c8973f';
const CHARCOAL = '#241a12';
const CLAY = 'rgba(224, 212, 192, 0.55)'; // ancestor spirits
const FLEA_SPEED = 1.4;

let rock: HTMLCanvasElement | null = null;

function makeRock(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PW * SCALE;
  c.height = PH * SCALE;
  const ctx = c.getContext('2d')!;
  const rng = mulberry32(0xcafe11);

  ctx.fillStyle = '#7d684d';
  ctx.fillRect(0, 0, c.width, c.height);
  // Mineral blotches
  for (let i = 0; i < 90; i++) {
    const x = rng() * c.width, y = rng() * c.height, r = 24 + rng() * 110;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = ['#6e5b41', '#8a7455', '#5c4a36', '#93805f'][Math.floor(rng() * 4)];
    g.addColorStop(0, tone);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.1 + rng() * 0.16;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  // Cracks
  ctx.strokeStyle = 'rgba(38, 28, 18, 0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    let x = rng() * c.width, y = rng() * c.height * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rng() - 0.5) * 90;
      y += 20 + rng() * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // The cave floor: a darker shelf where the camp sits.
  ctx.fillStyle = 'rgba(40, 30, 20, 0.35)';
  ctx.fillRect(0, CAMP_ROW * CELL * SCALE, c.width, c.height - CAMP_ROW * CELL * SCALE);
  // Vignette: the walls curve away from the light.
  const v = ctx.createRadialGradient(c.width / 2, c.height * 0.62, c.height * 0.35, c.width / 2, c.height / 2, c.height * 0.95);
  v.addColorStop(0, 'transparent');
  v.addColorStop(1, 'rgba(18, 12, 8, 0.75)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Chalky stroke: the same path drawn twice, slightly offset and faded. */
function daub(ctx: CanvasRenderingContext2D, draw: () => void, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw();
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.translate(0.35, -0.3);
  ctx.lineWidth = width * 0.7;
  draw();
  ctx.stroke();
  ctx.restore();
}

function handprint(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean): void {
  ctx.globalAlpha = lit ? 0.9 : 0.22;
  ctx.fillStyle = lit ? OCHRE : CHARCOAL;
  ctx.beginPath();
  ctx.arc(x, y, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  for (let f = 0; f < 5; f++) {
    const a = -Math.PI / 2 + (f - 2) * 0.38;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8);
    ctx.lineTo(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function stickHunter(ctx: CanvasRenderingContext2D, x: number, y: number, ghost: boolean, t: number): void {
  const color = ghost ? CLAY : CHARCOAL;
  if (ghost) ctx.globalAlpha = 0.6;
  const run = Math.sin(t * 0.18) * 0.9; // legs mid-stride
  daub(ctx, () => {
    ctx.beginPath();
    ctx.arc(x, y - 4.6, 1.3, 0, Math.PI * 2);          // head
    ctx.moveTo(x, y - 3.3);
    ctx.lineTo(x, y);                                   // spine
    ctx.moveTo(x, y - 2.6);
    ctx.lineTo(x + 2.6, y - 5.4);                       // spear arm, raised
    ctx.moveTo(x, y - 2.2);
    ctx.lineTo(x - 2.2, y - 1);                         // off arm
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.6 - run, y + 3.4);                 // legs
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1.6 + run, y + 3.4);
  }, color, 0.85);
  // The raised spear itself, in ochre.
  daub(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(x + 1.2, y - 3.2);
    ctx.lineTo(x + 4.2, y - 7.8);
  }, ghost ? CLAY : OCHRE, 0.7);
  ctx.globalAlpha = 1;
}

export function primevalRender(ctx: CanvasRenderingContext2D, state: PrimevalState): void {
  const t = state.tick;
  if (!rock) rock = makeRock();

  ctx.save();
  ctx.drawImage(rock, 0, 0);

  // Firelight breathing over the wall from the camp below.
  const flick = 0.1 + 0.035 * Math.sin(t * 0.09) + 0.02 * Math.sin(t * 0.23 + 1.7);
  for (const fx of [160, 640]) {
    const g = ctx.createRadialGradient(fx, 585, 20, fx, 585, 420);
    g.addColorStop(0, `rgba(255, 150, 60, ${flick})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PW * SCALE, PH * SCALE);
  }

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 2.1) * state.shake * 1.6, Math.cos(t * 1.6) * state.shake * 1.3);

  ctx.scale(SCALE, SCALE); // from here on: sim coordinates

  // ── Ferns: daubed trees in ochre ──
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const hp = state.ferns[fernIdx(col, row)];
      if (hp <= 0) continue;
      const x = col * CELL + 4, y = row * CELL;
      ctx.globalAlpha = hp >= 2 ? 0.95 : 0.45;
      daub(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x, y + 7.4);
        ctx.lineTo(x, y + 2.6);                 // trunk
        ctx.moveTo(x, y + 3.4);
        ctx.lineTo(x - 2.6, y + 0.8);           // branches
        ctx.moveTo(x, y + 3.4);
        ctx.lineTo(x + 2.6, y + 0.8);
        ctx.moveTo(x, y + 2.6);
        ctx.lineTo(x, y);
      }, hp >= 2 ? OCHRE : OCHRE_LIGHT, 0.9);
      ctx.globalAlpha = 1;
    }
  }

  // ── The megapede: a charcoal serpent ──
  for (const seg of state.segments) {
    if (!seg.alive) continue;
    const x = seg.x, y = seg.y + CELL / 2;
    ctx.fillStyle = CHARCOAL;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.4, 2.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // A ridge of back bristles, painted.
    ctx.strokeStyle = CHARCOAL;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 2.7);
    ctx.lineTo(x - 2.6, y - 3.9);
    ctx.moveTo(x, y - 2.9);
    ctx.lineTo(x, y - 4.2);
    ctx.moveTo(x + 2, y - 2.7);
    ctx.lineTo(x + 2.6, y - 3.9);
    ctx.stroke();
    ctx.fillStyle = '#d9cfc0';
    ctx.fillRect(x + (seg.dir === 1 ? 1.2 : -1.9), y - 0.6, 0.9, 0.9); // eye
  }

  // ── Fleas: fat charcoal beetles ──
  for (const f of state.fleas) {
    if (!f.alive || f.born > t) continue;
    const y = (t - f.born) * FLEA_SPEED;
    ctx.fillStyle = CHARCOAL;
    ctx.beginPath();
    ctx.ellipse(f.x, y, 2.4, 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CHARCOAL;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (const s of [-1.6, 0, 1.6]) {
      ctx.moveTo(f.x + s, y + 1.2);
      ctx.lineTo(f.x + s * 1.4, y + 3);
    }
    ctx.stroke();
  }

  // ── Spiders: radiating charcoal legs ──
  for (const s of state.spiders) {
    if (!s.alive || s.born > t) continue;
    const pos = spiderPos(s, t);
    const twitch = Math.floor(t / 6) % 2 === 0 ? 0 : 0.3;
    ctx.fillStyle = CHARCOAL;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CHARCOAL;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    for (let l = 0; l < 8; l++) {
      const a = (l / 8) * Math.PI * 2 + 0.4 + (l % 2 === 0 ? twitch : -twitch);
      ctx.moveTo(pos.x + Math.cos(a) * 2, pos.y + Math.sin(a) * 1.6);
      ctx.lineTo(pos.x + Math.cos(a) * 5.4, pos.y + Math.sin(a) * 4.4);
    }
    ctx.stroke();
  }

  // ── Spears in flight ──
  for (const sp of state.spears) {
    if (!sp.alive) continue;
    const ghost = sp.owner > 0;
    if (ghost) ctx.globalAlpha = 0.55;
    daub(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y + 4);
      ctx.lineTo(sp.x, sp.y - 1);
      ctx.moveTo(sp.x - 1, sp.y);
      ctx.lineTo(sp.x, sp.y - 1.4);
      ctx.lineTo(sp.x + 1, sp.y);
    }, ghost ? CLAY : YELLOW_OCHRE, 0.7);
    ctx.globalAlpha = 1;
  }

  // ── Hunters: the living one in charcoal, ancestors in white clay ──
  state.players.forEach((h, pi) => stickHunter(ctx, h.x, h.y, pi > 0, t + pi * 37));

  // ── Kill marks: ochre splatter ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = 1 + age * 0.5;
    ctx.fillStyle = bm.owner === -1 ? CHARCOAL : bm.owner === 0 ? OCHRE : '#d9cfc0';
    ctx.globalAlpha = Math.max(0, 1 - age / 14);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + bm.born;
      ctx.beginPath();
      ctx.arc(bm.x + Math.cos(a) * r, bm.y + Math.sin(a) * r, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── The tribe: a row of handprints on the cave floor ──
  for (let i = 0; i < state.stats.tribeMaxHp; i++) {
    const x = 6 + i * 9;
    if (x > PW - 5) break;
    handprint(ctx, x, PH - 4.5, i < state.tribeHp);
  }

  // Hunting-ground edge: a faint painted line.
  ctx.strokeStyle = 'rgba(156, 74, 30, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(0, HUNTER_TOP);
  ctx.lineTo(PW, HUNTER_TOP);
  ctx.stroke();

  ctx.restore(); // back to pixel space for text
  ctx.save();

  // ── Painted titles ──
  ctx.textAlign = 'center';
  if (t < 150) {
    const a = t < 30 ? t / 30 : t > 110 ? Math.max(0, (150 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = OCHRE;
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText('P R I M E V A L', 401, 202);
    ctx.fillStyle = CHARCOAL;
    ctx.fillText('P R I M E V A L', 399, 200);
    ctx.fillStyle = OCHRE_LIGHT;
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillText('something long comes downhill — paint it on the wall', 400, 232);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = OCHRE;
    ctx.font = 'bold 28px Georgia, serif';
    ctx.fillText(state.banner.text, 400, 140);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
