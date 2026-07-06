// Era 6 — "DEBRIS FIELD" (2286): Asteroids inside a dead fleet.
//
// The colony ship at the center is all that's left. Wrecked hulks drift in
// from the rim on seeded vectors, split when shattered, and grind the
// colony down on contact. Your fighter has real inertia: its nose chases
// the pointer, it thrusts while far from it, and it autofires straight
// ahead — aiming IS flying. Echo fighters fly their recorded sorties.
//
// Determinism contract: wave rosters (spawn tick, rim position, velocity,
// silhouette) derive only from (seed, wave). Split-fragment properties
// derive from the parent hulk's id — pure functions, no shared RNG stream —
// so kills diverge outcomes but never the schedule.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

export const DW = 800;
export const DH = 600;
export const CX = DW / 2;
export const CY = DH / 2;
export const COLONY_R = 36;
export const WAVE_TICKS = 780; // 13s per wave
export const BULLET_SPEED = 6;
export const BULLET_TTL = 80;
export const SHIP_RESPAWN = 180;
export const SHIP_INVULN = 120;

export type HulkSize = 2 | 1 | 0; // large, medium, small

export const HULK_RADIUS: Record<HulkSize, number> = { 2: 26, 1: 16, 0: 9 };
const HULK_BASE_HP: Record<HulkSize, number> = { 2: 3, 1: 2, 0: 1 };
const HULK_DAMAGE: Record<HulkSize, number> = { 2: 3, 1: 2, 0: 1 };
const HULK_SALVAGE: Record<HulkSize, number> = { 2: 3, 1: 2, 0: 1 };

export interface DebrisStats {
  cooldown: number;      // ticks between shots
  damage: number;
  streams: number;       // parallel bullet streams (SALVO)
  thrust: number;        // acceleration per tick
  turnRate: number;      // radians per tick
  colonyMaxHp: number;
  regen: number;         // colony HP recovered at each wave start
  echoMult: number;
  salvageMult: number;
}

export interface Hulk {
  id: number;
  size: HulkSize;
  wave: number; // wave it (or its ancestor) spawned in — scales hp
  x: number; y: number;
  vx: number; vy: number;
  spin: number;
  born: number;
  verts: number[]; // radius multipliers around the silhouette
  hp: number;
  maxHp: number;
  isChild: boolean;
  alive: boolean;
}

export interface Bullet {
  x: number; y: number;
  vx: number; vy: number;
  born: number;
  owner: number;
  alive: boolean;
}

export interface Ship {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  tx: number; ty: number;
  lastShot: number;
  dead: boolean;
  respawnAt: number;
  invulnUntil: number;
}

export interface Boom {
  x: number; y: number; born: number;
  owner: number; // -1 enemy/colony hit
  big: boolean;
}

