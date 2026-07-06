// DEFCON LOOP art pass: a NORAD phosphor terminal. One green phosphor, a
// tactical grid, bracketed city designators, dotted inbound tracks — and
// real phosphor persistence: the canvas is never fully cleared, so every
// track smears into afterglow. A DEFCON readout steps down as cities die.

import {
  McState, projPos, explosionRadius,
  W, H, GROUND,
} from './sim';

const BRIGHT = '#5aff82';
const MID = 'rgba(90, 255, 130, 0.55)';
const DIM = 'rgba(90, 255, 130, 0.26)';
const FAINT = 'rgba(90, 255, 130, 0.12)';
const FADE = 'rgba(2, 10, 5, 0.26)'; // persistence: how fast phosphor decays

const CITY_CODES = ['SEA', 'SFO', 'LAX', 'DEN', 'CHI', 'WDC'];

function grid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y <= H; y += 75) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  // Range rings from command center.
  ctx.beginPath();
  for (const r of [160, 320, 480]) ctx.arc(W / 2, GROUND, r, Math.PI, 0);
  ctx.stroke();
  // Border tick marks.
  ctx.strokeStyle = DIM;
  ctx.beginPath();
  for (let x = 40; x < W; x += 80) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 6);
  }
  ctx.stroke();
}

