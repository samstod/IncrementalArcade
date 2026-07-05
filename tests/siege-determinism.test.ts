// SIEGEBREAK determinism: identical replay, and formation + volley schedules
// that player actions cannot perturb. (Formation SPEED depends on kills —
// the classic Invaders accelerando — so positions diverge; the spawn rosters
// and volley orders must not.)

import { describe, it, expect } from 'vitest';
import {
  siegeInit, siegeStep, WAVE_TICKS,
  type SiegeState, type SiegeStats,
} from '../src/eras/siegebreak/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: SiegeStats = {
  reload: 50,
  boltDamage: 2,
  pierce: 1,
  moveSpeed: 5,
  gateMaxHp: 12,
  merlonMaxHp: 6,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0x51e6e;

function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 40 !== 0) return [];
  return [{ t: tick, x: 60 + ((tick * 11) % 680), y: 0 }];
}

function runSim(ticks: number, withInputs: boolean): SiegeState {
  const state = siegeInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    siegeStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: SiegeState): string {
  return JSON.stringify({
    tick: s.tick, wave: s.wave, kills: s.kills, salvage: s.salvage,
    gateHp: s.gateHp, merlons: s.merlons, players: s.players,
    formations: s.formations, units: s.units, bolts: s.bolts,
    arrows: s.arrows, over: s.over,
  });
}

describe('SIEGEBREAK determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(4000, true);
    const b = runSim(4000, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('unit rosters and volley schedule are immune to player actions', () => {
    const idle = runSim(4000, false);
    const active = runSim(4000, true);
    const cut = Math.min(idle.tick, active.tick);
    const roster = (s: SiegeState) =>
      s.units.map((u) => ({ f: u.formation, col: u.col, row: u.row, kind: u.kind, maxHp: u.maxHp }));
    const volleys = (s: SiegeState) => s.volleys.filter((v) => v.tick <= cut);
    // Trim to the same number of waves spawned in both runs.
    const waves = Math.min(idle.wave, active.wave);
    const trimRoster = (s: SiegeState) => roster(s).filter((u) => u.f < waves);
    expect(trimRoster(active)).toEqual(trimRoster(idle));
    expect(volleys(active)).toEqual(volleys(idle));
  });

  it('assaults escalate on a fixed tick schedule', () => {
    const s = runSim(4000, false);
    expect(s.wave).toBe(Math.floor((s.tick - 1) / WAVE_TICKS) + 1);
  });
});
