// BROADSIDE determinism: identical replay, and wall composition + mortar
// schedule immune to player actions. (Brick rows shift only while alive and
// blockade grinding depends on what survived — defense outcomes — so the
// schedule comparison uses spawn-time properties only.)

import { describe, it, expect } from 'vitest';
import {
  broadInit, broadStep, WAVE_TICKS,
  type BroadState, type BroadStats,
} from '../src/eras/broadside/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: BroadStats = {
  ballDamage: 2,
  halfWidth: 44,
  paddleSpeed: 7,
  hullMaxHp: 12,
  reload: 120,
  maxBalls: 3,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0xb0a7;

function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 25 !== 0) return [];
  return [{ t: tick, x: 60 + ((tick * 13) % 680), y: 0 }];
}

function runSim(ticks: number, withInputs: boolean): BroadState {
  const state = broadInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    broadStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: BroadState): string {
  return JSON.stringify({
    tick: s.tick, wave: s.wave, kills: s.kills, salvage: s.salvage,
    hullHp: s.hullHp, players: s.players, bricks: s.bricks, balls: s.balls,
    mortars: s.mortars, drops: s.drops, over: s.over,
  });
}

describe('BROADSIDE determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(4000, true);
    const b = runSim(4000, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('wall composition and mortar schedule are immune to player actions', () => {
    const idle = runSim(4000, false);
    const active = runSim(4000, true);
    const waves = Math.min(idle.wave, active.wave);
    const cut = waves * WAVE_TICKS;

    // Bricks append in spawn order and are never removed from the array.
    const wall = (s: BroadState, n: number) =>
      s.bricks.slice(0, n).map((b) => ({ col: b.col, kind: b.kind, drop: b.drop, maxHp: b.maxHp }));
    const n = Math.min(idle.bricks.length, active.bricks.length);
    expect(wall(active, n)).toEqual(wall(idle, n));

    const mortars = (s: BroadState) => s.mortarOrders.filter((o) => o.tick <= cut);
    expect(mortars(active)).toEqual(mortars(idle));
  });

  it('waves escalate on a fixed tick schedule', () => {
    const s = runSim(4000, false);
    expect(s.wave).toBe(Math.floor((s.tick - 1) / WAVE_TICKS) + 1);
  });
});
