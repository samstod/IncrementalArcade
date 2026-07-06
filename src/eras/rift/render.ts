// THE RIFT art pass: the Unraveling is eating the media themselves.
//
// The well's sixteen lanes are banded in the six mediums you fought
// through — cave ochre, tapestry wool, oil paint, newsreel silver,
// phosphor green, hologram cyan — arranged as a history of seeing. The
// singularity at the bottom is raw static: the death of representation.
// Creatures climb OUT of the noise, desaturated and half-formed near the
// floor, taking on their lane's medium as they rise. Broken seal segments
// collapse into static. You, the operative, are drawn in plain white —
// you belong to no medium.

import { mulberry32 } from '../../core/rng';
import {
  RiftState, Crawler, BOOM_LIFE,
  RW, RH, CX, CY, LANES,
} from './sim';

const SQUASH = 0.78;
const R_IN = 26;
const R_OUT = 272;

export function lanePoint(laneFrac: number, z: number): { x: number; y: number } {
  const a = (laneFrac / LANES) * Math.PI * 2 - Math.PI / 2;
  const r = R_IN + (R_OUT - R_IN) * Math.pow(Math.max(0, z), 1.5);
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * SQUASH };
}

// ── The six mediums, in the order history painted them ──
interface Medium {
  name: string;
  color: string;   // full-strength stroke
  dim: string;     // rails / faded
  dash: number[] | null;
  glow: number;    // shadowBlur; physical media get none
  width: number;
}

const MEDIA: Medium[] = [
  { name: 'ochre', color: '#b85a26', dim: 'rgba(184, 90, 38, 0.4)', dash: null, glow: 0, width: 2.6 },
  { name: 'wool', color: '#c04a30', dim: 'rgba(192, 74, 48, 0.4)', dash: [4, 3], glow: 0, width: 2.2 },
  { name: 'oil', color: '#d8a04a', dim: 'rgba(216, 160, 74, 0.4)', dash: null, glow: 0, width: 2.8 },
  { name: 'film', color: '#cfc8bb', dim: 'rgba(207, 200, 187, 0.35)', dash: null, glow: 0, width: 1.5 },
  { name: 'phosphor', color: '#5aff82', dim: 'rgba(90, 255, 130, 0.35)', dash: [2, 4], glow: 9, width: 1.6 },
  { name: 'holo', color: '#60e0ff', dim: 'rgba(96, 224, 255, 0.35)', dash: null, glow: 9, width: 1.6 },
];

function mediumOf(lane: number): Medium {
  const l = ((Math.floor(lane) % LANES) + LANES) % LANES;
  return MEDIA[Math.floor((l / LANES) * MEDIA.length)];
}

/** Fade a medium toward gray static near the floor of the well. */
function formed(ctx: CanvasRenderingContext2D, m: Medium, z: number): void {
  const f = Math.min(1, Math.max(0, (z - 0.12) / 0.5)); // fully itself by z≈0.62
  ctx.globalAlpha = 0.3 + 0.7 * f;
  ctx.strokeStyle = f < 0.5 ? '#9a9a96' : m.color;
  ctx.shadowColor = m.color;
  ctx.shadowBlur = m.glow * f;
  ctx.lineWidth = m.width;
  ctx.setLineDash(m.dash && f >= 0.5 ? m.dash : []);
}

function resetStroke(ctx: CanvasRenderingContext2D): void {
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
}

