// Era 7 — END OF TIME: THE RIFT, packaged behind the EraModule contract.
// The final era: highest chronoton factor, priciest unlock, the place all
// the global multipliers converge.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  riftInit, riftStep, riftSummary,
  type RiftState, type RiftStats, RW, RH,
} from './sim';
import { riftRender } from './render';

const cooldownAt = (lv: number) => Math.max(9, 22 - 2 * lv);

const UPGRADES: UpgradeDef[] = [
  {
    id: 'bolts', name: 'PHASE BOLTS',
    desc: 'Ticks between bolts',
    baseCost: 18, costMult: 2.7, maxLevel: 6,
    effect: (lv) => `${(cooldownAt(lv) / 60).toFixed(2)}s`,
  },
  {
    id: 'shatter', name: 'SHATTER ROUNDS',
    desc: 'Damage per bolt',
    baseCost: 24, costMult: 3.0, maxLevel: 6,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'lance', name: 'ENTROPY LANCE',
    desc: 'Creatures one bolt passes through',
    baseCost: 55, costMult: 3.6, maxLevel: 3,
    effect: (lv) => (lv === 0 ? 'stops on impact' : `+${lv}`),
  },
  {
    id: 'harmonics', name: 'LANE HARMONICS',
    desc: 'Bolts resonate into flanking lanes for half damage',
    baseCost: 60, costMult: 3.8, maxLevel: 3,
    effect: (lv) => (lv === 0 ? 'one lane' : `±${lv} lanes`),
  },
  {
    id: 'grip', name: 'RAIL GRIP',
    desc: 'Rim slide speed',
    baseCost: 16, costMult: 2.7, maxLevel: 6,
    effect: (lv) => `${(0.1 + 0.03 * lv).toFixed(2)} lanes/t`,
  },
  {
    id: 'wards', name: 'SEAL WARDS',
    desc: 'Continuum Seal integrity',
    baseCost: 34, costMult: 3.1, maxLevel: 6,
    effect: (lv) => `${10 + 3 * lv} HP`,
  },
  {
    id: 'salvageRig', name: 'PRISM NETS',
    desc: 'Fragments condensed per kill',
    baseCost: 28, costMult: 3.4, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const riftEra: EraModule<RiftState, RiftStats> = {
  id: 'rift',
  title: 'END OF TIME — THE RIFT',
  short: 'THE RIFT',
  flavor: 'the source of the Unraveling; hold the seal, hold everything',
  salvageName: 'FRAGMENTS',
  inputMode: 'pointer',
  overlay: 'crt',
  width: RW,
  height: RH,
  unlock: { eraId: 'debris', wave: 5, cost: 5000 },
  chronoFactor: 14,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): RiftStats {
    return {
      cooldown: cooldownAt(era.bolts ?? 0),
      damage: (1 + (era.shatter ?? 0)) * resonance,
      pierce: era.lance ?? 0,
      harmonics: era.harmonics ?? 0,
      rimSpeed: 0.1 + 0.03 * (era.grip ?? 0),
      sealMaxHp: 10 + 3 * (era.wards ?? 0),
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: riftInit,
  step: riftStep,
  render: riftRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: riftSummary,
};
