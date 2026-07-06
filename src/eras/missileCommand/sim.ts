// Era 1 — "DEFCON LOOP" (1983): Missile Command simulation.
//
// Determinism contract:
//  - Enemy waves are generated from a per-wave RNG derived only from
//    (era seed, wave index), at a fixed tick — player behavior can never
//    perturb the schedule.
//  - All projectile positions are pure functions of (spawn, target, born,
//    travel, tick): no incremental float drift.
//  - inputs[0] is the live player; inputs[1..] are echo replays. All player
//    instances share the same cities and fight the same missiles.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

export const W = 800;
export const H = 600;
export const GROUND = 552;
export const WAVE_TICKS = 540; // 9 seconds per wave at 60 Hz

export const CITY_X = [100, 180, 260, 540, 620, 700];
export const BATTERY_X = [400, 60, 740]; // in unlock order: center, left, right

export interface McStats {
  cooldown: number;         // ticks between shots per battery
  blastRadius: number;
  ammo: number;             // per battery, refilled each wave
  interceptorSpeed: number; // px per tick
  cityMaxHp: number;
  batteryCount: number;     // 1..3
  echoMult: number;         // echo blast radius as fraction of player's
  salvageMult: number;
}

export interface Missile {
  sx: number; sy: number;
  tx: number; ty: number;
  born: number; travel: number;
  alive: boolean;
  isChild: boolean;
  splitAt?: number;        // progress fraction where this MIRV splits
  splitTargets?: number[]; // target x of each child
}

export interface Interceptor {
  sx: number; sy: number;
  tx: number; ty: number;
  born: number; travel: number;
  owner: number; // player instance index (0 = live)
  alive: boolean;
}

export interface Explosion {
  x: number; y: number;
  born: number;
  owner: number; // instance index, or -1 for enemy ground impact
  maxR: number;
}

export interface Battery {
  x: number;
  ammo: number;
  readyAt: number;
}

export interface City {
  x: number;
  hp: number;
}

export interface McState {
  seed: number;
  tick: number;
  wave: number; // 1-based, current wave number
  stats: McStats;
  cities: City[];
  missiles: Missile[];
  interceptors: Interceptor[];
  explosions: Explosion[];
  players: { batteries: Battery[] }[];
  kills: number;
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export function mcInit(seed: number, stats: McStats, playerCount: number): McState {
  return {
    seed,
    tick: 0,
    wave: 0,
    stats,
    cities: CITY_X.map((x) => ({ x, hp: stats.cityMaxHp })),
    missiles: [],
    interceptors: [],
    explosions: [],
    players: Array.from({ length: playerCount }, () => ({
      batteries: BATTERY_X.slice(0, stats.batteryCount).map((x) => ({
        x,
        ammo: stats.ammo,
        readyAt: 0,
      })),
    })),
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
}

/** Position of a projectile as a pure function of the current tick. */
export function projPos(
  p: { sx: number; sy: number; tx: number; ty: number; born: number; travel: number },
  tick: number,
): { x: number; y: number; f: number } {
  const f = Math.min(1, Math.max(0, (tick - p.born) / p.travel));
  return { x: p.sx + (p.tx - p.sx) * f, y: p.sy + (p.ty - p.sy) * f, f };
}

const GROW = 24, HOLD = 18, FADE = 18;
export const EXPLOSION_LIFE = GROW + HOLD + FADE;

export function explosionRadius(e: Explosion, tick: number): number {
  const a = tick - e.born;
  if (a < 0 || a >= EXPLOSION_LIFE) return 0;
  if (a < GROW) return e.maxR * (a / GROW);
  if (a < GROW + HOLD) return e.maxR;
  return e.maxR * (1 - (a - GROW - HOLD) / FADE);
}

/** Number of top-level enemy missiles in wave k (0-based). */
function waveCount(k: number): number {
  return Math.min(60, 4 + Math.floor(k * 2.2));
}

function spawnWave(state: McState, k: number): void {
  // Independent RNG per wave: schedule depends only on (seed, k).
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0);
  const count = waveCount(k);
  const travel = Math.max(260, 700 - k * 45);
  const start = k * WAVE_TICKS;

  for (let i = 0; i < count; i++) {
    const born = start + Math.floor(rng() * WAVE_TICKS * 0.75);
    const sx = 20 + rng() * (W - 40);
    const targetIdx = Math.floor(rng() * (CITY_X.length + BATTERY_X.length));
    const baseTx =
      targetIdx < CITY_X.length ? CITY_X[targetIdx] : BATTERY_X[targetIdx - CITY_X.length];
    const tx = baseTx + (rng() - 0.5) * 30;

    const m: Missile = {
      sx, sy: -10, tx, ty: GROUND,
      born, travel,
      alive: true,
      isChild: false,
    };
    // MIRVs appear from wave 4 on.
    if (k >= 3 && rng() < Math.min(0.6, 0.15 + k * 0.04)) {
      m.splitAt = 0.25 + rng() * 0.35;
      m.splitTargets = [0, 1].map(() => {
        const ti = Math.floor(rng() * CITY_X.length);
        return CITY_X[ti] + (rng() - 0.5) * 30;
      });
    }
    state.missiles.push(m);
  }
}

function fire(state: McState, playerIdx: number, ev: InputEvent): void {
  const t = state.tick;
  const ty = Math.min(ev.y, GROUND - 40);
  const tx = ev.x;
  const bats = state.players[playerIdx].batteries.filter(
    (b) => b.ammo > 0 && b.readyAt <= t,
  );
  if (bats.length === 0) return;
  let best = bats[0];
  for (const b of bats) if (Math.abs(b.x - tx) < Math.abs(best.x - tx)) best = b;

  best.ammo--;
  best.readyAt = t + state.stats.cooldown;
  const sx = best.x;
  const sy = GROUND - 14;
  const dist = Math.hypot(tx - sx, ty - sy);
  state.interceptors.push({
    sx, sy, tx, ty,
    born: t,
    travel: Math.max(1, Math.round(dist / state.stats.interceptorSpeed)),
    owner: playerIdx,
    alive: true,
  });
}

/** Advance one tick. inputs[i] = events for player instance i at this tick. */
export function mcStep(state: McState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  // Fixed-schedule wave starts: independent of all player state.
  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    for (const p of state.players)
      for (const b of p.batteries) b.ammo = stats.ammo;
    state.banner = { text: `WAVE ${k + 1}`, until: t + 120 };
  }

