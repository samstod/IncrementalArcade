// Era 5 — "PRIMEVAL" (Prehistory): Centipede in the fern jungle.
//
// A megapede winds down through a field of ferns — step, hit a fern or the
// edge, drop a row, reverse. Every segment killed plants a fern where it
// died and splits the pede. Fleas fall and seed new ferns; a spider zigzags
// through the hunting ground eating ferns and biting hunters. Your
// spear-hunter roams the lower rows (both axes!) hurling spears upward.
// Segments that reach the camp row burrow in and hurt the tribe.
//
// Determinism contract: pede waves, flea drops (and what they plant), and
// spider paths derive only from (seed, wave) at fixed ticks. Pede routing
// reacts to the fern layout, which reflects kills — defense-outcome
// divergence, same as the Invaders accelerando.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

// Atari 2600-ish playfield: fat pixels on a 160×120 buffer, 8px cells.
export const PW = 160;
export const PH = 120;
export const CELL = 8;
export const COLS = PW / CELL;  // 20
export const ROWS = PH / CELL;  // 15
export const CAMP_ROW = 14;     // segments burrowing here hurt the tribe
export const HUNTER_TOP = 88;   // hunter roams rows 11–14
export const WAVE_TICKS = 660;  // 11s per wave
export const SPEAR_SPEED_BASE = 3;

export interface PrimevalStats {
  maxSpears: number;    // spears one hunter may have in flight
  spearSpeed: number;
  spearDamage: number;  // matters vs fleas (2hp) and spiders (3hp)
  fernDamage: number;   // 2 = one-shot ferns
  tribeMaxHp: number;
  hunterSpeed: number;
  echoMult: number;
  salvageMult: number;
}

export interface Segment {
  x: number; y: number;
  dir: 1 | -1;
  dropping: number; // px of descent left
  alive: boolean;
}

export interface Flea {
  x: number; born: number;
  plantRows: number[]; // rows where it seeds ferns (decided at spawn)
  planted: number;     // how many of those rows are done
  hp: number;
  alive: boolean;
}

export interface Spider {
  born: number;
  x0: number; vx: number; vy: number;
  life: number;
  hp: number;
  alive: boolean;
}

export interface Spear {
  x: number; y: number;
  owner: number;
  alive: boolean;
}

export interface Boom {
  x: number; y: number; born: number;
  owner: number;
}

export interface Hunter {
  x: number; y: number;
  tx: number; ty: number;
}

export interface PrimevalState {
  seed: number;
  tick: number;
  wave: number;
  stats: PrimevalStats;
  ferns: number[]; // hp per cell, index = row * COLS + col (0 = empty)
  segments: Segment[];
  fleas: Flea[];
  spiders: Spider[];
  spears: Spear[];
  booms: Boom[];
  players: Hunter[];
  tribeHp: number;
  kills: number;
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export const BOOM_LIFE = 14;
const FLEA_SPEED = 1.4;

export function fernIdx(col: number, row: number): number {
  return row * COLS + col;
}

export function primevalInit(seed: number, stats: PrimevalStats, playerCount: number): PrimevalState {
  const ferns = new Array<number>(COLS * ROWS).fill(0);
  const rng = mulberry32(seed >>> 0);
  // Scatter the initial fern field (never in the camp rows).
  for (let i = 0; i < 34; i++) {
    const col = Math.floor(rng() * COLS);
    const row = 1 + Math.floor(rng() * (CAMP_ROW - 4));
    ferns[fernIdx(col, row)] = 2;
  }
  return {
    seed,
    tick: 0,
    wave: 0,
    stats,
    ferns,
    segments: [],
    fleas: [],
    spiders: [],
    spears: [],
    booms: [],
    players: Array.from({ length: playerCount }, () => ({
      x: PW / 2, y: PH - 12, tx: PW / 2, ty: PH - 12,
    })),
    tribeHp: stats.tribeMaxHp,
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
}

function pedeSpeed(k: number): number {
  return Math.min(2.4, 0.8 + 0.07 * k);
}

function spawnPede(state: PrimevalState, len: number, dir: 1 | -1, startRow: number): void {
  const startX = dir === 1 ? -4 : PW + 4;
  for (let i = 0; i < len; i++) {
    state.segments.push({
      x: startX - dir * i * CELL,
      y: startRow * CELL,
      dir,
      dropping: 0,
      alive: true,
    });
  }
}

function spawnWave(state: PrimevalState, k: number): void {
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0x94d049bb)) >>> 0);
  const len = Math.min(24, 8 + Math.floor(k * 0.9));
  const dir: 1 | -1 = rng() < 0.5 ? 1 : -1;
  spawnPede(state, len, dir, 0);
  // Deep hunts bring a second, shorter pede in from the far side.
  if (k >= 8) spawnPede(state, Math.floor(len / 2), (dir === 1 ? -1 : 1) as 1 | -1, 1);

  const start = k * WAVE_TICKS;
  // Fleas: seeded drops that replant the field.
  const fleaCount = Math.min(9, 1 + Math.floor(k / 2));
  for (let i = 0; i < fleaCount; i++) {
    const plantRows: number[] = [];
    for (let r = 1; r < CAMP_ROW - 2; r++) if (rng() < 0.3) plantRows.push(r);
    state.fleas.push({
      x: CELL / 2 + Math.floor(rng() * COLS) * CELL,
      born: start + 120 + Math.floor(rng() * (WAVE_TICKS - 180)),
      plantRows,
      planted: 0,
      hp: 2,
      alive: true,
    });
  }
  // Spiders: one prowler from wave 2, another every fifth hunt after.
  const spiderCount = k >= 1 ? 1 + Math.floor(k / 5) : 0;
  for (let i = 0; i < spiderCount; i++) {
    state.spiders.push({
      born: start + 150 + Math.floor(rng() * 300),
      x0: rng() < 0.5 ? 0 : PW,
      vx: (0.5 + rng() * 0.4) * (rng() < 0.5 ? 1 : -1),
      vy: 0.35 + rng() * 0.3,
      life: 700,
      hp: 3 + Math.floor(k / 6),
      alive: true,
    });
  }
}

