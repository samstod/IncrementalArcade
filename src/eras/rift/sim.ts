// Era 7 — "THE RIFT" (End of Time): Tempest at the source of the Unraveling.
//
// A wireframe well drops away into the last moment of the universe. Entropy
// creatures climb the sixteen lanes toward the rim; you skate the rim on a
// blaster sled, firing down your lane. Creatures that reach the rim gnaw
// the Continuum Seal — the only thing still holding. This is the endgame
// era: every global multiplier converges here.
//
// Determinism contract: wave rosters (lane, spawn tick, climb speed, hop
// schedules) derive only from (seed, wave). Tanker splits derive from the
// parent's id — pure functions, no shared RNG stream.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

export const RW = 800;
export const RH = 600;
export const CX = RW / 2;
export const CY = RH / 2;
export const LANES = 16;
export const WAVE_TICKS = 700;
export const SHOT_SPEED = 0.02; // depth units per tick (rim→floor ~50 ticks)

export type CrawlerKind = 'crawler' | 'flipper' | 'tanker';

const KIND_HP: Record<CrawlerKind, number> = { crawler: 1, flipper: 1, tanker: 3 };
const KIND_SEAL_DAMAGE: Record<CrawlerKind, number> = { crawler: 1, flipper: 1, tanker: 2 };
const KIND_SALVAGE: Record<CrawlerKind, number> = { crawler: 1, flipper: 1.5, tanker: 3 };

export interface RiftStats {
  cooldown: number;
  damage: number;
  pierce: number;      // extra creatures one bolt passes through
  harmonics: number;   // adjacent-lane splash levels (half damage)
  rimSpeed: number;    // lanes per tick
  sealMaxHp: number;
  echoMult: number;
  salvageMult: number;
}

export interface Hop {
  at: number; // ticks after born
  dir: 1 | -1;
}

export interface Crawler {
  id: number;
  kind: CrawlerKind;
  lane: number;
  z: number;      // 0 = the floor of the well, 1 = the rim
  speed: number;  // dz per tick
  born: number;
  hops: Hop[];
  hopIdx: number;
  hp: number;
  maxHp: number;
  isChild: boolean;
  alive: boolean;
}

export interface Bolt {
  lane: number;
  z: number;
  owner: number;
  pierceLeft: number;
  alive: boolean;
}

export interface Rider {
  lane: number;       // continuous rim position, in lane units
  targetLane: number;
  lastShot: number;
}

export interface Boom {
  lane: number; z: number; born: number;
  owner: number;
}

export interface RiftState {
  seed: number;
  tick: number;
  wave: number;
  stats: RiftStats;
  players: Rider[];
  crawlers: Crawler[];
  bolts: Bolt[];
  booms: Boom[];
  nextId: number;
  sealHp: number;
  sealHitAt: number;
  kills: number;
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export const BOOM_LIFE = 22;

export function riftInit(seed: number, stats: RiftStats, playerCount: number): RiftState {
  return {
    seed,
    tick: 0,
    wave: 0,
    stats,
    players: Array.from({ length: playerCount }, (_, i) => ({
      lane: (i * 5) % LANES,
      targetLane: (i * 5) % LANES,
      lastShot: -9999,
    })),
    crawlers: [],
    bolts: [],
    booms: [],
    nextId: 1,
    sealHp: stats.sealMaxHp,
    sealHitAt: -9999,
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
}

function climbTicks(k: number): number {
  return Math.max(220, 620 - 30 * k);
}

function spawnWave(state: RiftState, k: number): void {
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0x45d9f3b)) >>> 0);
  const count = Math.min(52, 5 + Math.floor(k * 2.2));
  const start = k * WAVE_TICKS;
  for (let i = 0; i < count; i++) {
    const kind: CrawlerKind =
      k >= 2 && i % 5 === 4 ? 'tanker'
      : k >= 1 && i % 3 === 2 ? 'flipper'
      : 'crawler';
    const born = start + Math.floor(rng() * WAVE_TICKS * 0.6);
    const speed = (1 / climbTicks(k)) * (0.8 + rng() * 0.5);
    const hops: Hop[] = [];
    if (kind === 'flipper') {
      let at = 70 + Math.floor(rng() * 80);
      while (at < 1500) {
        hops.push({ at, dir: rng() < 0.5 ? 1 : -1 });
        at += 70 + Math.floor(rng() * 90);
      }
    }
    state.crawlers.push({
      id: state.nextId++,
      kind,
      lane: Math.floor(rng() * LANES),
      z: 0,
      speed,
      born,
      hops,
      hopIdx: 0,
      hp: KIND_HP[kind] + Math.floor(k / 2),
      maxHp: KIND_HP[kind] + Math.floor(k / 2),
      isChild: false,
      alive: true,
    });
  }
}

