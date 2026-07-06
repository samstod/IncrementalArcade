// The era plugin contract. Every time period is one module behind this
// interface: the core loop, recorder, echo system, save, and meta UI are all
// era-agnostic. Adding an era = one folder + one entry in the registry.

import type { InputEvent } from '../core/recorder';
import type { Levels, UpgradeDef } from '../meta/upgrades';

export interface RunSummary {
  wave: number;
  ticks: number;
  kills: number;
  salvage: number;
}

export interface LiveInfo {
  wave: number;
  salvage: number;
}

export interface EraUnlock {
  eraId: string; // era whose depth gates this one
  wave: number;  // required best wave there
  cost: number;  // chronotons to stabilize (buy the era key)
}

export interface EraModule<S = unknown, St = unknown> {
  id: string;
  title: string;      // "1983 — DEFCON LOOP"
  short: string;      // "DEFCON LOOP"
  flavor: string;     // one-liner shown on the timeline map
  salvageName: string; // themed era currency
  /** 'click' eras fire at points; 'pointer' eras steer toward the cursor. */
  inputMode: 'click' | 'pointer';
  /** World coordinate space inputs are quantized into. */
  width: number;
  height: number;
  unlock: EraUnlock | null; // null = available from the start
  chronoFactor: number;     // later eras award more chronotons per wave
  upgrades: UpgradeDef[];

  computeStats(eraLevels: Levels, globalLevels: Levels, resonance: number): St;
  init(seed: number, stats: St, playerCount: number): S;
  step(state: S, inputs: InputEvent[][]): void;
  render(ctx: CanvasRenderingContext2D, state: S): void;
  isOver(state: S): boolean;
  diedAt(state: S): number;
  forceEnd(state: S): void; // manual "collapse timeline"
  liveInfo(state: S): LiveInfo;
  summary(state: S): RunSummary;
}

// ── Registry ─────────────────────────────────────────────────────

import { defconEra } from './missileCommand/module';
import { flakEra } from './flakAlley/module';
import { siegeEra } from './siegebreak/module';
import { broadsideEra } from './broadside/module';
import { primevalEra } from './primeval/module';
import { debrisEra } from './debrisfield/module';
import { riftEra } from './rift/module';

export const ERAS: EraModule<unknown, unknown>[] = [
  defconEra as EraModule<unknown, unknown>,
  flakEra as EraModule<unknown, unknown>,
  siegeEra as EraModule<unknown, unknown>,
  broadsideEra as EraModule<unknown, unknown>,
  primevalEra as EraModule<unknown, unknown>,
  debrisEra as EraModule<unknown, unknown>,
  riftEra as EraModule<unknown, unknown>,
];

export function eraById(id: string): EraModule<unknown, unknown> {
  const era = ERAS.find((e) => e.id === id);
  if (!era) throw new Error(`unknown era: ${id}`);
  return era;
}

/** Designed-but-unbuilt eras, teased on the monitor wall. All built! */
export const TEASERS: { title: string; hint: string }[] = [];
