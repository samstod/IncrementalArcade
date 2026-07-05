// Balance probe, not a pass/fail suite: plays every era headlessly with a
// simple bot and reports the wave each build dies on. Run with:
//
//   BALANCE=1 npx vitest run tests/balance.report.test.ts
//
// Rough targets (solo, no echoes): a fresh build should die around waves
// 2–5; a mid-invested build around waves 6–12. Way outside that band means
// a curve needs retuning.

import { describe, it } from 'vitest';
import { mcInit, mcStep, projPos, GROUND, type McStats } from '../src/eras/missileCommand/sim';
import { flakInit, flakStep, planePos, type FlakStats } from '../src/eras/flakAlley/sim';
import { siegeInit, siegeStep, unitPos, type SiegeStats } from '../src/eras/siegebreak/sim';
import { broadInit, broadStep, mortarY, BW as BROAD_W, type BroadStats } from '../src/eras/broadside/sim';
import type { InputEvent } from '../src/core/recorder';

const RUN = process.env.BALANCE === '1';
const MAX_TICKS = 60 * 60 * 12; // 12 minutes of sim time

function mcBot(reactEvery: number) {
  return (state: ReturnType<typeof mcInit>, t: number): InputEvent[] => {
    if (t % reactEvery !== 0) return [];
    let best: { x: number; y: number } | null = null;
    for (const m of state.missiles) {
      if (!m.alive) continue;
      const p = projPos(m, t);
      if (p.y < 40 || p.y > GROUND - 80) continue;
      if (!best || p.y > best.y) best = p;
    }
    // Lead the shot: aim a bit below the current position.
    return best ? [{ t, x: best.x, y: Math.min(best.y + 50, GROUND - 60) }] : [];
  };
}

function flakBot(reactEvery: number) {
  return (state: ReturnType<typeof flakInit>, t: number): InputEvent[] => {
    if (t % reactEvery !== 0) return [];
    let best: { x: number; y: number } | null = null;
    for (const p of state.planes) {
      if (!p.alive) continue;
      const pos = planePos(p, t);
      if (pos.y < 0) continue;
      if (!best || pos.y > best.y) best = pos;
    }
    return best ? [{ t, x: best.x, y: 0 }] : [];
  };
}

function siegeBot(reactEvery: number) {
  return (state: ReturnType<typeof siegeInit>, t: number): InputEvent[] => {
    if (t % reactEvery !== 0) return [];
    let best: { x: number; y: number } | null = null;
    for (const u of state.units) {
      if (!u.alive) continue;
      const pos = unitPos(state, u);
      if (!best || pos.y > best.y) best = pos;
    }
    return best ? [{ t, x: best.x, y: 0 }] : [];
  };
}

function broadBot(reactEvery: number) {
  return (state: ReturnType<typeof broadInit>, t: number): InputEvent[] => {
    if (t % reactEvery !== 0) return [];
    // Dodge incoming mortars first, then chase our lowest falling ball.
    const p = state.players[0];
    for (const m of state.mortars) {
      if (!m.alive) continue;
      const y = mortarY(m, t);
      if (y > 380 && Math.abs(m.x - p.x) < 60)
        return [{ t, x: m.x > p.x ? Math.max(30, p.x - 120) : Math.min(BROAD_W - 30, p.x + 120), y: 0 }];
    }
    let best: { x: number; y: number } | null = null;
    for (const b of state.balls) {
      if (!b.alive || b.owner !== 0 || b.vy <= 0) continue;
      if (!best || b.y > best.y) best = b;
    }
    return best ? [{ t, x: best.x, y: 0 }] : [{ t, x: BROAD_W / 2, y: 0 }];
  };
}

interface Probe<S> {
  name: string;
  init: () => S;
  step: (s: S, inputs: InputEvent[][]) => void;
  bot: (s: S, t: number) => InputEvent[];
  wave: (s: S) => number;
  over: (s: S) => boolean;
  tick: (s: S) => number;
}