export interface DebrisState {
  seed: number;
  tick: number;
  wave: number;
  stats: DebrisStats;
  players: Ship[];
  hulks: Hulk[];
  bullets: Bullet[];
  booms: Boom[];
  nextHulkId: number;
  colonyHp: number;
  colonyHitAt: number;
  kills: number;
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export const BOOM_LIFE = 26;

function makeVerts(rng: () => number): number[] {
  const n = 9;
  const verts: number[] = [];
  for (let i = 0; i < n; i++) verts.push(0.65 + rng() * 0.45);
  return verts;
}

function newShip(idx: number): Ship {
  const a = (idx * Math.PI * 2) / 3 + Math.PI / 4;
  return {
    x: CX + Math.cos(a) * (COLONY_R + 24),
    y: CY + Math.sin(a) * (COLONY_R + 24),
    vx: 0, vy: 0,
    angle: a,
    tx: CX, ty: CY - 140,
    lastShot: -9999,
    dead: false,
    respawnAt: -1,
    invulnUntil: 0,
  };
}

export function debrisInit(seed: number, stats: DebrisStats, playerCount: number): DebrisState {
  return {
    seed,
    tick: 0,
    wave: 0,
    stats,
    players: Array.from({ length: playerCount }, (_, i) => newShip(i)),
    hulks: [],
    bullets: [],
    booms: [],
    nextHulkId: 1,
    colonyHp: stats.colonyMaxHp,
    colonyHitAt: -9999,
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
}

function hulkHp(size: HulkSize, wave: number): number {
  return HULK_BASE_HP[size] + Math.floor(wave / 4);
}

function spawnWave(state: DebrisState, k: number): void {
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
  const count = Math.min(26, 3 + Math.floor(k * 1.3));
  const start = k * WAVE_TICKS;
  for (let i = 0; i < count; i++) {
    const rimA = rng() * Math.PI * 2;
    const x = CX + Math.cos(rimA) * 430;
    const y = CY + Math.sin(rimA) * 330;
    const speed = Math.min(1.7, 0.45 + 0.06 * k) * (0.7 + rng() * 0.6);
    const aim = Math.atan2(CY - y, CX - x) + (rng() - 0.5) * 1.2;
    state.hulks.push({
      id: state.nextHulkId++,
      size: 2,
      wave: k,
      x, y,
      vx: Math.cos(aim) * speed,
      vy: Math.sin(aim) * speed,
      spin: (rng() - 0.5) * 0.04,
      born: start + Math.floor(rng() * WAVE_TICKS * 0.5),
      verts: makeVerts(rng),
      hp: hulkHp(2, k),
      maxHp: hulkHp(2, k),
      isChild: false,
      alive: true,
    });
  }
}

/** Fragment properties are a pure function of the parent id — no shared RNG. */
function splitHulk(state: DebrisState, parent: Hulk, awayFromColony: boolean): void {
  if (parent.size === 0) return;
  const childSize = (parent.size - 1) as HulkSize;
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32((state.seed ^ Math.imul(parent.id, 0x85ebca6b) ^ Math.imul(c + 1, 0xc2b2ae35)) >>> 0);
    let dir: number;
    if (awayFromColony) {
      dir = Math.atan2(parent.y - CY, parent.x - CX) + (rng() - 0.5) * 1.6;
    } else {
      dir = Math.atan2(parent.vy, parent.vx) + (c === 0 ? 1 : -1) * (0.5 + rng() * 0.7);
    }
    const speed = Math.hypot(parent.vx, parent.vy) * (0.9 + rng() * 0.5) + 0.2;
    state.hulks.push({
      id: state.nextHulkId++,
      size: childSize,
      wave: parent.wave,
      x: parent.x, y: parent.y,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      spin: (rng() - 0.5) * 0.07,
      born: state.tick,
      verts: makeVerts(rng),
      hp: hulkHp(childSize, parent.wave),
      maxHp: hulkHp(childSize, parent.wave),
      isChild: true,
      alive: true,
    });
  }
}

function killHulk(state: DebrisState, h: Hulk, owner: number): void {
  h.alive = false;
  state.kills++;
  state.salvage += HULK_SALVAGE[h.size] * state.stats.salvageMult;
  state.booms.push({ x: h.x, y: h.y, born: state.tick, owner, big: h.size === 2 });
  splitHulk(state, h, false);
}

function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}

const SPEED_CAP = 3.6;

