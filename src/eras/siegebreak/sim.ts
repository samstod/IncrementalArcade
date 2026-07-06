// Era 3 — "SIEGEBREAK" (1250): Space Invaders as a castle siege.
//
// Ranks of siege infantry advance in formation — step, step, drop — toward
// your wall. You slide a ballista along the battlements; it fires a heavy
// bolt straight up whenever the windlass crew has it loaded. Crumbling
// merlons are your bunkers; the gate's timbers are your life total.
//
// Determinism contract, same as every era: formations and the arrow-fire
// schedule derive only from (seed, wave) at fixed ticks. Formation *speed*
// scales with surviving members (the classic Invaders accelerando), which is
// defense-outcome divergence — allowed, like MIRV children and bombs.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

export const SW = 800;
export const SH = 600;
export const WALL_Y = 500;
export const WAVE_TICKS = 900; // 15s: sieges are slower, heavier waves
export const CELL_W = 52;
export const CELL_H = 34;
export const BOLT_SPEED = 7;
export const ARROW_SPEED = 2.4;

// Merlons flank the gate: the two inner ones are the gate's real shield and
// crumble first; the outer pair covers the wall walk.
export const MERLON_X = [180, 340, 460, 620];
export const MERLON_HALF = 34; // merlon half-width for arrow blocking
export const GATE_X = SW / 2;
export const GATE_HALF = 120; // arrows landing here chew the gate timbers

export interface SiegeStats {
  reload: number;       // ticks between bolts
  boltDamage: number;
  pierce: number;       // extra enemies one bolt can pass through
  moveSpeed: number;    // ballista slide px/tick
  gateMaxHp: number;
  merlonMaxHp: number;
  echoMult: number;     // echo bolt damage fraction
  salvageMult: number;
}

export type UnitKind = 'footman' | 'shieldman' | 'archer';

export interface Unit {
  formation: number; // index into formations
  col: number;
  row: number;
  kind: UnitKind;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface Formation {
  k: number;      // wave index
  x: number;      // left edge of the grid
  y: number;      // top of the grid
  dir: 1 | -1;
  cols: number;
  rows: number;
  total: number;
  alive: number;
}

export interface Bolt {
  x: number;
  y0: number;
  born: number;
  owner: number;
  pierceLeft: number;
  hitIds: number[]; // unit indices already damaged by this bolt
  alive: boolean;
}

export interface Arrow {
  x0: number;
  y0: number;
  tx: number; // aimed landing x at the wall — archers shoot AT the gate
  born: number;
  alive: boolean;
}

/** Precomputed enemy volley schedule: fixed tick + column + aim, per formation. */
export interface VolleyOrder {
  tick: number;
  formation: number;
  col: number;
  targetX: number; // where this arrow is aimed along the wall
}

export interface Boom {
  x: number;
  y: number;
  born: number;
  owner: number; // -1 enemy hit on us, else player instance kill
}

export interface Merlon {
  x: number;
  hp: number;
}

export interface SiegeState {
  seed: number;
  tick: number;
  wave: number;
  stats: SiegeStats;
  players: { x: number; tx: number; lastShot: number }[];
  formations: Formation[];
  units: Unit[];
  bolts: Bolt[];
  arrows: Arrow[];
  volleys: VolleyOrder[]; // sorted by tick; consumed as time passes
  volleyIdx: number;
  booms: Boom[];
  merlons: Merlon[];
  gateHp: number;
  kills: number;
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export const BOOM_LIFE = 22;

export function siegeInit(seed: number, stats: SiegeStats, playerCount: number): SiegeState {
  return {
    seed,
    tick: 0,
    wave: 0,
    stats,
    players: Array.from({ length: playerCount }, () => ({
      x: SW / 2, tx: SW / 2, lastShot: -9999,
    })),
    formations: [],
    units: [],
    bolts: [],
    arrows: [],
    volleys: [],
    volleyIdx: 0,
    booms: [],
    merlons: MERLON_X.map((x) => ({ x, hp: stats.merlonMaxHp })),
    gateHp: stats.gateMaxHp,
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
}

function rowsInWave(k: number): number {
  return Math.min(6, 3 + Math.floor(k / 2));
}

function spawnWave(state: SiegeState, k: number): void {
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0xc2b2ae35)) >>> 0);
  const cols = 9;
  const rows = rowsInWave(k);
  const fIdx = state.formations.length;
  const gridW = cols * CELL_W;

