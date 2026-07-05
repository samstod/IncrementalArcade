// Era 3 — 1250 SIEGEBREAK, packaged behind the EraModule contract.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  siegeInit, siegeStep, siegeSummary,
  type SiegeState, type SiegeStats, SW, SH,
} from './sim';
import { siegeRender } from './render';

const reloadAt = (lv: number) => Math.max(30, 78 - 7 * lv);

const UPGRADES: UpgradeDef[] = [
  {
    id: 'reload', name: 'WINDLASS CREW',
    desc: 'Time to crank the next bolt',
    baseCost: 15, costMult: 1.9, maxLevel: 8,
    effect: (lv) => `${(reloadAt(lv) / 60).toFixed(2)}s`,
  },
  {
    id: 'boltDamage', name: 'STEEL BOLTS',
    desc: 'Damage per quarrel',
    baseCost: 20, costMult: 2.0, maxLevel: 6,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'pierce', name: 'PUNCH THROUGH',
    desc: 'Extra ranks one bolt passes through',
    baseCost: 40, costMult: 2.6, maxLevel: 4,
    effect: (lv) => (lv === 0 ? 'stops on impact' : `+${lv} ranks`),
  },
  {
    id: 'rails', name: 'GREASED RAILS',
    desc: 'Ballista slide speed along the battlements',
    baseCost: 16, costMult: 1.8, maxLevel: 6,
    effect: (lv) => `${(4 + 1.2 * lv).toFixed(1)} px/t`,
  },
  {
    id: 'gate', name: 'GATE BRACING',
    desc: 'Gate timbers before the wall falls',
    baseCost: 30, costMult: 2.2, maxLevel: 6,
    effect: (lv) => `${10 + 3 * lv} HP`,
  },
  {
    id: 'masons', name: 'MASONS',
    desc: 'Merlon stone, rebuilt at each assault',
    baseCost: 24, costMult: 2.1, maxLevel: 6,
    effect: (lv) => `${4 + 2 * lv} HP`,
  },
  {
    id: 'salvageRig', name: 'PLUNDER CARTS',
    desc: 'Timber looted per kill',
    baseCost: 25, costMult: 2.5, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const siegeEra: EraModule<SiegeState, SiegeStats> = {
  id: 'siege',
  title: '1250 — SIEGEBREAK',
  short: 'SIEGEBREAK',
  flavor: 'ranks of steel advance on the wall; the gate is all that matters',
  salvageName: 'TIMBER',
  inputMode: 'pointer',
  width: SW,
  height: SH,
  unlock: { eraId: 'flak', wave: 5, cost: 150 },
  chronoFactor: 2.5,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): SiegeStats {
    return {
      reload: reloadAt(era.reload ?? 0),
      boltDamage: (1 + (era.boltDamage ?? 0)) * resonance,
      pierce: era.pierce ?? 0,
      moveSpeed: 4 + 1.2 * (era.rails ?? 0),
      gateMaxHp: 10 + 3 * (era.gate ?? 0),
      merlonMaxHp: 4 + 2 * (era.masons ?? 0),
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: siegeInit,
  step: siegeStep,
  render: siegeRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: siegeSummary,
};
