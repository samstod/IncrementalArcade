// DEBRIS FIELD determinism: identical replay, and a wave roster immune to
// player actions. (Fragment ids differ between runs because splits are
// kill-driven, so the roster comparison uses spawn-invariant fields of
// top-level hulks only.)

import { describe, it, expect } from 'vitest';
import {
  debrisInit, debrisStep, WAVE_TICKS,
  type DebrisState, type DebrisStats,
} from '../src/eras/debrisfield/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: DebrisStats = {
  cooldown: 14,
  damage: 2,
  streams: 2,
  thrust: 0.1,
  turnRate: 0.11,
  colonyMaxHp: 15,
  regen: 1,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0xdeb6;

function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 35 !== 0) return [];
  return [{ t: tick, x: 100 + ((tick * 17) % 600), y: 80 + ((tick * 23) % 440) }];
}

function runSim(ticks: number, withInputs: boolean): DebrisState {
  const state = debrisInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    debrisStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: DebrisState): string {
  return JSON.stringify({
    tick: s.tick, wave: s.wave, kills: s.kills, salvage: s.salvage,
    colonyHp: s.colonyHp, players: s.players, hulks: s.hulks,
    bullets: s.bullets, over: s.over,
  });
}

describe('DEBRIS FIELD determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(4000, true);
    const b = runSim(4000, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('the wave roster is immune to player actions', () => {
    const idle = runSim(4000, false);
    const active = runSim(4000, true);
    const waves = Math.min(idle.wave, active.wave);
    const cut = waves * WAVE_TICKS;
    const roster = (s: DebrisState) =>
      s.hulks
        .filter((h) => !h.isChild && h.born <= cut)
        .map((h) => ({
          born: h.born, size: h.size, wave: h.wave, spin: h.spin,
          vx: h.vx, vy: h.vy, verts: h.verts, maxHp: h.maxHp,
        }))
        .sort((a, b) => a.born - b.born || a.vx - b.vx);
    expect(roster(active)).toEqual(roster(idle));
  });

  it('drifts escalate on a fixed tick schedule', () => {
    const s = runSim(4000, false);
    expect(s.wave).toBe(Math.floor((s.tick - 1) / WAVE_TICKS) + 1);
  });
});