  // Player + echo fire orders.
  for (let pi = 0; pi < inputs.length; pi++)
    for (const ev of inputs[pi]) fire(state, pi, ev);

  // Interceptors detonate on arrival.
  for (const ic of state.interceptors) {
    if (!ic.alive) continue;
    if (t - ic.born >= ic.travel) {
      ic.alive = false;
      state.explosions.push({
        x: ic.tx, y: ic.ty,
        born: t,
        owner: ic.owner,
        maxR: ic.owner === 0 ? stats.blastRadius : stats.blastRadius * stats.echoMult,
      });
    }
  }

  // Enemy missiles: split, impact, or die to explosions.
  const newChildren: Missile[] = [];
  for (const m of state.missiles) {
    if (!m.alive) continue;
    const pos = projPos(m, t);

    if (m.splitAt !== undefined && pos.f >= m.splitAt && m.splitTargets) {
      const remaining = Math.max(200, Math.round((1 - pos.f) * m.travel * 1.15));
      for (const ctx of m.splitTargets) {
        newChildren.push({
          sx: pos.x, sy: pos.y,
          tx: ctx, ty: GROUND,
          born: t, travel: remaining,
          alive: true,
          isChild: true,
        });
      }
      m.splitAt = undefined;
    }

    if (pos.f >= 1) {
      m.alive = false;
      state.explosions.push({ x: m.tx, y: GROUND, born: t, owner: -1, maxR: 20 });
      const city = state.cities.find((c) => c.hp > 0 && Math.abs(c.x - m.tx) <= 30);
      if (city) {
        city.hp--;
        state.shake = 16;
      }
      continue;
    }

    for (const e of state.explosions) {
      if (e.owner < 0) continue; // enemy impacts don't chain in the slice
      const r = explosionRadius(e, t);
      if (r <= 0) continue;
      if (Math.hypot(pos.x - e.x, pos.y - e.y) < r + 4) {
        m.alive = false;
        state.kills++;
        state.salvage += stats.salvageMult;
        break;
      }
    }
  }
  state.missiles.push(...newChildren);

  // Prune expired visuals/projectiles (dead missiles kept for spawn-log tests).
  state.explosions = state.explosions.filter((e) => t - e.born < EXPLOSION_LIFE);
  state.interceptors = state.interceptors.filter((ic) => ic.alive || t - ic.born < 30);

  if (state.shake > 0) state.shake--;

  if (state.cities.every((c) => c.hp <= 0)) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export interface RunSummary {
  wave: number;
  ticks: number;
  kills: number;
  salvage: number;
}

export function mcSummary(state: McState): RunSummary {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
