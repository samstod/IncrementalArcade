// Era 4 — "BROADSIDE" (1720): Breakout/Arkanoid as an Age-of-Sail bombardment.
//
// Your ship tacks along the bottom; a ricocheting cannonball chews through
// the brick courses of an island fortress wall. Powder-keg bricks
// chain-explode; flotsam bricks drop pickups (grapeshot multi-ball, broad
// hull, coin caches). The fortress answers: every wave its wall grows and
// shifts a course lower, and mortar volleys fall on a seeded schedule. The
// wall reaching your blockade line grinds your hull; mortar hits do too.
//
// Determinism contract: wall growth, brick composition, and the mortar
// schedule derive only from (seed, wave) at fixed ticks. Ball physics is
// pure arithmetic on state. Every player instance (live + echoes) owns its
// paddle and its own cannonballs against the shared wall.

import { mulberry32 } from '../../core/rng';
import type { InputEvent } from '../../core/recorder';

export const BW = 800;
export const BH = 600;
export const WAVE_TICKS = 720; // 12s per wave
export const COLS = 16;
export const BRICK_W = 46;
export const BRICK_H = 20;
export const WALL_X0 = (BW - COLS * BRICK_W) / 2;
export const WALL_TOP = 64;
export const BLOCKADE_Y = 420; // bricks crossing this line assault the hull
export const SHIP_Y = 496;
export const SEA_Y = 520;
export const BALL_R = 5;
export const MORTAR_SPEED = 2.1;
export const DROP_SPEED = 1.6;

export interface BroadStats {
  ballDamage: number;
  halfWidth: number;    // paddle half-width
  paddleSpeed: number;
  hullMaxHp: number;
  reload: number;       // ticks to fish a lost ball out of the sea
  maxBalls: number;     // per instance, grapeshot cap
  echoMult: number;
  salvageMult: number;
}

export type BrickKind = 'plain' | 'tough' | 'keg' | 'flotsam';
export type DropKind = 'grape' | 'wide' | 'coin';

export interface Brick {
  col: number;
  row: number; // grows downward; shifted +N when new courses land on top
  kind: BrickKind;
  drop?: DropKind; // only for flotsam bricks; decided at spawn
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  owner: number;
  alive: boolean;
}

export interface Mortar {
  x: number; y0: number; born: number;
  alive: boolean;
}

export interface MortarOrder {
  tick: number;
  x: number;
}

export interface Drop {
  x: number; y0: number; born: number;
  kind: DropKind;
  alive: boolean;
}

export interface Boom {
  x: number; y: number; born: number;
  owner: number; // -1 enemy, else instance
}

export interface Paddle {
  x: number;
  tx: number;
  wideUntil: number; // broad-hull pickup expiry tick
  respawnAt: number; // when the next ball launches (-1 = has live balls)
}

export interface BroadState {
  seed: number;
  tick: number;
  wave: number;
  stats: BroadStats;
  players: Paddle[];
  bricks: Brick[];
  balls: Ball[];
  mortars: Mortar[];
  mortarOrders: MortarOrder[];
  mortarIdx: number;
  drops: Drop[];
  booms: Boom[];
  hullHp: number;
  kills: number; // bricks shattered
  salvage: number;
  over: boolean;
  diedAt: number;
  shake: number;
  banner: { text: string; until: number } | null;
}

export const BOOM_LIFE = 24;

export function brickX(b: Brick): number {
  return WALL_X0 + b.col * BRICK_W;
}
export function brickY(b: Brick): number {
  return WALL_TOP + b.row * BRICK_H;
}

export function mortarY(m: Mortar, tick: number): number {
  return m.y0 + MORTAR_SPEED * (tick - m.born);
}
export function dropY(d: Drop, tick: number): number {
  return d.y0 + DROP_SPEED * (tick - d.born);
}

export function paddleHalf(state: BroadState, p: Paddle): number {
  return state.stats.halfWidth * (state.tick < p.wideUntil ? 1.35 : 1);
}