function tri(v: number, range: number): number {
  const m = ((v % (2 * range)) + 2 * range) % (2 * range);
  return m < range ? m : 2 * range - m;
}

export function spiderPos(s: Spider, tick: number): { x: number; y: number } {
  const dt = tick - s.born;
  return {
    x: tri(s.x0 + s.vx * dt, PW - 8) + 4,
    y: HUNTER_TOP - 24 + tri(s.vy * dt, 44),
  };
}

function plantFern(state: PrimevalState, col: number, row: number, hp: number): void {
  if (col < 0 || col >= COLS || row < 0 || row >= CAMP_ROW - 1) return;
  const i = fernIdx(col, row);
  if (state.ferns[i] <= 0) state.ferns[i] = hp;
}

export function primevalStep(state: PrimevalState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    state.banner = { text: `HUNT ${k + 1}`, until: t + 110 };
  }

  // Hunters roam the lower rows on both axes.
  for (let pi = 0; pi < inputs.length; pi++) {
    const evs = inputs[pi];
    if (evs.length > 0) {
      const ev = evs[evs.length - 1];
      state.players[pi].tx = ev.x;
      state.players[pi].ty = ev.y;
    }
  }
  for (let pi = 0; pi < state.players.length; pi++) {
    const h = state.players[pi];
    const dx = h.tx - h.x, dy = h.ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const step = Math.min(d, stats.hunterSpeed);
      h.x += (dx / d) * step;
      h.y += (dy / d) * step;
    }
    h.x = Math.min(PW - 5, Math.max(5, h.x));
    h.y = Math.min(PH - 5, Math.max(HUNTER_TOP, h.y));
    // Autothrow whenever a spear slot is free.
    const inFlight = state.spears.filter((s) => s.alive && s.owner === pi).length;
    if (inFlight < stats.maxSpears)
      state.spears.push({ x: h.x, y: h.y - 5, owner: pi, alive: true });
  }

  // Megapede routing.
  const speed = pedeSpeed(state.wave - 1);
  for (const seg of state.segments) {
    if (!seg.alive) continue;
    if (seg.dropping > 0) {
      const d = Math.min(1, seg.dropping);
      seg.y += d;
      seg.dropping -= d;
      continue;
    }
    const nx = seg.x + seg.dir * speed;
    const row = Math.floor(seg.y / CELL);
    const aheadCol = Math.floor((nx + seg.dir * (CELL / 2)) / CELL);
    const curCol = Math.floor(seg.x / CELL);
    if (aheadCol !== curCol) {
      // Only the edge being marched TOWARD blocks — segments walking in
      // from their off-screen spawn must not bounce off the world border.
      const blocked =
        (aheadCol < 0 && seg.dir === -1) ||
        (aheadCol >= COLS && seg.dir === 1) ||
        (aheadCol >= 0 && aheadCol < COLS && state.ferns[fernIdx(aheadCol, row)] > 0);
      if (blocked) {
        seg.dir = (seg.dir === 1 ? -1 : 1) as 1 | -1;
        seg.dropping = CELL;
        continue;
      }
    }
    seg.x = nx;
    // Burrowing into camp.
    if (Math.floor(seg.y / CELL) >= CAMP_ROW) {
      seg.alive = false;
      state.tribeHp--;
      state.shake = 10;
      state.booms.push({ x: seg.x, y: seg.y, born: t, owner: -1 });
    }
  }

  // Fleas fall, planting ferns down their column.
  for (const f of state.fleas) {
    if (!f.alive || f.born > t) continue;
    const y = (t - f.born) * FLEA_SPEED;
    while (f.planted < f.plantRows.length && y >= f.plantRows[f.planted] * CELL) {
      plantFern(state, Math.floor(f.x / CELL), f.plantRows[f.planted], 2);
      f.planted++;
    }
    if (y > PH + 4) f.alive = false;
  }

  // Spiders prowl and eat the field.
  for (const s of state.spiders) {
    if (!s.alive || s.born > t) continue;
    if (t - s.born > s.life) {
      s.alive = false;
      continue;
    }
    const pos = spiderPos(s, t);
    const i = fernIdx(Math.floor(pos.x / CELL), Math.floor(pos.y / CELL));
    if (state.ferns[i] > 0) state.ferns[i] = 0;
    const live = state.players[0];
    if (Math.abs(pos.x - live.x) < 6 && Math.abs(pos.y - live.y) < 6) {
      s.alive = false;
      state.tribeHp--;
      state.shake = 12;
      state.booms.push({ x: pos.x, y: pos.y, born: t, owner: -1 });
    }
  }

  // Spears climb.
  for (const sp of state.spears) {
    if (!sp.alive) continue;
    sp.y -= stats.spearSpeed;
    if (sp.y < -4) {
      sp.alive = false;
      continue;
    }
    const dmg = sp.owner === 0 ? stats.spearDamage : Math.max(1, Math.round(stats.spearDamage * stats.echoMult));

    // Ferns block spears.
    const col = Math.floor(sp.x / CELL);
    const row = Math.floor(sp.y / CELL);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      const i = fernIdx(col, row);
      if (state.ferns[i] > 0) {
        state.ferns[i] = Math.max(0, state.ferns[i] - stats.fernDamage);
        sp.alive = false;
        continue;
      }
    }

    // Segments: one hit kills, plants a fern, splits the pede.
    let hit = false;
    for (const seg of state.segments) {
      if (!seg.alive) continue;
      if (Math.abs(seg.x - sp.x) < 5 && Math.abs(seg.y + CELL / 2 - sp.y) < 5) {
        seg.alive = false;
        sp.alive = false;
        hit = true;
        state.kills++;
        state.salvage += stats.salvageMult;
        plantFern(state, Math.floor(seg.x / CELL), Math.floor(seg.y / CELL), 2);
        state.booms.push({ x: seg.x, y: seg.y + CELL / 2, born: t, owner: sp.owner });
        break;
      }
    }
    if (hit || !sp.alive) continue;

    for (const f of state.fleas) {
      if (!f.alive || f.born > t) continue;
      const fy = (t - f.born) * FLEA_SPEED;
      if (Math.abs(f.x - sp.x) < 5 && Math.abs(fy - sp.y) < 5) {
        f.hp -= dmg;
        sp.alive = false;
        if (f.hp <= 0) {
          f.alive = false;
          state.kills++;
          state.salvage += 1.5 * stats.salvageMult;
          state.booms.push({ x: f.x, y: fy, born: t, owner: sp.owner });
        }
        break;
      }
    }
    if (!sp.alive) continue;

    for (const s of state.spiders) {
      if (!s.alive || s.born > t) continue;
      const pos = spiderPos(s, t);
      if (Math.abs(pos.x - sp.x) < 6 && Math.abs(pos.y - sp.y) < 6) {
        s.hp -= dmg;
        sp.alive = false;
        if (s.hp <= 0) {
          s.alive = false;
          state.kills++;
          state.salvage += 3 * stats.salvageMult;
          state.booms.push({ x: pos.x, y: pos.y, born: t, owner: sp.owner });
        }
        break;
      }
    }
  }

  state.spears = state.spears.filter((s) => s.alive);
  state.booms = state.booms.filter((b) => t - b.born < BOOM_LIFE);

  if (state.shake > 0) state.shake--;

  if (state.tribeHp <= 0) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export function primevalSummary(state: PrimevalState) {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
