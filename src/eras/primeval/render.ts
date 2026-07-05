// PRIMEVAL art pass: Atari 2600. A 160×120 backbuffer scaled up with
// smoothing off gives huge chunky pixels; the palette deliberately clashes
// (hot magenta ferns, acid green pede, cyan hunter) the way 2600 games did.

import {
  PrimevalState, spiderPos, fernIdx,
  PW, PH, CELL, COLS, ROWS, CAMP_ROW, HUNTER_TOP,
} from './sim';

const BG = '#100800';
const CAMP = '#3c2000';
const FERN = '#e83cc8';
const FERN_HURT = '#8c2478';
const PEDE = '#58fc44';
const PEDE_EYE = '#104800';
const HUNTER = '#48f0fc';
const HUNTER_GHOST = '#2c7c84';
const SPEAR = '#fcf048';
const FLEA = '#fc8438';
const SPIDER = '#b468fc';
const CAMPFIRE = ['#fc4400', '#fc8438', '#fcf048'];
const BOOMS = ['#fcfcfc', '#fcf048', '#fc8438', '#fc4400'];

const FLEA_SPEED = 1.4;

let back: HTMLCanvasElement | null = null;

function backbuffer(): CanvasRenderingContext2D {
  if (!back) {
    back = document.createElement('canvas');
    back.width = PW;
    back.height = PH;
  }
  return back.getContext('2d')!;
}

export function primevalRender(main: CanvasRenderingContext2D, state: PrimevalState): void {
  const ctx = backbuffer();
  const t = state.tick;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, PW, PH);
  ctx.fillStyle = CAMP;
  ctx.fillRect(0, CAMP_ROW * CELL, PW, PH - CAMP_ROW * CELL);
  // Hunting-ground boundary flicker.
  ctx.fillStyle = '#241000';
  ctx.fillRect(0, HUNTER_TOP - 1, PW, 1);

  // Ferns: chunky fronds, hue shifts when damaged.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const hp = state.ferns[fernIdx(col, row)];
      if (hp <= 0) continue;
      const x = col * CELL, y = row * CELL;
      ctx.fillStyle = hp >= 2 ? FERN : FERN_HURT;
      ctx.fillRect(x + 1, y + 1, 6, 3);
      ctx.fillRect(x + 2, y, 4, 1);
      ctx.fillRect(x + 3, y + 4, 2, 3);
    }
  }

  // Camp: tribe hearts as little fires along the bottom.
  for (let i = 0; i < state.stats.tribeMaxHp; i++) {
    const x = 3 + i * 7;
    if (x > PW - 6) break;
    if (i < state.tribeHp) {
      ctx.fillStyle = CAMPFIRE[(Math.floor(t / 8) + i) % CAMPFIRE.length];
      ctx.fillRect(x, PH - 4, 3, 3);
      ctx.fillRect(x + 1, PH - 5, 1, 1);
    } else {
      ctx.fillStyle = '#402818';
      ctx.fillRect(x, PH - 3, 3, 2);
    }
  }

  // Megapede.
  for (const seg of state.segments) {
    if (!seg.alive) continue;
    const x = Math.round(seg.x), y = Math.round(seg.y);
    ctx.fillStyle = PEDE;
    ctx.fillRect(x - 3, y + 1, 7, 6);
    ctx.fillStyle = PEDE_EYE;
    ctx.fillRect(x + (seg.dir === 1 ? 1 : -2), y + 3, 2, 2);
  }

  // Fleas.
  for (const f of state.fleas) {
    if (!f.alive || f.born > t) continue;
    const y = Math.round((t - f.born) * FLEA_SPEED);
    ctx.fillStyle = FLEA;
    ctx.fillRect(Math.round(f.x) - 2, y - 2, 5, 4);
    ctx.fillRect(Math.round(f.x) - 3, y + 1, 7, 1);
  }

  // Spiders: fat body, flickering legs.
  for (const s of state.spiders) {
    if (!s.alive || s.born > t) continue;
    const pos = spiderPos(s, t);
    const x = Math.round(pos.x), y = Math.round(pos.y);
    ctx.fillStyle = SPIDER;
    ctx.fillRect(x - 3, y - 2, 6, 5);
    const spread = Math.floor(t / 6) % 2 === 0 ? 5 : 6;
    ctx.fillRect(x - spread, y, 2, 1);
    ctx.fillRect(x + spread - 1, y, 2, 1);
    ctx.fillRect(x - spread + 1, y - 3, 1, 2);
    ctx.fillRect(x + spread - 2, y - 3, 1, 2);
  }

  // Spears.
  for (const sp of state.spears) {
    if (!sp.alive) continue;
    ctx.fillStyle = sp.owner === 0 ? SPEAR : HUNTER_GHOST;
    ctx.fillRect(Math.round(sp.x), Math.round(sp.y) - 3, 1, 4);
  }

  // Hunters: live cyan, ancestors dim.
  state.players.forEach((h, pi) => {
    const ghost = pi > 0;
    const x = Math.round(h.x), y = Math.round(h.y);
    ctx.fillStyle = ghost ? HUNTER_GHOST : HUNTER;
    ctx.fillRect(x - 1, y - 4, 3, 3); // head
    ctx.fillRect(x - 2, y - 1, 5, 3); // body
    ctx.fillRect(x - 3, y + 2, 2, 2); // legs
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + 3, y - 4, 1, 5); // spear arm
  });

  // Kill flashes: expanding pixel diamonds.
  for (const bm of state.booms) {
    const age = t - bm.born;
    const r = 1 + Math.floor(age / 3);
    ctx.fillStyle = BOOMS[Math.min(BOOMS.length - 1, Math.floor(age / 4))];
    const x = Math.round(bm.x), y = Math.round(bm.y);
    ctx.fillRect(x - r, y, r * 2 + 1, 1);
    ctx.fillRect(x, y - r, 1, r * 2 + 1);
  }

  // Banners in the low-res buffer so the text is chunky too.
  ctx.textAlign = 'center';
  if (t < 140) {
    ctx.font = '8px monospace';
    ctx.fillStyle = FLEA;
    ctx.fillText('PRIMEVAL', PW / 2, 40);
    ctx.font = '5px monospace';
    ctx.fillStyle = HUNTER;
    ctx.fillText('SOMETHING LONG COMES DOWNHILL', PW / 2, 50);
  }
  if (state.banner && t < state.banner.until) {
    ctx.font = '7px monospace';
    ctx.fillStyle = SPEAR;
    ctx.fillText(state.banner.text, PW / 2, 30);
  }
  ctx.textAlign = 'left';

  // Fat-pixel upscale + shake.
  main.save();
  main.imageSmoothingEnabled = false;
  main.fillStyle = '#000';
  main.fillRect(0, 0, main.canvas.width, main.canvas.height);
  if (state.shake > 0)
    main.translate(Math.sin(t * 2.1) * state.shake * 0.5, Math.cos(t * 1.6) * state.shake * 0.4);
  main.drawImage(back!, 0, 0, PW, PH, 0, 0, main.canvas.width, main.canvas.height);
  main.restore();
}
