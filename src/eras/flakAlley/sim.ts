// Era 2 — "FLAK ALLEY" (1944): Galaga/1942-style fixed shooter.
//
// You are an AA gun on a carrier deck. Dive-bomber formations weave down;
// planes that reach the deck crash into the carrier, and bombs dropped
// mid-dive fall straight down. The gun steers toward the pointer and fires
// automatically — recordings are just target-x events, so echo gunners sweep
// their remembered arcs.
//
// Same determinism contract as every era: per-wave RNG derived only from
// (seed, wave), spawned at a fixed tick; plane positions are pure functions
// of (params, tick). Bombs drop only from planes still alive at the drop
// tick — like Era 1's MIRV children, defense outcomes may diverge, the
// schedule never does.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

// Low-res NES-style world; the renderer upscales with smoothing off.
export const FW = 256;
export const FH = 192;
export const DECK_Y = 172;
export const WAVE_TICKS = 480; // 8 seconds per wave

export interface FlakStats {
  cooldown: number;      // ticks between auto-shots
  shellSpeed: number;    // px per tick (low-res space)
  damage: number;
  burstRadius: number;   // proximity-fuze AoE; 0 = direct hits only
  carrierMaxHp: number;
  barrels: number;       // 1..3 parallel shells per shot
  echoMult: number;      // echo damage as fraction of player's
  salvageMult: number;
}

export interface Plane {
  born: number;
  x0: number; amp: number; freq: number; phase: number; drift: number;
  vy: number;
  diveAt: number;   // ticks after born when the dive begins
  diveMult: number; // vertical speed multiplier during dive
  bomber: boolean;
  bombTicks: number[]; // ticks-after-born when a bomb drops (if alive)
  hp: number; maxHp: number;
  alive: boolean;
}

export interface Shell {
  x: number; y0: number; born: number;
  owner: number;
  alive: boolean;
}

export interface Bomb {
  x: number; y0: number; born: number;
  alive: boolean;
}

export interface Boom {
  x: number; y: number; born: number;
  owner: number; // -1 enemy, else player instance
  big: boolean;
}

export interface FlakState {
  seed: number;
  tick: number;
  wave: number;
  stats: FlakStats;
  players: { x: number; tx: number; lastShot: number }[];
  planes: Plane[];
  shells: Shell[];
  bombs: Bomb[];
  booms: Boom[];
  carrierHp: number;
  kills: number;
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export function flakInit(seed: number, stats: FlakStats, playerCount: number): FlakState {
  return {
    seed,
    tick: 0,
    wave: 0,
    stats,
    players: Array.from({ length: playerCount }, () => ({
      x: FW / 2, tx: FW / 2, lastShot: -9999,
    })),
    planes: [],
    shells: [],
    bombs: [],
    booms: [],
    carrierHp: stats.carrierMaxHp,
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
}

export function planePos(p: Plane, tick: number): { x: number; y: number } {
  const dt = tick - p.born;
  const x = Math.min(FW - 8, Math.max(8, p.x0 + p.amp * Math.sin(p.freq * dt + p.phase) + p.drift * dt));
  const y =
    dt < p.diveAt
      ? -6 + p.vy * dt
      : -6 + p.vy * p.diveAt + p.vy * p.diveMult * (dt - p.diveAt);
  return { x, y };
}

export function shellPos(s: Shell, tick: number, speed: number): number {
  return s.y0 - speed * (tick - s.born);
}

const BOMB_SPEED = 1.0;
export function bombY(b: Bomb, tick: number): number {
  return b.y0 + BOMB_SPEED * (tick - b.born);
}

export const BOOM_LIFE = 20;

function planesInWave(k: number): number {
  return Math.min(45, 5 + Math.floor(k * 1.8));
}

function spawnWave(state: FlakState, k: number): void {
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0);
  const count = planesInWave(k);
  const start = k * WAVE_TICKS;
  const travel = Math.max(240, 640 - k * 25);
  const vy = (DECK_Y + 12) / travel;

  for (let i = 0; i < count; i++) {
    const bomber = k >= 2 && i % 4 === 3;
    const born = start + Math.floor(rng() * WAVE_TICKS * 0.7);
    const diveAt = Math.floor(travel * (0.4 + rng() * 0.4));
    const bombTicks: number[] = [];
    if (k >= 1) {
      const n = bomber ? 2 : rng() < 0.5 ? 1 : 0;
      for (let b = 0; b < n; b++) bombTicks.push(Math.floor(travel * (0.2 + rng() * 0.55)));
    }
    state.planes.push({
      born,
      x0: 12 + rng() * (FW - 24),
      amp: 10 + rng() * 30,
      freq: 0.01 + rng() * 0.03,
      phase: rng() * Math.PI * 2,
      drift: (rng() - 0.5) * 0.05,
      vy,
      diveAt,
      diveMult: 2.5,
      bomber,
      bombTicks,
      hp: bomber ? 3 + Math.floor(k / 5) : 1 + Math.floor(k / 8),
      maxHp: bomber ? 3 + Math.floor(k / 5) : 1 + Math.floor(k / 8),
      alive: true,
    });
  }
}

const GUN_SPEED = 2.5;

function barrelOffsets(barrels: number): number[] {
  if (barrels >= 3) return [-4, 0, 4];
  if (barrels === 2) return [-3, 3];
  return [0];
}

function damagePlane(state: FlakState, p: Plane, dmg: number, x: number, y: number, owner: number): void {
  p.hp -= dmg;
  if (p.hp <= 0 && p.alive) {
    p.alive = false;
    state.kills++;
    state.salvage += state.stats.salvageMult * (p.bomber ? 3 : 1);
    state.booms.push({ x, y, born: state.tick, owner, big: p.bomber });
  }
}

export function flakStep(state: FlakState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  // Fixed-schedule waves.
  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    state.banner = { text: `WAVE ${k + 1}`, until: t + 100 };
  }