function drawCrawler(ctx: CanvasRenderingContext2D, cr: Crawler, t: number): void {
  const p = lanePoint(cr.lane + 0.5, cr.z);
  const s = 3 + cr.z * 13;
  formed(ctx, mediumOf(cr.lane), cr.z);
  ctx.beginPath();
  if (cr.kind === 'flipper') {
    const w = s * (0.7 + 0.3 * Math.sin(t * 0.2));
    ctx.moveTo(p.x - s, p.y - w * 0.5);
    ctx.lineTo(p.x + s, p.y + w * 0.5);
    ctx.lineTo(p.x + s, p.y - w * 0.5);
    ctx.lineTo(p.x - s, p.y + w * 0.5);
    ctx.closePath();
  } else if (cr.kind === 'tanker') {
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = p.x + Math.cos(a) * s;
      const py = p.y + Math.sin(a) * s * 0.8;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else {
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x + s * 0.8, p.y);
    ctx.lineTo(p.x, p.y + s);
    ctx.lineTo(p.x - s * 0.8, p.y);
    ctx.closePath();
  }
  ctx.stroke();
  if (cr.hp < cr.maxHp) {
    ctx.beginPath();
    ctx.moveTo(p.x - s * 0.6, p.y);
    ctx.lineTo(p.x + s * 0.6, p.y);
    ctx.stroke();
  }
  resetStroke(ctx);
}