  state.formations.push({
    k,
    x: 40 + rng() * (SW - gridW - 80),
    y: 60,
    dir: rng() < 0.5 ? 1 : -1,
    cols,
    rows,
    total: cols * rows,
    alive: cols * rows,
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Back row are archers, front row shieldmen, the middle footmen.
      const kind: UnitKind = r === 0 ? 'archer' : r === rows - 1 ? 'shieldman' : 'footman';
      const hp =
        kind === 'shieldman' ? 2 + Math.floor(k / 4)
        : kind === 'archer' ? 1 + Math.floor(k / 8)
        : 1 + Math.floor(k / 6);
      state.units.push({ formation: fIdx, col: c, row: r, kind, hp, maxHp: hp, alive: true });
    }
  }

  // Fixed volley schedule for this formation's whole assault window.
  const start = k * WAVE_TICKS;
  const volleyCount = 12 + k * 4;
  const window = WAVE_TICKS * 2.5; // formations linger past their wave
  for (let i = 0; i < volleyCount; i++) {
    state.volleys.push({
      tick: start + 60 + Math.floor(rng() * window),
      formation: fIdx,
      col: Math.floor(rng() * cols),
      // Aimed at the gate with spread: some threaten the timbers directly,
      // some land on the flanking merlons, the rest thud into stone.
      targetX: GATE_X + (rng() - 0.5) * 2 * 230,
    });
  }
  state.volleys.sort((a, b) => a.tick - b.tick);
  // Rebuild the battlements between assaults.
  for (const m of state.merlons) m.hp = state.stats.merlonMaxHp;
}

export function unitPos(state: SiegeState, u: Unit): { x: number; y: number } {
  const f = state.formations[u.formation];
  return {
    x: f.x + u.col * CELL_W + CELL_W / 2,
    y: f.y + u.row * CELL_H + CELL_H / 2,
  };
}

export function boltY(b: Bolt, tick: number): number {
  return b.y0 - BOLT_SPEED * (tick - b.born);
}

export function arrowPos(a: Arrow, tick: number): { x: number; y: number } {
  const y = a.y0 + ARROW_SPEED * (tick - a.born);
  const f = Math.min(1, Math.max(0, (y - a.y0) / Math.max(1, WALL_Y - 24 - a.y0)));
  return { x: a.x0 + (a.tx - a.x0) * f, y };
}

function salvageFor(kind: UnitKind): number {
  return kind === 'shieldman' ? 2 : kind === 'archer' ? 1.5 : 1;
}

function damageUnit(state: SiegeState, idx: number, dmg: number, owner: number): void {
  const u = state.units[idx];
  u.hp -= dmg;
  if (u.hp <= 0 && u.alive) {
    u.alive = false;
    state.formations[u.formation].alive--;
    state.kills++;
    state.salvage += salvageFor(u.kind) * state.stats.salvageMult;
    const pos = unitPos(state, u);
    state.booms.push({ x: pos.x, y: pos.y, born: state.tick, owner });
  }
}

