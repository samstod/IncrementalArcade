// Era 5 — PREHISTORY PRIMEVAL, packaged behind the EraModule contract.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  primevalInit, primevalStep, primevalSummary,
  type PrimevalState, type PrimevalStats, PW, PH,
} from './sim';
import { primevalRender } from './render';

const UPGRADES: UpgradeDef[] = [
  {
    id: 'brothers', name: 'SPEAR BROTHERS',
    desc: 'Spears one hunter may have in the air',
    baseCost: 45, costMult: 5, maxLevel: 2,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'arms', name: 'QUICK ARMS',
    desc: 'Spear flight speed (faster spears = faster rethrows)',
    baseCost: 15, costMult: 2.7, maxLevel: 8,
    effect: (lv) => `${(3 + 0.5 * lv).toFixed(1)} px/t`,
  },
  {
    id: 'flint', name: 'SHARP FLINT',
    desc: 'Spear damage — fleas and spiders die faster',
    baseCost: 20, costMult: 3.0, maxLevel: 4,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'fire', name: 'FIRE-HARDENED',
    desc: 'Spears clear a fern in a single strike',
    baseCost: 60, costMult: 1, maxLevel: 1,
    effect: (lv) => (lv > 0 ? 'one strike' : 'two strikes'),
  },
  {
    id: 'totems', name: 'TOTEM WARDS',
    desc: 'The tribe endures more burrows and bites',
    baseCost: 30, costMult: 3.1, maxLevel: 6,
    effect: (lv) => `${8 + 2 * lv} HP`,
  },
  {
    id: 'feet', name: 'FLEET FEET',
    desc: 'Hunter speed across the hunting ground',
    baseCost: 14, costMult: 3.4, maxLevel: 6,
    effect: (lv) => `${(2 + 0.4 * lv).toFixed(1)} px/t`,
  },
  {
    id: 'salvageRig', name: 'BONE CHARMS',
    desc: 'Amber gathered per kill',
    baseCost: 25, costMult: 3.4, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const primevalEra: EraModule<PrimevalState, PrimevalStats> = {
  id: 'primeval',
  title: 'PREHISTORY — PRIMEVAL',
  short: 'PRIMEVAL',
  flavor: 'something long is coming downhill, and it splits when you cut it',
  salvageName: 'AMBER',
  inputMode: 'pointer',
  width: PW,
  height: PH,
  unlock: { eraId: 'broadside', wave: 5, cost: 800 },
  chronoFactor: 6,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): PrimevalStats {
    return {
      maxSpears: 1 + (era.brothers ?? 0),
      spearSpeed: 3 + 0.5 * (era.arms ?? 0),
      spearDamage: (1 + (era.flint ?? 0)) * resonance,
      fernDamage: (era.fire ?? 0) > 0 ? 2 : 1,
      tribeMaxHp: 8 + 2 * (era.totems ?? 0),
      hunterSpeed: 2 + 0.4 * (era.feet ?? 0),
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: primevalInit,
  step: primevalStep,
  render: primevalRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: primevalSummary,
};
