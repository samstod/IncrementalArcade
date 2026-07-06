import { describe, it, expect } from 'vitest';
import { IdleRunner } from '../src/meta/idle';
import { defconEra } from '../src/eras/missileCommand/module';
import { defaultSave, eraSave } from '../src/meta/save';
import type { EraModule } from '../src/eras/era';

describe('idle runner', () => {
  it('completes loops and banks income from a short recording', () => {
    const save = defaultSave();
    const es = eraSave(save, 'defcon');
    // Max blast radius + a spray of shots across the sky over ~35s: this
    // ghost reliably kills something, so salvage banking is exercised too.
    es.levels = { blast: 10, ammo: 10 };
    es.recordings.push({
      events: Array.from({ length: 40 }, (_, i) => ({
        t: 120 + i * 50,
        x: 60 + ((i * 137) % 680),
        y: 140 + ((i * 71) % 240),
      })),
      endTick: 2200,
      wave: 4,
    });
    const runner = new IdleRunner(defconEra as unknown as EraModule, save);
    runner.start();
    expect(runner.state).toBeTruthy();
    for (let i = 0; i < 2000 && runner.loops === 0; i++) runner.step(16);
    console.log('loops:', runner.loops, 'banked:', JSON.stringify(runner.banked),
      'ticks at end:', (runner.state as { tick: number } | null)?.tick,
      'idleTicks:', es.idleTicks);
    expect(runner.loops).toBeGreaterThan(0);
    expect(save.chronotons).toBeGreaterThan(0);
    // Small loops must still bank fractional salvage, not floor to zero.
    expect(es.salvage).toBeGreaterThan(0);
  });
});
