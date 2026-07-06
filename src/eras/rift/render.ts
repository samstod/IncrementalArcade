// THE RIFT art pass: color-cycling synthwave wireframe. The well is drawn
// as sixteen lane rails converging on a pulsing singularity; every stroke
// slides around the hue wheel as time passes. Nothing here is filled that
// can be a line.

import {
  RiftState, Crawler, BOOM_LIFE,
  RW, RH, CX, CY, LANES,
} from './sim';

const SQUASH = 0.78; // the well is an ellipse — a table seen at an angle
const R_IN = 26;
const R_OUT = 272;

export function lanePoint(laneFrac: number, z: number): { x: number; y: number } {
  const a = (laneFrac / LANES) * Math.PI * 2 - Math.PI / 2;
  const r = R_IN + (R_OUT - R_IN) * Math.pow(Math.max(0, z), 1.5);
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * SQUASH };
}

function hue(t: number, off = 0): number {
  return (t * 0.7 + off) % 360;
}

function stroke(ctx: CanvasRenderingContext2D, h: number, alpha = 1, width = 1.4): void {
  ctx.strokeStyle = `hsla(${h}, 95%, 62%, ${alpha})`;
  ctx.shadowColor = `hsl(${h}, 95%, 55%)`;
  ctx.shadowBlur = 9;
  ctx.lineWidth = width;
}

function drawCrawler(ctx: CanvasRenderingContext2D, cr: Crawler, t: number): void {
  const p = lanePoint(cr.lane + 0.5, cr.z);
  const s = 3 + cr.z * 13;
  const h = hue(t, cr.kind === 'tanker' ? 300 : cr.kind === 'flipper' ? 200 : 120);
  stroke(ctx, h, 0.95, 1.6);
  ctx.beginPath();
  if (cr.kind === 'flipper') {
    // Bowtie that flexes as it climbs.
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
}

export function riftRender(ctx: CanvasRenderingContext2D, state: RiftState): void {
  const t = state.tick;
  ctx.save();
  ctx.fillStyle = '#05020c';
  ctx.fillRect(0, 0, RW, RH);

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 2.2) * state.shake * 0.4, Math.cos(t * 1.7) * state.shake * 0.35);

  // The singularity: a breathing gradient at the bottom of everything.
  const pulse = 14 + Math.sin(t * 0.05) * 5;
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, pulse * 4);
  g.addColorStop(0, `hsla(${hue(t, 40)}, 100%, 70%, 0.8)`);
  g.addColorStop(0.4, `hsla(${hue(t, 300)}, 100%, 40%, 0.25)`);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(CX - 80, CY - 70, 160, 140);

  // ── The well: lane rails + depth rings ──
  for (let l = 0; l < LANES; l++) {
    const near = lanePoint(l, 1);
    const far = lanePoint(l, 0);
    stroke(ctx, hue(t, l * 10), 0.5, 1);
    ctx.beginPath();
    ctx.moveTo(far.x, far.y);
    ctx.lineTo(near.x, near.y);
    ctx.stroke();
  }
  for (const z of [0.18, 0.36, 0.55, 0.75, 0.9]) {
    stroke(ctx, hue(t, 180 + z * 120), 0.3 + z * 0.25, 1);
    ctx.beginPath();
    for (let l = 0; l <= LANES; l++) {
      const p = lanePoint(l, z);
      if (l === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // The rim: the Continuum Seal. Bright segments = remaining integrity.
  const sealFrac = Math.max(0, state.sealHp / state.stats.sealMaxHp);
  const litLanes = Math.round(sealFrac * LANES);
  const flash = t - state.sealHitAt < 12;
  for (let l = 0; l < LANES; l++) {
    const lit = l < litLanes;
    stroke(ctx, flash && !lit ? 0 : hue(t, lit ? 60 : 0), lit ? 0.95 : 0.15, lit ? 2.4 : 1);
    const a = lanePoint(l, 1);
    const b = lanePoint(l + 1, 1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ── Entropy creatures ──
  for (const cr of state.crawlers) {
    if (!cr.alive || cr.born > t) continue;
    drawCrawler(ctx, cr, t);
  }

  // ── Bolts: dashes diving down their lane ──
  for (const b of state.bolts) {
    if (!b.alive) continue;
    const echo = b.owner > 0;
    const p0 = lanePoint(b.lane + 0.5, Math.min(1, b.z + 0.05));
    const p1 = lanePoint(b.lane + 0.5, b.z);
    stroke(ctx, echo ? 190 : hue(t, 60), echo ? 0.55 : 1, echo ? 1.4 : 2);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  // ── Riders: your blaster sled and the echo sleds ──
  state.players.forEach((p, pi) => {
    const echo = pi > 0;
    const c = lanePoint(p.lane + 0.5, 1.04);
    const l = lanePoint(p.lane + 0.15, 1.0);
    const r = lanePoint(p.lane + 0.85, 1.0);
    const tip = lanePoint(p.lane + 0.5, 0.93);
    stroke(ctx, echo ? 190 : hue(t, 60), echo ? 0.5 : 1, echo ? 1.6 : 2.4);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(r.x, r.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.closePath();
    ctx.stroke();
  });

  // ── Booms: rings blooming in the well ──
  for (const bm of state.booms) {
    const age = t - bm.born;
    const p = lanePoint(bm.lane + 0.5, bm.z);
    const rad = (2 + age * 0.9) * (0.4 + bm.z);
    ctx.globalAlpha = Math.max(0, 1 - age / BOOM_LIFE);
    stroke(ctx, bm.owner === -1 ? 0 : bm.owner === 0 ? hue(t, 60) : 190, 1, 1.6);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;

  // ── Banners ──
  ctx.textAlign = 'center';
  if (t < 170) {
    const alpha = t < 30 ? t / 30 : t > 130 ? Math.max(0, (170 - t) / 40) : 1;
    ctx.globalAlpha = alpha;
    stroke(ctx, hue(t, 320), 1, 1.5);
    ctx.font = '300 34px monospace';
    ctx.strokeText('END OF TIME — THE RIFT', CX, 92);
    ctx.font = '300 15px monospace';
    ctx.strokeText('THE UNRAVELING BEGINS HERE. SO DO YOU.', CX, 122);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    stroke(ctx, hue(t, 60), 1, 1.5);
    ctx.font = '300 24px monospace';
    ctx.strokeText(state.banner.text, CX, RH - 40);
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
  ctx.restore();
}
