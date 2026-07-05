// FLAK ALLEY art pass: 8-bit NES pixel art. Everything draws onto a 256×192
// offscreen backbuffer with procedural sprites, then upscales to the main
// canvas with image smoothing off for hard chunky pixels.

import {
  FlakState, planePos, shellPos, bombY, BOOM_LIFE,
  FW, FH, DECK_Y,
} from './sim';

// NES-flavored palette
const SKY = '#6888fc';
const SKY_HI = '#a4b4fc';
const SEA = '#0044a8';
const SEA_WAVE = '#3cbcfc';
const DECK = '#787878';
const DECK_LINE = '#b8b8b8';
const DECK_EDGE = '#404040';
const GUN = '#fcfcfc';
const GUN_DARK = '#a8a8a8';
const SHELL = '#fcfc54';
const ECHO = '#a4e4fc';
const PLANE_BODY = '#00a800';
const PLANE_DARK = '#005800';
const BOMBER_BODY = '#ac7c00';
const BOMBER_DARK = '#503000';
const BOMB = '#d82800';
const BOOM_COLORS = ['#fcfcfc', '#fcfc54', '#fc7460', '#d82800'];

let back: HTMLCanvasElement | null = null;

function backbuffer(): CanvasRenderingContext2D {
  if (!back) {
    back = document.createElement('canvas');
    back.width = FW;
    back.height = FH;
  }
  return back.getContext('2d')!;
}

// 1 = dark, 2 = body, 3 = highlight
const FIGHTER = [
  '..2..',
  '.121.',
  '22222',
  '1.2.1',
  '..1..',
];
const BOMBER = [
  '..222..',
  '.21112.',
  '2222222',
  '21.2.12',
  '...2...',
];

function sprite(
  ctx: CanvasRenderingContext2D,
  map: string[],
  x: number, y: number,
  body: string, dark: string,
): void {
  const w = map[0].length;
  const h = map.length;
  const ox = Math.round(x - w / 2);
  const oy = Math.round(y - h / 2);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = map[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = ch === '1' ? dark : body;
      ctx.fillRect(ox + c, oy + r, 1, 1);
    }
  }
}