export function riftRender(ctx: CanvasRenderingContext2D, state: RiftState): void {
  const t = state.tick;
  ctx.save();
  ctx.fillStyle = '#040207';
  ctx.fillRect(0, 0, RW, RH);

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 2.2) * state.shake * 0.4, Math.cos(t * 1.7) * state.shake * 0.35);

  // ── The singularity: raw static where representation has died ──
  const noise = mulberry32((t * 2654435761) >>> 0);
  const pulse = 1 + 0.12 * Math.sin(t * 0.05);
  for (let i = 0; i < 110; i++) {
    const a = noise() * Math.PI * 2;
    const rr = Math.pow(noise(), 1.7) * 34 * pulse;
    const v = Math.floor(noise() * 200) + 40;
    ctx.fillStyle = `rgba(${v}, ${v}, ${v}, ${0.25 + noise() * 0.5})`;
    const sz = noise() < 0.85 ? 1.5 : 3;
    ctx.fillRect(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr * SQUASH, sz, sz);
  }
  // A gray halo of half-eaten light around it.
  const halo = ctx.createRadialGradient(CX, CY, 6, CX, CY, 70);
  halo.addColorStop(0, 'rgba(190, 190, 185, 0.16)');
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(CX - 70, CY - 60, 140, 120);

  // ── The well: each lane rail in its medium, dissolving toward the floor ──
  for (let l = 0; l < LANES; l++) {
    const m = mediumOf(l);
    // Draw the rail in two pieces: a gray, dying inner half and a formed outer half.
    for (const [z0, z1, dead] of [[0.06, 0.45, true], [0.45, 1, false]] as const) {
      const p0 = lanePoint(l, z0);
      const p1 = lanePoint(l, z1);
      ctx.strokeStyle = dead ? 'rgba(150, 150, 145, 0.18)' : m.dim;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = dead ? 0 : m.glow * 0.5;
      ctx.lineWidth = dead ? 1 : Math.max(1, m.width - 1);
      ctx.setLineDash(dead ? [2, 6] : m.dash ?? []);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    resetStroke(ctx);
  }
  // Depth rings: gray near the floor, remembering their colors near the rim.
  for (const z of [0.2, 0.38, 0.56, 0.75, 0.9]) {
    for (let l = 0; l < LANES; l++) {
      const m = mediumOf(l);
      formed(ctx, m, z);
      ctx.globalAlpha *= 0.45;
      const a = lanePoint(l, z);
      const b = lanePoint(l + 1, z);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    resetStroke(ctx);
  }

  // ── The rim: the Continuum Seal, each segment in its medium ──
  const sealFrac = Math.max(0, state.sealHp / state.stats.sealMaxHp);
  const litLanes = Math.round(sealFrac * LANES);
  const flash = t - state.sealHitAt < 12;
  for (let l = 0; l < LANES; l++) {
    const lit = l < litLanes;
    const m = mediumOf(l);
    const a = lanePoint(l, 1);
    const b = lanePoint(l + 1, 1);
    if (lit) {
      ctx.strokeStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = m.glow;
      ctx.lineWidth = 3;
      ctx.setLineDash(m.dash ?? []);
    } else {
      // Unraveled: this stretch of reality is static now.
      ctx.strokeStyle = flash ? 'rgba(255, 255, 255, 0.5)' : 'rgba(150, 150, 145, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    resetStroke(ctx);
  }

  // ── Entropy creatures, forming as they climb ──
  for (const cr of state.crawlers) {
    if (!cr.alive || cr.born > t) continue;
    drawCrawler(ctx, cr, t);
  }

  // ── Bolts: they take the color of the lane they dive through ──
  for (const b of state.bolts) {
    if (!b.alive) continue;
    const echo = b.owner > 0;
    const m = mediumOf(b.lane);
    const p0 = lanePoint(b.lane + 0.5, Math.min(1, b.z + 0.05));
    const p1 = lanePoint(b.lane + 0.5, b.z);
    ctx.strokeStyle = echo ? 'rgba(220, 220, 215, 0.4)' : m.color;
    ctx.shadowColor = m.color;
    ctx.shadowBlur = echo ? 0 : Math.max(4, m.glow);
    ctx.lineWidth = echo ? 1.4 : 2.2;
    ctx.setLineDash(m.dash && !echo ? m.dash : []);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    resetStroke(ctx);
  }

  // ── Riders: you are no medium — plain white light. Echoes are gray. ──
  state.players.forEach((p, pi) => {
    const echo = pi > 0;
    const c = lanePoint(p.lane + 0.5, 1.04);
    const l = lanePoint(p.lane + 0.15, 1.0);
    const r = lanePoint(p.lane + 0.85, 1.0);
    const tip = lanePoint(p.lane + 0.5, 0.93);
    ctx.strokeStyle = echo ? 'rgba(200, 200, 195, 0.4)' : '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = echo ? 0 : 12;
    ctx.lineWidth = echo ? 1.6 : 2.4;
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(r.x, r.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.closePath();
    ctx.stroke();
    resetStroke(ctx);
  });

  // ── Booms: a burst in the lane's medium ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const p = lanePoint(bm.lane + 0.5, bm.z);
    const rad = (2 + age * 0.9) * (0.4 + bm.z);
    const m = mediumOf(bm.lane);
    ctx.globalAlpha = Math.max(0, 1 - age / BOOM_LIFE);
    ctx.strokeStyle = bm.owner === -1 ? 'rgba(255, 255, 255, 0.8)' : bm.owner === 0 ? m.color : 'rgba(200, 200, 195, 0.5)';
    ctx.shadowColor = m.color;
    ctx.shadowBlur = m.glow * 0.7;
    ctx.lineWidth = 1.6;
    ctx.setLineDash(m.dash ?? []);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    resetStroke(ctx);
  }

  // ── Banners ──
  ctx.textAlign = 'center';
  if (t < 190) {
    const alpha = t < 30 ? t / 30 : t > 150 ? Math.max(0, (190 - t) / 40) : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.font = '300 34px monospace';
    ctx.fillText('END OF TIME — THE RIFT', CX, 88);
    ctx.shadowBlur = 0;
    ctx.font = '300 15px monospace';
    ctx.fillStyle = 'rgba(220, 220, 215, 0.85)';
    ctx.fillText('IT IS EATING EVERY WAY OF SEEING. HOLD THE SEAL.', CX, 116);
    // The history of light, underlined in its own mediums.
    const seg = 300 / MEDIA.length;
    MEDIA.forEach((m, i) => {
      ctx.strokeStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = m.glow * 0.6;
      ctx.lineWidth = 3;
      ctx.setLineDash(m.dash ?? []);
      ctx.beginPath();
      ctx.moveTo(CX - 150 + i * seg + 2, 130);
      ctx.lineTo(CX - 150 + (i + 1) * seg - 2, 130);
      ctx.stroke();
      resetStroke(ctx);
    });
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.font = '300 24px monospace';
    ctx.fillText(state.banner.text, CX, RH - 40);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
