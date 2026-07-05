// PRIMEVAL determinism: identical replay, and flea/spider schedules immune
// to player actions. (Pede routing reacts to the fern field, which reflects
// kills — defense-outcome divergence, like the Invaders accelerando.)

import { describe, it, expect } from 'vitest';
import {
  primevalInit, primevalStep, WAVE_TICKS,
  type PrimevalState, type PrimevalStats,
} from '../src/eras/primeval/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: PrimevalStats = {
  maxSpears: 2,
  spearSpeed: 4,
  spearDamage: 2,
  fernDamage: 2,
  tribeMaxHp: 10,
  hunterSpeed: 3,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0x9e0917;

function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 30 !== 0) return [];
  return [{ t: tick, x: 10 + ((tick * 7) % 140), y: 90 + ((tick * 3) % 28) }];
}

function runSim(ticks: number, withInputs: boolean): PrimevalState {
  const state = primevalInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    primevalStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: PrimevalState): string {
  return JSON.stringify({
    tick: s.tick, wave: s.wave, kills: s.kills, salvage: s.salvage,
    tribeHp: s.tribeHp, ferns: s.ferns, segments: s.segments,
    fleas: s.fleas, spiders: s.spiders, spears: s.spears,
    players: s.players, over: s.over,
  });
}

describe('PRIMEVAL determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(4000, true);
    const b = runSim(4000, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('flea and spider schedules are immune to player actions', () => {
    const idle = runSim(4000, false);
    const active = runSim(4000, true);
    const waves = Math.min(idle.wave, active.wave);
    const cut = waves * WAVE_TICKS;
    const fleas = (s: PrimevalState) =>
      s.fleas.filter((f) => f.born <= cut).map((f) => ({ born: f.born, x: f.x, plantRows: f.plantRows }));
    const spiders = (s: PrimevalState) =>
      s.spiders.filter((sp) => sp.born <= cut).map((sp) => ({ born: sp.born, x0: sp.x0, vx: sp.vx, vy: sp.vy }));
    expect(fleas(active)).toEqual(fleas(idle));
    expect(spiders(active)).toEqual(spiders(idle));
  });

  it('hunts escalate on a fixed tick schedule', () => {
    const s = runSim(4000, false);
    expect(s.wave).toBe(Math.floor((s.tick - 1) / WAVE_TICKS) + 1);
  });
});