function ballSpeed(k: number): number {
  return Math.min(7, 4.0 + 0.08 * k);
}

export function broadInit(seed: number, stats: BroadStats, playerCount: number): BroadState {
  const state: BroadState = {
    seed,
    tick: 0,
    wave: 0,
    stats,
    players: Array.from({ length: playerCount }, () => ({
      x: BW / 2, tx: BW / 2, wideUntil: 0, respawnAt: 0,
    })),
    bricks: [],
    balls: [],
    mortars: [],
    mortarOrders: [],
    mortarIdx: 0,
    drops: [],
    booms: [],
    hullHp: stats.hullMaxHp,
    kills: 0,
    salvage: 0,
    over: false,
    diedAt: 0,
    shake: 0,
    banner: null,
  };
  return state;
}

function spawnWave(state: BroadState, k: number): void {
  const rng = mulberry32((state.seed ^ Math.imul(k + 1, 0x27d4eb2f)) >>> 0);
  // One fresh course per wave (two late): slow enough that a good ship
  // meaningfully thins the wall before it reaches the blockade.
  const newRows = k === 0 ? 5 : k < 8 ? 1 : 2;

  // The wall settles: every standing course shifts down to make room.
  for (const b of state.bricks) if (b.alive) b.row += newRows;

  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < COLS; c++) {
      const roll = rng();
      const kind: BrickKind =
        roll < 0.12 ? 'keg'
        : roll < 0.24 ? 'flotsam'
        : roll < 0.24 + 0.18 + k * 0.015 ? 'tough'
        : 'plain';
      const hp =
        kind === 'tough' ? 2 + Math.floor(k / 3)
        : kind === 'keg' ? 1
        : 1 + Math.floor(k / 5);
      const drop: DropKind | undefined =
        kind === 'flotsam'
          ? rng() < 0.5 ? 'grape' : rng() < 0.8 ? 'wide' : 'coin'
          : undefined;
      state.bricks.push({ col: c, row: r, kind, drop, hp, maxHp: hp, alive: true });
    }
  }

  // Mortar volley schedule for this wave — timing and aim are seed-fixed.
  // Mortars are the early killer; the advancing wall is the late one.
  const start = k * WAVE_TICKS;
  const volleys = Math.min(32, 6 + Math.round(2.4 * k));
  for (let i = 0; i < volleys; i++) {
    state.mortarOrders.push({
      tick: start + 90 + Math.floor(rng() * (WAVE_TICKS - 120)),
      x: 40 + rng() * (BW - 80),
    });
  }
  state.mortarOrders.sort((a, b) => a.tick - b.tick);
}

function shatterBrick(state: BroadState, brick: Brick, owner: number): void {
  if (!brick.alive) return;
  brick.alive = false;
  state.kills++;
  const value = brick.kind === 'tough' ? 2 : 1;
  state.salvage += value * state.stats.salvageMult;
  const bx = brickX(brick) + BRICK_W / 2;
  const by = brickY(brick) + BRICK_H / 2;
  state.booms.push({ x: bx, y: by, born: state.tick, owner });

  if (brick.kind === 'keg') {
    // Powder keg: everything in the 3×3 around it goes up too (chains).
    for (const other of state.bricks) {
      if (!other.alive) continue;
      if (Math.abs(other.col - brick.col) <= 1 && Math.abs(other.row - brick.row) <= 1)
        shatterBrick(state, other, owner);
    }
  }
  if (brick.kind === 'flotsam' && brick.drop) {
    state.drops.push({ x: bx, y0: by, born: state.tick, kind: brick.drop, alive: true });
  }
}

function damageBrick(state: BroadState, brick: Brick, dmg: number, owner: number): void {
  brick.hp -= dmg;
  if (brick.hp <= 0) shatterBrick(state, brick, owner);
}