export function flakRender(main: CanvasRenderingContext2D, state: FlakState): void {
  const ctx = backbuffer();
  const t = state.tick;

  // Sky with a lighter horizon band, then sea, then deck.
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, FW, FH);
  // Drifting pixel clouds
  ctx.fillStyle = SKY_HI;
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 73 + Math.floor(t / 20)) % (FW + 40)) - 20;
    const cy = 18 + i * 26;
    ctx.fillRect(cx, cy, 22, 4);
    ctx.fillRect(cx + 4, cy - 3, 14, 3);
    ctx.fillRect(cx + 6, cy + 4, 10, 2);
  }
  ctx.fillRect(0, DECK_Y - 26, FW, 10);
  ctx.fillStyle = SEA;
  ctx.fillRect(0, DECK_Y - 16, FW, FH - DECK_Y + 16);
  ctx.fillStyle = SEA_WAVE;
  for (let i = 0; i < 12; i++) {
    const wx = ((i * 47 + Math.floor(t / 8) * 2) % (FW + 20)) - 10;
    ctx.fillRect(wx, DECK_Y - 13 + (i % 3) * 4, 6, 1);
  }

  // Carrier deck
  ctx.fillStyle = DECK_EDGE;
  ctx.fillRect(0, DECK_Y - 2, FW, 2);
  ctx.fillStyle = DECK;
  ctx.fillRect(0, DECK_Y, FW, FH - DECK_Y);
  ctx.fillStyle = DECK_LINE;
  for (let x = 4; x < FW; x += 16) ctx.fillRect(x, DECK_Y + 6, 8, 1);

  // Carrier HP as a row of hull segments.
  for (let i = 0; i < state.stats.carrierMaxHp; i++) {
    ctx.fillStyle = i < state.carrierHp ? '#00a800' : '#d82800';
    ctx.fillRect(4 + i * 7, FH - 6, 5, 3);
  }

  // Bombs
  for (const b of state.bombs) {
    if (!b.alive) continue;
    ctx.fillStyle = BOMB;
    ctx.fillRect(Math.round(b.x) - 1, Math.round(bombY(b, t)) - 1, 2, 3);
  }

  // Planes (flash white on recent spawn-in is skipped; keep it clean)
  for (const p of state.planes) {
    if (!p.alive) continue;
    const pos = planePos(p, t);
    if (pos.y < -6) continue;
    if (p.bomber) sprite(ctx, BOMBER, pos.x, pos.y, BOMBER_BODY, BOMBER_DARK);
    else sprite(ctx, FIGHTER, pos.x, pos.y, PLANE_BODY, PLANE_DARK);
    if (p.maxHp > 1 && p.hp < p.maxHp) {
      ctx.fillStyle = '#fc7460';
      ctx.fillRect(Math.round(pos.x) - 3, Math.round(pos.y) - 6, Math.max(1, Math.round(6 * (p.hp / p.maxHp))), 1);
    }
  }

  // Shells
  for (const s of state.shells) {
    if (!s.alive) continue;
    const sy = shellPos(s, t, state.stats.shellSpeed);
    ctx.fillStyle = s.owner === 0 ? SHELL : ECHO;
    ctx.globalAlpha = s.owner === 0 ? 1 : 0.7;
    ctx.fillRect(Math.round(s.x), Math.round(sy), 1, 3);
    ctx.globalAlpha = 1;
  }

  // Guns: live player solid, echoes pale ghosts.
  state.players.forEach((g, pi) => {
    const ghost = pi > 0;
    const x = Math.round(g.x);
    ctx.globalAlpha = ghost ? 0.45 : 1;
    const body = ghost ? ECHO : GUN;
    const dark = ghost ? '#6888fc' : GUN_DARK;
    ctx.fillStyle = dark;
    ctx.fillRect(x - 4, DECK_Y - 4, 8, 4);
    ctx.fillStyle = body;
    ctx.fillRect(x - 2, DECK_Y - 7, 4, 3);
    ctx.fillRect(x - 1, DECK_Y - 10, 2, 3);
    ctx.globalAlpha = 1;
  });

  // Explosions: expanding pixel rings.
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = (bm.big ? 1.5 : 1) * (1 + age * 0.45);
    ctx.fillStyle = BOOM_COLORS[Math.min(BOOM_COLORS.length - 1, Math.floor(age / 5))];
    ctx.globalAlpha = bm.owner > 0 ? 0.6 : 1;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      ctx.fillRect(
        Math.round(bm.x + Math.cos(ang) * r),
        Math.round(bm.y + Math.sin(ang) * r),
        age < BOOM_LIFE / 2 ? 2 : 1, age < BOOM_LIFE / 2 ? 2 : 1,
      );
    }
    ctx.globalAlpha = 1;
  }

  // Banners drawn in the low-res buffer so the text pixelates too.
  ctx.textAlign = 'center';
  if (t < 140) {
    ctx.fillStyle = '#000000';
    ctx.font = '10px monospace';
    ctx.fillText('1944 — FLAK ALLEY', FW / 2 + 1, 61);
    ctx.fillStyle = '#fcfcfc';
    ctx.fillText('1944 — FLAK ALLEY', FW / 2, 60);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#d82800';
    ctx.fillText('GUARD THE CARRIER. STEER. THE GUN NEVER STOPS.', FW / 2, 72);
  }
  if (state.banner && t < state.banner.until) {
    ctx.font = '9px monospace';
    ctx.fillStyle = '#fcfc54';
    ctx.fillText(state.banner.text, FW / 2, 44);
  }
  ctx.textAlign = 'left';

  // Upscale to the main canvas with hard pixels + screen shake.
  main.save();
  main.imageSmoothingEnabled = false;
  main.fillStyle = '#000';
  main.fillRect(0, 0, main.canvas.width, main.canvas.height);
  if (state.shake > 0)
    main.translate(Math.sin(t * 1.9) * state.shake * 0.5, Math.cos(t * 2.7) * state.shake * 0.4);
  main.drawImage(back!, 0, 0, FW, FH, 0, 0, main.canvas.width, main.canvas.height);
  main.restore();
}
