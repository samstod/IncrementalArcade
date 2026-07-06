// FLAK ALLEY art pass: wartime newsreel. The engagement is silver-gelatin
// combat footage — monochrome with a sepia wash, animated film grain,
// wandering scratch lines, exposure flicker, and sprocket judder. Runs open
// on a silent-film intertitle card; waves arrive as lower-third captions.
// Grain frames are pre-rendered once from fixed seeds.

import { mulberry32 } from '../../core/rng';
import {
  FlakState, planePos, shellPos, bombY, BOOM_LIFE,
  FW, FH, DECK_Y,
} from './sim';

const SC = 800 / FW; // 3.125: sim world → full-res film frame

// Silver gelatin tones
const SKY_HI = '#cdc8bd';
const SKY_LO = '#a39d92';
const SEA = '#565049';
const DECK = '#3b3733';
const DECK_LINE = '#6e6860';
const SILHOUETTE = '#26231f';
const TRACER = '#f7f3e9';
const GHOST = 'rgba(214, 208, 196, 0.4)';

let grains: HTMLCanvasElement[] | null = null;

function makeGrains(): HTMLCanvasElement[] {
  return [0x6ee1, 0x1937, 0xace5].map((seed) => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d')!;
    const rng = mulberry32(seed);
    const img = g.createImageData(400, 300);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(rng() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = rng() < 0.5 ? 26 : 0;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

function hash(n: number): number {
  return mulberry32(n >>> 0)();
}

export function flakRender(ctx: CanvasRenderingContext2D, state: FlakState): void {
  const t = state.tick;
  if (!grains) grains = makeGrains();
  const W = FW * SC, H = FH * SC;

  ctx.save();

  // Sprocket judder: every so often the frame slips a few scanlines.
  const reel = hash(Math.floor(t / 97) * 31 + 7);
  if (reel < 0.16 && t % 97 < 4) ctx.translate(0, (reel - 0.08) * 60);
  if (state.shake > 0)
    ctx.translate(Math.sin(t * 1.7) * state.shake * 1.4, Math.cos(t * 2.5) * state.shake * 1.1);

  ctx.scale(SC, SC); // sim coordinates from here

  // ── The scene, in silver ──
  const sky = ctx.createLinearGradient(0, 0, 0, DECK_Y);
  sky.addColorStop(0, SKY_HI);
  sky.addColorStop(1, SKY_LO);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FW, DECK_Y);
  // Overexposed clouds.
  ctx.fillStyle = 'rgba(238, 234, 226, 0.7)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 73 + Math.floor(t / 20)) % (FW + 40)) - 20;
    const cy = 18 + i * 26;
    ctx.beginPath();
    ctx.ellipse(cx + 11, cy, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 4, cy - 3, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = SEA;
  ctx.fillRect(0, DECK_Y - 16, FW, 16);
  ctx.fillStyle = 'rgba(220, 215, 205, 0.35)';
  for (let i = 0; i < 12; i++) {
    const wx = ((i * 47 + Math.floor(t / 8) * 2) % (FW + 20)) - 10;
    ctx.fillRect(wx, DECK_Y - 13 + (i % 3) * 4, 6, 1);
  }
  ctx.fillStyle = DECK;
  ctx.fillRect(0, DECK_Y, FW, FH - DECK_Y);
  ctx.fillStyle = DECK_LINE;
  for (let x = 4; x < FW; x += 16) ctx.fillRect(x, DECK_Y + 6, 8, 1);

  // Carrier integrity: pale blocks along the hull.
  for (let i = 0; i < state.stats.carrierMaxHp; i++) {
    ctx.fillStyle = i < state.carrierHp ? '#c9c3b7' : '#191714';
    ctx.fillRect(4 + i * 7, FH - 6, 5, 3);
  }

  // Bombs: dark teardrops.
  for (const b of state.bombs) {
    if (!b.alive) continue;
    ctx.fillStyle = SILHOUETTE;
    ctx.beginPath();
    ctx.ellipse(b.x, bombY(b, t), 1.4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Planes: hard black silhouettes against the bright sky.
  for (const p of state.planes) {
    if (!p.alive) continue;
    const pos = planePos(p, t);
    if (pos.y < -6) continue;
    const s = p.bomber ? 1.5 : 1;
    ctx.fillStyle = SILHOUETTE;
    ctx.beginPath(); // wings
    ctx.ellipse(pos.x, pos.y, 6.5 * s, 1.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // fuselage
    ctx.ellipse(pos.x, pos.y, 1.6 * s, 4.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(pos.x - 2.6 * s, pos.y - 4.6 * s, 5.2 * s, 1.2); // tailplane
    if (p.maxHp > 1 && p.hp < p.maxHp) {
      // Trailing smoke from a wounded engine.
      ctx.fillStyle = 'rgba(60, 55, 50, 0.5)';
      for (let k = 1; k <= 3; k++)
        ctx.beginPath(), ctx.arc(pos.x - k * 3, pos.y - k * 4, 1.6 + k * 0.8, 0, Math.PI * 2), ctx.fill();
    }
  }

  // Shells: tracer rounds burning up the frame.
  for (const s of state.shells) {
    if (!s.alive) continue;
    const sy = shellPos(s, t, state.stats.shellSpeed);
    ctx.strokeStyle = s.owner === 0 ? TRACER : GHOST;
    ctx.lineWidth = s.owner === 0 ? 1 : 0.7;
    ctx.beginPath();
    ctx.moveTo(s.x, sy + 4);
    ctx.lineTo(s.x, sy);
    ctx.stroke();
  }

  // Guns: the crew's silhouette, ghosts half-developed.
  state.players.forEach((g, pi) => {
    const ghost = pi > 0;
    const x = Math.round(g.x);
    ctx.globalAlpha = ghost ? 0.4 : 1;
    ctx.fillStyle = ghost ? '#8d867b' : SILHOUETTE;
    ctx.fillRect(x - 4, DECK_Y - 4, 8, 4);
    ctx.fillRect(x - 2, DECK_Y - 7, 4, 3);
    ctx.fillRect(x - 1, DECK_Y - 11, 2, 4);
    ctx.globalAlpha = 1;
  });

  // Explosions: white blooms with a smudge of smoke above.
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = (bm.big ? 1.5 : 1) * (1.5 + age * 0.5);
    ctx.globalAlpha = Math.max(0, 1 - age / BOOM_LIFE) * (bm.owner > 0 ? 0.5 : 1);
    ctx.fillStyle = '#f2eee4';
    ctx.beginPath();
    ctx.arc(bm.x, bm.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(70, 64, 58, 0.5)';
    ctx.beginPath();
    ctx.arc(bm.x + 1, bm.y - r * 0.9, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  ctx.save();

  // ── Film artifacts, full-res ──
  // Sepia wash + exposure flicker.
  ctx.fillStyle = 'rgba(104, 82, 48, 0.1)';
  ctx.fillRect(0, 0, W, H);
  const flick = hash(t * 13 + 5);
  ctx.fillStyle = flick < 0.5 ? `rgba(255, 250, 240, ${flick * 0.06})` : `rgba(10, 8, 5, ${(flick - 0.5) * 0.09})`;
  ctx.fillRect(0, 0, W, H);
  // Grain.
  ctx.globalAlpha = 0.5;
  ctx.drawImage(grains[Math.floor(t / 4) % grains.length], 0, 0, W, H);
  ctx.globalAlpha = 1;
  // A wandering scratch or two.
  const scr = hash(Math.floor(t / 37) * 17 + 3);
  if (scr < 0.55) {
    ctx.strokeStyle = `rgba(235, 230, 220, ${0.1 + scr * 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scr * W, 0);
    ctx.lineTo(scr * W + (hash(t) - 0.5) * 6, H);
    ctx.stroke();
  }
  // Vignette: the lens barrel.
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, 'transparent');
  v.addColorStop(1, 'rgba(8, 6, 4, 0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // ── Intertitle card + lower-third captions ──
  ctx.textAlign = 'center';
  if (t < 170) {
    const a = t < 20 ? 1 : t > 130 ? Math.max(0, (170 - t) / 40) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#0b0906';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d8d2c4';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 60, W - 120, H - 120);
    ctx.strokeRect(72, 72, W - 144, H - 144);
    ctx.fillStyle = '#d8d2c4';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('1944 — FLAK ALLEY', W / 2, H / 2 - 26);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.fillText('“Gunners of the Pacific Fleet hold the line.”', W / 2, H / 2 + 22);
    ctx.font = '14px Georgia, serif';
    ctx.fillText('— CHRONO NEWSREEL No. 1944 —', W / 2, H / 2 + 58);
    ctx.globalAlpha = 1;
  }
  if (state.banner && t < state.banner.until && t >= 170) {
    ctx.globalAlpha = Math.min(1, (state.banner.until - t) / 40);
    ctx.fillStyle = 'rgba(10, 8, 5, 0.6)';
    ctx.fillRect(W / 2 - 220, H - 96, 440, 34);
    ctx.fillStyle = '#e8e2d4';
    ctx.font = 'bold 19px Georgia, serif';
    ctx.fillText(`${state.banner.text} — ENEMY AIRCRAFT SIGHTED`, W / 2, H - 72);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
  ctx.restore();
}