export function mcRender(ctx: CanvasRenderingContext2D, state: McState): void {
  const t = state.tick;
  ctx.save();

  // Phosphor persistence: fade, don't clear. Fresh loops start clean.
  if (t < 2) {
    ctx.fillStyle = '#020a05';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = FADE;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.7) * state.shake * 0.4, Math.cos(t * 2.3) * state.shake * 0.3);

  grid(ctx);

  // Ground line: the defended coast.
  ctx.strokeStyle = MID;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(W, GROUND);
  ctx.stroke();

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';

  // ── Cities: bracketed designators ──
  state.cities.forEach((c, i) => {
    const alive = c.hp > 0;
    if (alive) {
      ctx.strokeStyle = BRIGHT;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); // brackets
      ctx.moveTo(c.x - 20, GROUND - 22);
      ctx.lineTo(c.x - 26, GROUND - 22);
      ctx.lineTo(c.x - 26, GROUND - 2);
      ctx.lineTo(c.x - 20, GROUND - 2);
      ctx.moveTo(c.x + 20, GROUND - 22);
      ctx.lineTo(c.x + 26, GROUND - 22);
      ctx.lineTo(c.x + 26, GROUND - 2);
      ctx.lineTo(c.x + 20, GROUND - 2);
      ctx.stroke();
      ctx.fillStyle = MID; // block skyline glyph
      for (let b = 0; b < 4; b++)
        ctx.fillRect(c.x - 14 + b * 8, GROUND - 8 - ((b * 7 + i * 5) % 12), 6, 8 + ((b * 7 + i * 5) % 12));
      ctx.fillStyle = BRIGHT;
      ctx.fillText(CITY_CODES[i % CITY_CODES.length], c.x, GROUND + 14);
      if (c.hp > 1) {
        ctx.fillStyle = MID;
        ctx.fillText(`INTEG ${c.hp}`, c.x, GROUND - 28);
      }
    } else {
      // Lost: struck through, flickering.
      const flick = Math.floor(t / 9) % 3 !== 0;
      ctx.strokeStyle = flick ? DIM : FAINT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x - 18, GROUND - 20);
      ctx.lineTo(c.x + 18, GROUND - 2);
      ctx.moveTo(c.x + 18, GROUND - 20);
      ctx.lineTo(c.x - 18, GROUND - 2);
      ctx.stroke();
      ctx.fillStyle = DIM;
      ctx.fillText('LOST', c.x, GROUND + 14);
    }
  });

  // ── Batteries ──
  state.players.forEach((p, pi) => {
    const ghost = pi > 0;
    ctx.globalAlpha = ghost ? 0.3 : 1;
    p.batteries.forEach((b, bi) => {
      ctx.strokeStyle = ghost ? MID : BRIGHT;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x - 16, GROUND);
      ctx.lineTo(b.x, GROUND - 16);
      ctx.lineTo(b.x + 16, GROUND);
      ctx.stroke();
      if (!ghost) {
        ctx.fillStyle = MID;
        ctx.fillText(`B${bi + 1}`, b.x, GROUND + 14);
        // Ammo readout as a tick row.
        ctx.fillStyle = b.readyAt > t ? DIM : BRIGHT;
        const dots = Math.min(b.ammo, 12);
        for (let d = 0; d < dots; d++)
          ctx.fillRect(b.x - 18 + d * 3, GROUND + 18, 2, 4);
      }
    });
    ctx.globalAlpha = 1;
  });

  // ── Inbound tracks: dotted history, crosshair heads ──
  for (const m of state.missiles) {
    if (!m.alive) continue;
    const pos = projPos(m, t);
    if (pos.f <= 0) continue;
    ctx.strokeStyle = m.isChild ? DIM : MID;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(m.sx, m.sy);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = BRIGHT;
    ctx.beginPath(); // the contact cross
    ctx.moveTo(pos.x - 4, pos.y);
    ctx.lineTo(pos.x + 4, pos.y);
    ctx.moveTo(pos.x, pos.y - 4);
    ctx.lineTo(pos.x, pos.y + 4);
    ctx.stroke();
  }

  // ── Interceptors: solid tracks, target reticles ──
  for (const ic of state.interceptors) {
    if (!ic.alive) continue;
    const pos = projPos(ic, t);
    const echo = ic.owner > 0;
    ctx.strokeStyle = echo ? DIM : BRIGHT;
    ctx.lineWidth = echo ? 1 : 1.5;
    ctx.beginPath();
    ctx.moveTo(ic.sx, ic.sy);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.strokeStyle = echo ? DIM : MID;
    ctx.beginPath(); // designated intercept point
    ctx.arc(ic.tx, ic.ty, 5, 0, Math.PI * 2);
    ctx.moveTo(ic.tx - 8, ic.ty);
    ctx.lineTo(ic.tx - 3, ic.ty);
    ctx.moveTo(ic.tx + 3, ic.ty);
    ctx.lineTo(ic.tx + 8, ic.ty);
    ctx.stroke();
  }

  // ── Detonations: expanding sweep circles ──
  for (const e of state.explosions) {
    const r = explosionRadius(e, t);
    if (r <= 0) continue;
    const enemy = e.owner < 0;
    const echo = e.owner > 0;
    ctx.strokeStyle = enemy ? DIM : echo ? MID : BRIGHT;
    ctx.lineWidth = enemy ? 1 : 1.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ── Corner readouts ──
  const alive = state.cities.filter((c) => c.hp > 0).length;
  const defcon = Math.max(1, Math.ceil((alive * 5) / 6));
  const tracks = state.missiles.filter((m) => m.alive && projPos(m, t).f > 0).length;
  ctx.textAlign = 'left';
  ctx.font = '12px monospace';
  ctx.fillStyle = MID;
  ctx.fillText(`TRK ${String(tracks).padStart(2, '0')}`, 12, 20);
  ctx.fillText(`WAVE ${String(Math.max(1, state.wave)).padStart(2, '0')}`, 12, 36);
  const blink = defcon <= 2 && Math.floor(t / 20) % 2 === 0;
  ctx.fillStyle = blink ? BRIGHT : MID;
  ctx.textAlign = 'right';
  ctx.fillText(`DEFCON ${defcon}`, W - 12, 20);
  ctx.textAlign = 'center';

  // ── Terminal banners ──
  if (t < 150) {
    const a = t < 30 ? t / 30 : t > 110 ? Math.max(0, (150 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = BRIGHT;
    ctx.font = '22px monospace';
    ctx.fillText('CHRONOS TACTICAL v2.61 — 1983 DEFCON LOOP', W / 2, 210);
    ctx.fillStyle = MID;
    ctx.font = '13px monospace';
    ctx.fillText('> HOLD THE LINE. YOU WILL FAIL. FAIL DEEPER._', W / 2, 236);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = BRIGHT;
    ctx.font = '16px monospace';
    ctx.fillText(`*** ${state.banner.text} INBOUND ***`, W / 2, 130);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
