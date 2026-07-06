// THE RIFT determinism: identical replay, and a surge roster immune to
// player actions. (Flipper lanes mutate via their hop schedules and tanker
// fragments are kill-driven, so the roster comparison uses spawn-invariant
// fields of top-level creatures only.)

import { describe, it, expect } from 'vitest';
import {
  riftInit, riftStep, WAVE_TICKS,
  type RiftState, type RiftStats,
} from '../src/eras/rift/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: RiftStats = {
  cooldown: 14,
  damage: 2,
  pierce: 1,
  harmonics: 1,
  rimSpeed: 0.14,
  sealMaxHp: 14,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0x217f7;

function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 30 !== 0) return [];
  const a = tick * 0.013;
  return [{ t: tick, x: 400 + Math.cos(a) * 250, y: 300 + Math.sin(a) * 200 }];
}

function runSim(ticks: number, withInputs: boolean): RiftState {
  const state = riftInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    riftStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: RiftState): string {
  return JSON.stringify({
    tick: s.tick, wave: s.wave, kills: s.kills, salvage: s.salvage,
    sealHp: s.sealHp, players: s.players, crawlers: s.crawlers,
    bolts: s.bolts, over: s.over,
  });
}

describe('THE RIFT determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(4000, true);
    const b = runSim(4000, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('the surge roster is immune to player actions', () => {
    const idle = runSim(4000, false);
    const active = runSim(4000, true);
    const waves = Math.min(idle.wave, active.wave);
    const cut = waves * WAVE_TICKS;
    const roster = (s: RiftState) =>
      s.crawlers
        .filter((c) => !c.isChild && c.born <= cut)
        .map((c) => ({ born: c.born, kind: c.kind, speed: c.speed, hops: c.hops, maxHp: c.maxHp }))
        .sort((a, b) => a.born - b.born || a.speed - b.speed);
    expect(roster(active)).toEqual(roster(idle));
  });

  it('surges escalate on a fixed tick schedule', () => {
    const s = runSim(4000, false);
    expect(s.wave).toBe(Math.floor((s.tick - 1) / WAVE_TICKS) + 1);
  });
});