export function siegeStep(state: SiegeState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    state.banner = { text: `ASSAULT ${k + 1}`, until: t + 130 };
  }

  // Steering + slow heavy autofire.
  for (let pi = 0; pi < inputs.length; pi++) {
    const evs = inputs[pi];
    if (evs.length > 0) state.players[pi].tx = evs[evs.length - 1].x;
  }
  for (let pi = 0; pi < state.players.length; pi++) {
    const g = state.players[pi];
    const d = g.tx - g.x;
    g.x += Math.abs(d) <= stats.moveSpeed ? d : Math.sign(d) * stats.moveSpeed;
    g.x = Math.min(SW - 30, Math.max(30, g.x));
    if (t - g.lastShot >= stats.reload) {
      g.lastShot = t;
      state.bolts.push({
        x: g.x, y0: WALL_Y - 26, born: t, owner: pi,
        pierceLeft: stats.pierce, hitIds: [], alive: true,
      });
    }
  }

  // Formation march: step sideways, drop at the edges; the fewer left,
  // the faster they come (the Invaders accelerando).
  for (const f of state.formations) {
    if (f.alive <= 0) continue;
    const speed = (0.3 + 0.9 * (1 - f.alive / f.total) + f.k * 0.035) * (f.dir as number);
    f.x += speed;
    const gridW = f.cols * CELL_W;
    if (f.x < 16 || f.x + gridW > SW - 16) {
      f.dir = (f.dir === 1 ? -1 : 1) as 1 | -1;
      f.x = Math.min(Math.max(f.x, 16), SW - 16 - gridW);
      f.y += 16;
    }
  }

  // Units that reach the wall assault the gate and are spent.
  for (const u of state.units) {
    if (!u.alive) continue;
    const pos = unitPos(state, u);
    if (pos.y >= WALL_Y - 18) {
      u.alive = false;
      state.formations[u.formation].alive--;
      state.gateHp -= u.kind === 'shieldman' ? 2 : 1;
      state.shake = 14;
      state.booms.push({ x: pos.x, y: WALL_Y - 14, born: t, owner: -1 });
    }
  }

  // Scheduled volleys: the arrow comes from the lowest surviving unit in the
  // ordered column (schedule fixed; origin is defense-outcome divergence).
  while (state.volleyIdx < state.volleys.length && state.volleys[state.volleyIdx].tick <= t) {
    const v = state.volleys[state.volleyIdx++];
    let shooter: Unit | null = null;
    for (const u of state.units) {
      if (!u.alive || u.formation !== v.formation || u.col !== v.col) continue;
      if (!shooter || u.row > shooter.row) shooter = u;
    }
    if (shooter) {
      const pos = unitPos(state, shooter);
      state.arrows.push({ x0: pos.x, y0: pos.y + 10, tx: v.targetX, born: t, alive: true });
    }
  }

  // Arrows land: merlons soak them; the gate zone takes real damage;
  // anywhere else is a harmless thud into stone.
  for (const a of state.arrows) {
    if (!a.alive) continue;
    const pos = arrowPos(a, t);
    if (pos.y < WALL_Y - 24) continue;
    a.alive = false;
    const m = state.merlons.find((m) => m.hp > 0 && Math.abs(m.x - pos.x) <= MERLON_HALF);
    if (m) {
      m.hp--;
      state.booms.push({ x: pos.x, y: WALL_Y - 26, born: t, owner: -1 });
    } else if (Math.abs(pos.x - GATE_X) <= GATE_HALF) {
      state.gateHp--;
      state.shake = 8;
      state.booms.push({ x: pos.x, y: WALL_Y - 8, born: t, owner: -1 });
    }
  }

  // Bolts climb, punching through up to (1 + pierce) enemies.
  for (const b of state.bolts) {
    if (!b.alive) continue;
    const yTop = boltY(b, t);
    if (yTop < -10) {
      b.alive = false;
      continue;
    }
    const dmg = b.owner === 0 ? stats.boltDamage : stats.boltDamage * stats.echoMult;
    for (let idx = 0; idx < state.units.length && b.alive; idx++) {
      const u = state.units[idx];
      if (!u.alive || b.hitIds.includes(idx)) continue;
      const pos = unitPos(state, u);
      if (Math.abs(pos.x - b.x) <= 18 && Math.abs(pos.y - yTop) <= 14) {
        b.hitIds.push(idx);
        damageUnit(state, idx, dmg, b.owner);
        if (b.pierceLeft <= 0) b.alive = false;
        else b.pierceLeft--;
      }
    }
  }

  state.bolts = state.bolts.filter((b) => b.alive);
  state.arrows = state.arrows.filter((a) => a.alive);
  state.booms = state.booms.filter((bm) => t - bm.born < BOOM_LIFE);

  if (state.shake > 0) state.shake--;

  if (state.gateHp <= 0) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export function siegeSummary(state: SiegeState) {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