function run<S>(p: Probe<S>): string {
  const s = p.init();
  while (!p.over(s) && p.tick(s) < MAX_TICKS) {
    p.step(s, [p.bot(s, p.tick(s))]);
  }
  const mins = (p.tick(s) / 3600).toFixed(1);
  return `${p.name}: died wave ${p.wave(s)} after ${mins}min${p.over(s) ? '' : ' (SURVIVED CAP — too easy)'}`;
}

const MC_T0: McStats = { cooldown: 36, blastRadius: 28, ammo: 8, interceptorSpeed: 5, cityMaxHp: 1, batteryCount: 1, echoMult: 0.7, salvageMult: 1 };
const MC_MID: McStats = { cooldown: 20, blastRadius: 56, ammo: 14, interceptorSpeed: 7.7, cityMaxHp: 3, batteryCount: 2, echoMult: 0.7, salvageMult: 1 };
const FLAK_T0: FlakStats = { cooldown: 24, shellSpeed: 2.2, damage: 1, burstRadius: 0, carrierMaxHp: 10, barrels: 1, echoMult: 0.7, salvageMult: 1 };
const FLAK_MID: FlakStats = { cooldown: 16, shellSpeed: 3.2, damage: 3, burstRadius: 9, carrierMaxHp: 14, barrels: 2, echoMult: 0.7, salvageMult: 1 };
const SIEGE_T0: SiegeStats = { reload: 78, boltDamage: 1, pierce: 0, moveSpeed: 4, gateMaxHp: 10, merlonMaxHp: 4, echoMult: 0.7, salvageMult: 1 };
const SIEGE_MID: SiegeStats = { reload: 50, boltDamage: 3, pierce: 2, moveSpeed: 6.4, gateMaxHp: 16, merlonMaxHp: 8, echoMult: 0.7, salvageMult: 1 };
const BROAD_T0: BroadStats = { ballDamage: 1, halfWidth: 34, paddleSpeed: 5, hullMaxHp: 10, reload: 180, maxBalls: 2, echoMult: 0.7, salvageMult: 1 };
const BROAD_MID: BroadStats = { ballDamage: 3, halfWidth: 49, paddleSpeed: 8.3, hullMaxHp: 16, reload: 126, maxBalls: 3, echoMult: 0.7, salvageMult: 1 };

describe.runIf(RUN)('balance report', () => {
  it('prints death waves per era and tier', () => {
    const lines = [
      run({ name: 'DEFCON  t0  casual', init: () => mcInit(1, MC_T0, 1), step: mcStep, bot: mcBot(28), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'DEFCON  t0  skilled', init: () => mcInit(1, MC_T0, 1), step: mcStep, bot: mcBot(14), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'DEFCON  mid skilled', init: () => mcInit(1, MC_MID, 1), step: mcStep, bot: mcBot(14), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'FLAK    t0  casual', init: () => flakInit(2, FLAK_T0, 1), step: flakStep, bot: flakBot(20), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'FLAK    t0  skilled', init: () => flakInit(2, FLAK_T0, 1), step: flakStep, bot: flakBot(8), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'FLAK    mid skilled', init: () => flakInit(2, FLAK_MID, 1), step: flakStep, bot: flakBot(8), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'SIEGE   t0  casual', init: () => siegeInit(3, SIEGE_T0, 1), step: siegeStep, bot: siegeBot(24), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'SIEGE   t0  skilled', init: () => siegeInit(3, SIEGE_T0, 1), step: siegeStep, bot: siegeBot(10), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'SIEGE   mid skilled', init: () => siegeInit(3, SIEGE_MID, 1), step: siegeStep, bot: siegeBot(10), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'BROAD   t0  casual', init: () => broadInit(4, BROAD_T0, 1), step: broadStep, bot: broadBot(18), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'BROAD   t0  skilled', init: () => broadInit(4, BROAD_T0, 1), step: broadStep, bot: broadBot(6), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
      run({ name: 'BROAD   mid skilled', init: () => broadInit(4, BROAD_MID, 1), step: broadStep, bot: broadBot(6), wave: (s) => s.wave, over: (s) => s.over, tick: (s) => s.tick }),
    ];
    console.log('\n' + lines.join('\n') + '\n');
  }, 120_000);
});