  // Steering orders (last event this tick wins), then move + autofire.
  for (let pi = 0; pi < inputs.length; pi++) {
    const evs = inputs[pi];
    if (evs.length > 0) state.players[pi].tx = evs[evs.length - 1].x;
  }
  for (let pi = 0; pi < state.players.length; pi++) {
    const g = state.players[pi];
    const d = g.tx - g.x;
    g.x += Math.abs(d) <= GUN_SPEED ? d : Math.sign(d) * GUN_SPEED;
    g.x = Math.min(FW - 10, Math.max(10, g.x));
    if (t - g.lastShot >= stats.cooldown) {
      g.lastShot = t;
      for (const off of barrelOffsets(stats.barrels))
        state.shells.push({ x: g.x + off, y0: DECK_Y - 10, born: t, owner: pi, alive: true });
    }
  }

  // Planes: crash into the deck, drop scheduled bombs.
  for (const p of state.planes) {
    if (!p.alive) continue;
    const pos = planePos(p, t);
    if (pos.y >= DECK_Y) {
      p.alive = false;
      state.carrierHp -= p.bomber ? 2 : 1;
      state.shake = 14;
      state.booms.push({ x: pos.x, y: DECK_Y - 4, born: t, owner: -1, big: true });
      continue;
    }
    const dt = t - p.born;
    for (const bt of p.bombTicks) {
      if (dt === bt) state.bombs.push({ x: pos.x, y0: pos.y, born: t, alive: true });
    }
  }

  // Bombs fall; deck hits hurt the carrier.
  for (const b of state.bombs) {
    if (!b.alive) continue;
    if (bombY(b, t) >= DECK_Y) {
      b.alive = false;
      state.carrierHp -= 1;
      state.shake = 10;
      state.booms.push({ x: b.x, y: DECK_Y - 3, born: t, owner: -1, big: false });
    }
  }

  // Shells vs planes and bombs.
  for (const s of state.shells) {
    if (!s.alive) continue;
    const sy = shellPos(s, t, stats.shellSpeed);
    if (sy < -4) {
      s.alive = false;
      continue;
    }
    const dmg = s.owner === 0 ? stats.damage : stats.damage * stats.echoMult;

    for (const b of state.bombs) {
      if (!b.alive) continue;
      const by = bombY(b, t);
      if (Math.abs(s.x - b.x) <= 3 && Math.abs(sy - by) <= 3) {
        b.alive = false;
        s.alive = false;
        state.salvage += 0.2 * stats.salvageMult;
        state.booms.push({ x: b.x, y: by, born: t, owner: s.owner, big: false });
        break;
      }
    }
    if (!s.alive) continue;

    for (const p of state.planes) {
      if (!p.alive) continue;
      const pos = planePos(p, t);
      const hw = p.bomber ? 6 : 4;
      if (Math.abs(s.x - pos.x) <= hw && Math.abs(sy - pos.y) <= 4) {
        s.alive = false;
        damagePlane(state, p, dmg, pos.x, pos.y, s.owner);
        if (stats.burstRadius > 0) {
          state.booms.push({ x: pos.x, y: pos.y, born: t, owner: s.owner, big: false });
          for (const q of state.planes) {
            if (!q.alive || q === p) continue;
            const qp = planePos(q, t);
            if (Math.hypot(qp.x - pos.x, qp.y - pos.y) <= stats.burstRadius)
              damagePlane(state, q, dmg * 0.5, qp.x, qp.y, s.owner);
          }
        }
        break;
      }
    }
  }

  // Prune transient objects (dead planes are kept: they're the spawn log).
  state.shells = state.shells.filter((s) => s.alive);
  state.bombs = state.bombs.filter((b) => b.alive);
  state.booms = state.booms.filter((b) => t - b.born < BOOM_LIFE);

  if (state.shake > 0) state.shake--;

  if (state.carrierHp <= 0) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export function flakSummary(state: FlakState) {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
