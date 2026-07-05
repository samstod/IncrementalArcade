// Same invariants as Era 1, for FLAK ALLEY: identical replay, and a plane
// spawn schedule that player actions cannot perturb.

import { describe, it, expect } from 'vitest';
import {
  flakInit, flakStep, WAVE_TICKS,
  type FlakState, type FlakStats,
} from '../src/eras/flakAlley/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: FlakStats = {
  cooldown: 16,
  shellSpeed: 2.6,
  damage: 2,
  burstRadius: 6,
  carrierMaxHp: 10,
  barrels: 2,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0xf1ac;

/** Scripted steering: sweep the gun back and forth across the deck. */
function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 30 !== 0) return [];
  return [{ t: tick, x: 20 + ((tick * 7) % 216), y: 0 }];
}

function runSim(ticks: number, withInputs: boolean): FlakState {
  const state = flakInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    flakStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: FlakState): string {
  return JSON.stringify({
    tick: s.tick,
    wave: s.wave,
    kills: s.kills,
    salvage: s.salvage,
    carrierHp: s.carrierHp,
    players: s.players,
    planes: s.planes,
    shells: s.shells,
    bombs: s.bombs,
    over: s.over,
  });
}

/** Spawn parameters only — hp/alive are defense outcomes, not schedule. */
function spawnLog(s: FlakState, cut: number) {
  return s.planes
    .filter((p) => p.born <= cut)
    .map((p) => ({
      born: p.born, x0: p.x0, amp: p.amp, freq: p.freq, phase: p.phase,
      drift: p.drift, vy: p.vy, diveAt: p.diveAt, bomber: p.bomber,
      bombTicks: p.bombTicks, maxHp: p.maxHp,
    }));
}

describe('FLAK ALLEY determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(3500, true);
    const b = runSim(3500, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('player actions never perturb the plane spawn schedule', () => {
    const idle = runSim(3500, false);
    const active = runSim(3500, true);
    const cut = Math.min(idle.tick, active.tick);
    expect(spawnLog(active, cut)).toEqual(spawnLog(idle, cut));
  });

  it('waves escalate on a fixed tick schedule', () => {
    const s = runSim(3500, false);
    expect(s.wave).toBe(Math.floor((s.tick - 1) / WAVE_TICKS) + 1);
  });
});