export function debrisStep(state: DebrisState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    state.colonyHp = Math.min(stats.colonyMaxHp, state.colonyHp + stats.regen);
    state.banner = { text: `DRIFT ${k + 1}`, until: t + 110 };
  }

  // Steering orders.
  for (let pi = 0; pi < inputs.length; pi++) {
    const evs = inputs[pi];
    if (evs.length > 0) {
      const ev = evs[evs.length - 1];
      state.players[pi].tx = ev.x;
      state.players[pi].ty = ev.y;
    }
  }

  // Fighters: rotate toward the pointer, thrust while far, autofire ahead.
  for (let pi = 0; pi < state.players.length; pi++) {
    const s = state.players[pi];
    if (s.dead) {
      if (s.respawnAt >= 0 && t >= s.respawnAt) {
        const fresh = newShip(pi);
        fresh.tx = s.tx;
        fresh.ty = s.ty;
        fresh.invulnUntil = t + SHIP_INVULN;
        state.players[pi] = fresh;
      }
      continue;
    }
    const want = Math.atan2(s.ty - s.y, s.tx - s.x);
    let d = want - s.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    s.angle += Math.max(-stats.turnRate, Math.min(stats.turnRate, d));

    const dist = Math.hypot(s.tx - s.x, s.ty - s.y);
    if (dist > 30) {
      s.vx += Math.cos(s.angle) * stats.thrust;
      s.vy += Math.sin(s.angle) * stats.thrust;
    }
    s.vx *= 0.99;
    s.vy *= 0.99;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > SPEED_CAP) {
      s.vx = (s.vx / sp) * SPEED_CAP;
      s.vy = (s.vy / sp) * SPEED_CAP;
    }
    s.x = wrap(s.x + s.vx, DW);
    s.y = wrap(s.y + s.vy, DH);

    if (t - s.lastShot >= stats.cooldown) {
      s.lastShot = t;
      const spread = 0.14;
      for (let b = 0; b < stats.streams; b++) {
        const off = stats.streams === 1 ? 0 : (b - (stats.streams - 1) / 2) * spread;
        const a = s.angle + off;
        state.bullets.push({
          x: s.x + Math.cos(a) * 10,
          y: s.y + Math.sin(a) * 10,
          vx: Math.cos(a) * BULLET_SPEED + s.vx * 0.4,
          vy: Math.sin(a) * BULLET_SPEED + s.vy * 0.4,
          born: t,
          owner: pi,
          alive: true,
        });
      }
    }
  }

  // Hulks drift, wrap, and grind the colony.
  for (const h of state.hulks) {
    if (!h.alive || h.born > t) continue;
    h.x = wrap(h.x + h.vx, DW);
    h.y = wrap(h.y + h.vy, DH);
    if (Math.hypot(h.x - CX, h.y - CY) < COLONY_R + HULK_RADIUS[h.size] * 0.7) {
      h.alive = false;
      state.colonyHp -= HULK_DAMAGE[h.size];
      state.colonyHitAt = t;
      state.shake = 8 + HULK_DAMAGE[h.size] * 3;
      state.booms.push({ x: h.x, y: h.y, born: t, owner: -1, big: h.size === 2 });
      splitHulk(state, h, true); // shards ricochet back out
      continue;
    }
    // Ship collisions (echo ships die too — their sorties are mortal).
    for (let pi = 0; pi < state.players.length; pi++) {
      const s = state.players[pi];
      if (s.dead || t < s.invulnUntil) continue;
      if (Math.hypot(h.x - s.x, h.y - s.y) < HULK_RADIUS[h.size] + 7) {
        s.dead = true;
        s.respawnAt = t + SHIP_RESPAWN;
        state.booms.push({ x: s.x, y: s.y, born: t, owner: pi, big: false });
        if (pi === 0) state.shake = 10;
        break;
      }
    }
  }

  // Bullets.
  for (const b of state.bullets) {
    if (!b.alive) continue;
    if (t - b.born > BULLET_TTL) {
      b.alive = false;
      continue;
    }
    b.x = wrap(b.x + b.vx, DW);
    b.y = wrap(b.y + b.vy, DH);
    const dmg = b.owner === 0 ? stats.damage : stats.damage * stats.echoMult;
    for (const h of state.hulks) {
      if (!h.alive || h.born > t) continue;
      if (Math.hypot(h.x - b.x, h.y - b.y) < HULK_RADIUS[h.size] + 2) {
        b.alive = false;
        h.hp -= dmg;
        if (h.hp <= 0) killHulk(state, h, b.owner);
        else state.booms.push({ x: b.x, y: b.y, born: t, owner: b.owner, big: false });
        break;
      }
    }
  }

  state.bullets = state.bullets.filter((b) => b.alive);
  state.booms = state.booms.filter((bm) => t - bm.born < BOOM_LIFE);

  if (state.shake > 0) state.shake--;

  if (state.colonyHp <= 0) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export function debrisSummary(state: DebrisState) {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
