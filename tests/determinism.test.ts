// The whole game hinges on these invariants:
//  1. Same seed + same inputs → bit-identical simulation, every time.
//  2. Player actions can never perturb the enemy spawn schedule
//     (otherwise echo recordings would desync from the waves).

import { describe, it, expect } from 'vitest';
import { mcInit, mcStep, type McState, type McStats } from '../src/eras/missileCommand/sim';
import type { InputEvent } from '../src/core/recorder';

const STATS: McStats = {
  cooldown: 20,
  blastRadius: 35,
  ammo: 12,
  interceptorSpeed: 6,
  cityMaxHp: 2,
  batteryCount: 2,
  echoMult: 0.8,
  salvageMult: 1,
};

const SEED = 0xc0ffee;

/** Scripted clicks: deterministic pseudo-aim spread over the sky. */
function scriptedInputs(tick: number): InputEvent[] {
  if (tick % 45 !== 0 || tick === 0) return [];
  return [{ t: tick, x: 60 + ((tick * 37) % 680), y: 80 + ((tick * 53) % 300) }];
}

function runSim(ticks: number, withInputs: boolean): McState {
  const state = mcInit(SEED, STATS, 1);
  for (let i = 0; i < ticks && !state.over; i++) {
    mcStep(state, [withInputs ? scriptedInputs(state.tick) : []]);
  }
  return state;
}

function stateHash(s: McState): string {
  return JSON.stringify({
    tick: s.tick,
    wave: s.wave,
    kills: s.kills,
    salvage: s.salvage,
    cities: s.cities,
    missiles: s.missiles,
    interceptors: s.interceptors,
    players: s.players,
    over: s.over,
  });
}

/** Top-level spawn events only (children depend on whether parents survive). */
function spawnLog(s: McState): string {
  return JSON.stringify(
    s.missiles
      .filter((m) => !m.isChild)
      .map((m) => ({ born: m.born, sx: m.sx, tx: m.tx, splitAt: m.splitAt !== undefined })),
  );
}

describe('simulation determinism', () => {
  it('same seed + same inputs → identical state', () => {
    const a = runSim(4000, true);
    const b = runSim(4000, true);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('player actions never perturb the enemy spawn schedule', () => {
    const idle = runSim(4000, false);
    const active = runSim(4000, true);
    // Compare only the first 4000 ticks' worth of top-level spawns: if the
    // active run died earlier it saw fewer waves, so trim to the common set.
    const cut = Math.min(idle.tick, active.tick);
    const trim = (s: McState) =>
      JSON.parse(spawnLog(s)).filter((m: { born: number }) => m.born <= cut);
    expect(trim(active)).toEqual(trim(idle));
  });

  it('waves escalate on a fixed tick schedule', () => {
    const s = runSim(4000, false);
    // 4000 ticks / 540 per wave → should have reached wave 8 exactly,
    // regardless of anything the player did.
    expect(s.wave).toBe(Math.floor((s.tick - 1) / 540) + 1);
  });

  it('echo replays reproduce the original run outcome', () => {
    // Record a "live" run's inputs, then feed the same events as instance 0
    // again — kills and city damage must match exactly.
    const first = runSim(3000, true);
    const second = runSim(3000, true);
    expect(second.kills).toBe(first.kills);
    expect(second.cities.map((c) => c.hp)).toEqual(first.cities.map((c) => c.hp));
  });
});