function brickAt(state: BroadState, x: number, y: number): Brick | null {
  if (y < WALL_TOP || x < WALL_X0 || x >= WALL_X0 + COLS * BRICK_W) return null;
  const col = Math.floor((x - WALL_X0) / BRICK_W);
  const row = Math.floor((y - WALL_TOP) / BRICK_H);
  for (const b of state.bricks)
    if (b.alive && b.col === col && b.row === row) return b;
  return null;
}

function launchBall(state: BroadState, pi: number): void {
  const p = state.players[pi];
  const speed = ballSpeed(state.wave - 1);
  const vx = p.x < BW / 2 ? speed * 0.45 : -speed * 0.45;
  state.balls.push({
    x: p.x, y: SHIP_Y - 14,
    vx, vy: -Math.sqrt(speed * speed - vx * vx),
    owner: pi, alive: true,
  });
  p.respawnAt = -1;
}

export function broadStep(state: BroadState, inputs: InputEvent[][]): void {
  if (state.over) return;
  const t = state.tick;
  const stats = state.stats;

  if (t % WAVE_TICKS === 0) {
    const k = t / WAVE_TICKS;
    state.wave = k + 1;
    spawnWave(state, k);
    state.banner = { text: `WAVE ${k + 1}`, until: t + 110 };

    // The settled wall crossing the blockade line grinds the hull: every
    // four bricks of rubble is one stove-in plank, so thinning the wall
    // before it arrives (and bracing the hull) genuinely buys waves.
    let crossed = 0;
    for (const b of state.bricks) {
      if (!b.alive) continue;
      if (brickY(b) + BRICK_H > BLOCKADE_Y) {
        b.alive = false;
        crossed++;
        state.booms.push({ x: brickX(b) + BRICK_W / 2, y: BLOCKADE_Y, born: t, owner: -1 });
      }
    }
    if (crossed > 0) {
      state.hullHp -= Math.ceil(crossed / 4);
      state.shake = 14;
    }
  }

  // Steering.
  for (let pi = 0; pi < inputs.length; pi++) {
    const evs = inputs[pi];
    if (evs.length > 0) state.players[pi].tx = evs[evs.length - 1].x;
  }
  for (let pi = 0; pi < state.players.length; pi++) {
    const p = state.players[pi];
    const d = p.tx - p.x;
    p.x += Math.abs(d) <= stats.paddleSpeed ? d : Math.sign(d) * stats.paddleSpeed;
    const half = paddleHalf(state, p);
    p.x = Math.min(BW - half - 6, Math.max(half + 6, p.x));
    // Fresh ball off the davits.
    if (p.respawnAt >= 0 && t >= p.respawnAt) launchBall(state, pi);
  }

  // Mortar volleys on schedule.
  while (state.mortarIdx < state.mortarOrders.length && state.mortarOrders[state.mortarIdx].tick <= t) {
    const o = state.mortarOrders[state.mortarIdx++];
    state.mortars.push({ x: o.x, y0: BLOCKADE_Y - 60, born: t, alive: true });
    state.booms.push({ x: o.x, y: BLOCKADE_Y - 60, born: t, owner: -1 });
  }

  // Mortars fall on the live ship only — echoes are already sunk history.
  for (const m of state.mortars) {
    if (!m.alive) continue;
    const y = mortarY(m, t);
    if (y < SHIP_Y - 10) continue;
    m.alive = false;
    const p = state.players[0];
    // Fixed cross-section: a broader hull must not make mortars hit more
    // often, or the BROAD HULL upgrade would be a net loss.
    if (Math.abs(m.x - p.x) <= 34) {
      state.hullHp--;
      state.shake = 14;
      state.booms.push({ x: m.x, y: SHIP_Y, born: t, owner: -1 });
    } else {
      state.booms.push({ x: m.x, y: SEA_Y, born: t, owner: -1 }); // splash
    }
  }

  // Flotsam pickups: caught by the owning instance's paddle.
  for (const d of state.drops) {
    if (!d.alive) continue;
    const y = dropY(d, t);
    if (y > SEA_Y + 10) {
      d.alive = false;
      continue;
    }
    if (y < SHIP_Y - 12 || y > SHIP_Y + 8) continue;
    for (let pi = 0; pi < state.players.length; pi++) {
      const p = state.players[pi];
      if (Math.abs(d.x - p.x) > paddleHalf(state, p)) continue;
      d.alive = false;
      if (d.kind === 'grape') {
        const owned = state.balls.filter((b) => b.alive && b.owner === pi).length;
        if (owned > 0 && owned < stats.maxBalls) {
          const speed = ballSpeed(state.wave - 1);
          state.balls.push({
            x: p.x, y: SHIP_Y - 14,
            vx: (pi % 2 === 0 ? 1 : -1) * speed * 0.5,
            vy: -Math.sqrt(speed * speed - speed * speed * 0.25),
            owner: pi, alive: true,
          });
        }
      } else if (d.kind === 'wide') {
        p.wideUntil = t + 900;
      } else {
        state.salvage += 5 * stats.salvageMult;
      }
      state.booms.push({ x: d.x, y: SHIP_Y - 8, born: t, owner: pi });
      break;
    }
  }

  // Cannonballs.
  for (const ball of state.balls) {
    if (!ball.alive) continue;
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Walls of the world.
    if (ball.x < BALL_R + 2) { ball.x = BALL_R + 2; ball.vx = Math.abs(ball.vx); }
    if (ball.x > BW - BALL_R - 2) { ball.x = BW - BALL_R - 2; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < BALL_R + 30) { ball.y = BALL_R + 30; ball.vy = Math.abs(ball.vy); }

    // Bricks: probe the leading edge on each axis so we reflect correctly.
    const dmg = ball.owner === 0 ? stats.ballDamage : stats.ballDamage * stats.echoMult;
    const hitX = brickAt(state, ball.x + Math.sign(ball.vx) * BALL_R, ball.y);
    if (hitX) {
      damageBrick(state, hitX, dmg, ball.owner);
      ball.vx = -ball.vx;
    } else {
      const hitY = brickAt(state, ball.x, ball.y + Math.sign(ball.vy) * BALL_R);
      if (hitY) {
        damageBrick(state, hitY, dmg, ball.owner);
        ball.vy = -ball.vy;
      }
    }

    // Paddle.
    const p = state.players[ball.owner];
    if (ball.vy > 0 && ball.y >= SHIP_Y - 10 && ball.y <= SHIP_Y + 4) {
      const half = paddleHalf(state, p);
      if (Math.abs(ball.x - p.x) <= half + BALL_R) {
        const offset = Math.max(-1, Math.min(1, (ball.x - p.x) / half));
        const speed = Math.hypot(ball.vx, ball.vy);
        ball.vx = offset * speed * 0.75;
        ball.vy = -Math.max(speed * 0.5, Math.sqrt(Math.max(0.25, speed * speed - ball.vx * ball.vx)));
        ball.y = SHIP_Y - 11;
      }
    }

    // The sea claims it.
    if (ball.y > SEA_Y + 20) {
      ball.alive = false;
      state.booms.push({ x: ball.x, y: SEA_Y, born: t, owner: -1 });
    }
  }

  // Reload when an instance has no cannonballs in play.
  for (let pi = 0; pi < state.players.length; pi++) {
    const p = state.players[pi];
    if (p.respawnAt >= 0) continue;
    if (!state.balls.some((b) => b.alive && b.owner === pi))
      p.respawnAt = t + stats.reload;
  }

  state.balls = state.balls.filter((b) => b.alive);
  state.mortars = state.mortars.filter((m) => m.alive);
  state.drops = state.drops.filter((d) => d.alive);
  state.booms = state.booms.filter((bm) => t - bm.born < BOOM_LIFE);

  if (state.shake > 0) state.shake--;

  if (state.hullHp <= 0) {
    state.over = true;
    state.diedAt = t;
  }

  state.tick++;
}

export function broadSummary(state: BroadState) {
  return {
    wave: state.wave,
    ticks: state.tick,
    kills: state.kills,
    salvage: Math.floor(state.salvage),
  };
}