/** Tanker fragments: two crawlers in the flanking lanes, id-derived. */
function splitTanker(state: RiftState, parent: Crawler): void {
  for (let c = 0; c < 2; c++) {
    const rng = mulberry32((state.seed ^ Math.imul(parent.id, 0x27d4eb2f) ^ Math.imul(c + 1, 0x9e3779b1)) >>> 0);
    state.crawlers.push({
      id: state.nextId++,
      kind: 'crawler',
      lane: (parent.lane + (c === 0 ? 1 : -1) + LANES) % LANES,
      z: Math.max(0, parent.z - 0.02),
      speed: parent.speed * (1.1 + rng() * 0.3),
      born: state.tick,
      hops: [],
      hopIdx: 0,
      hp: 1 + Math.floor(parent.maxHp / 4),
      maxHp: 1 + Math.floor(parent.maxHp / 4),
      isChild: true,
      alive: true,
    });
  }
}

function killCrawler(state: RiftState, cr: Crawler, owner: number): void {
  cr.alive = false;
  state.kills++;
  state.salvage += KIND_SALVAGE[cr.kind] * state.stats.salvageMult;
  state.booms.push({ lane: cr.lane, z: cr.z, born: state.tick, owner });
  if (cr.kind === 'tanker') splitTanker(state, cr);
}

function laneDelta(from: number, to: number): number {
  let d = (to + 0.0001 - from) % LANES;
  if (d > LANES / 2) d -= LANES;
  if (d < -LANES / 2) d += LANES;
  return d;
}

export function riftStep(state: RiftState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    state.banner = { text: `SURGE ${k + 1}`, until: t + 110 };
  }

  // Pointer angle → target lane; slide the rim toward it.
  for (let pi = 0; pi < inputs.length; pi++) {
    const evs = inputs[pi];
    if (evs.length > 0) {
      const ev = evs[evs.length - 1];
      const a = Math.atan2((ev.y - CY) / 0.78, ev.x - CX) + Math.PI / 2;
      const frac = ((a / (Math.PI * 2)) * LANES + LANES * 10) % LANES;
      state.players[pi].targetLane = Math.floor(frac);
    }
  }
  for (let pi = 0; pi < state.players.length; pi++) {
    const p = state.players[pi];
    const d = laneDelta(p.lane, p.targetLane + 0.5);
    const step = Math.max(-stats.rimSpeed, Math.min(stats.rimSpeed, d));
    p.lane = (p.lane + step + LANES) % LANES;
    if (t - p.lastShot >= stats.cooldown) {
      p.lastShot = t;
      state.bolts.push({
        lane: Math.floor(p.lane) % LANES,
        z: 1,
        owner: pi,
        pierceLeft: stats.pierce,
        alive: true,
      });
    }
  }

  // Crawlers climb; flippers hop lanes on their precomputed schedule.
  for (const cr of state.crawlers) {
    if (!cr.alive || cr.born > t) continue;
    const dt = t - cr.born;
    while (cr.hopIdx < cr.hops.length && cr.hops[cr.hopIdx].at <= dt) {
      cr.lane = (cr.lane + cr.hops[cr.hopIdx].dir + LANES) % LANES;
      cr.hopIdx++;
    }
    cr.z += cr.speed;
    if (cr.z >= 1) {
      cr.alive = false;
      state.sealHp -= KIND_SEAL_DAMAGE[cr.kind];
      state.sealHitAt = t;
      state.shake = 12;
      state.booms.push({ lane: cr.lane, z: 1, born: t, owner: -1 });
    }
  }

  // Bolts dive; pierce and harmonics decide what they touch.
  for (const b of state.bolts) {
    if (!b.alive) continue;
    b.z -= SHOT_SPEED;
    if (b.z <= 0) {
      b.alive = false;
      continue;
    }
    const dmg = b.owner === 0 ? stats.damage : stats.damage * stats.echoMult;
    for (const cr of state.crawlers) {
      if (!cr.alive || cr.born > t) continue;
      if (Math.abs(cr.z - b.z) > 0.05) continue;
      const dl = Math.abs(laneDelta(cr.lane + 0.5, b.lane + 0.5));
      if (dl < 0.6) {
        cr.hp -= dmg;
        if (cr.hp <= 0) killCrawler(state, cr, b.owner);
        else state.booms.push({ lane: cr.lane, z: cr.z, born: t, owner: b.owner });
        if (b.pierceLeft <= 0) {
          b.alive = false;
          break;
        }
        b.pierceLeft--;
      } else if (stats.harmonics > 0 && dl < 0.6 + stats.harmonics) {
        // Harmonic splash: adjacent lanes take half damage, bolt flies on.
        cr.hp -= dmg * 0.5;
        if (cr.hp <= 0) killCrawler(state, cr, b.owner);
      }
    }
  }

  state.bolts = state.bolts.filter((b) => b.alive);
  state.booms = state.booms.filter((bm) => t - bm.born < BOOM_LIFE);

  if (state.shake > 0) state.shake--;

  if (state.sealHp <= 0) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export function riftSummary(state: RiftState) {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
