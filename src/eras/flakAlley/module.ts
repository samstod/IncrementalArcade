// Era 2 — 1944 FLAK ALLEY, packaged behind the EraModule contract.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  flakInit, flakStep, flakSummary,
  type FlakState, type FlakStats, FW, FH,
} from './sim';
import { flakRender } from './render';

const cooldownAt = (lv: number) => Math.max(8, 24 - 2 * lv);

const UPGRADES: UpgradeDef[] = [
  {
    id: 'fireRate', name: 'RATE OF FIRE',
    desc: 'Ticks between automatic shots',
    baseCost: 15, costMult: 2.7, maxLevel: 8,
    effect: (lv) => `${(cooldownAt(lv) / 60).toFixed(2)}s`,
  },
  {
    id: 'shellSpeed', name: 'MUZZLE VELOCITY',
    desc: 'Shell climb speed',
    baseCost: 14, costMult: 3.4, maxLevel: 8,
    effect: (lv) => `${(2.2 + 0.25 * lv).toFixed(2)} px/t`,
  },
  {
    id: 'damage', name: 'AP ROUNDS',
    desc: 'Damage per shell',
    baseCost: 22, costMult: 3.0, maxLevel: 5,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'fuze', name: 'PROXIMITY FUZE',
    desc: 'Shells burst, splashing nearby planes for half damage',
    baseCost: 35, costMult: 3.3, maxLevel: 6,
    effect: (lv) => (lv === 0 ? 'direct hits only' : `${3 + 3 * lv}px burst`),
  },
  {
    id: 'armor', name: 'DECK PLATING',
    desc: 'Carrier hull integrity',
    baseCost: 28, costMult: 3.1, maxLevel: 6,
    effect: (lv) => `${10 + 2 * lv} HP`,
  },
  {
    id: 'barrels', name: 'TWIN MOUNT',
    desc: 'Parallel barrels per shot',
    baseCost: 70, costMult: 7, maxLevel: 2,
    effect: (lv) => `${1 + lv} barrels`,
  },
  {
    id: 'salvageRig', name: 'BRASS COLLECTORS',
    desc: 'Casings recovered per kill',
    baseCost: 25, costMult: 3.4, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const flakEra: EraModule<FlakState, FlakStats> = {
  id: 'flak',
  title: '1944 — FLAK ALLEY',
  short: 'FLAK ALLEY',
  flavor: 'dive bombers vs one carrier deck; steer, the gun never stops',
  salvageName: 'CASINGS',
  inputMode: 'pointer',
  overlay: 'none',
  width: FW,
  height: FH,
  unlock: { eraId: 'defcon', wave: 5, cost: 60 },
  chronoFactor: 1.6,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): FlakStats {
    return {
      cooldown: cooldownAt(era.fireRate ?? 0),
      shellSpeed: 2.2 + 0.25 * (era.shellSpeed ?? 0),
      damage: (1 + (era.damage ?? 0)) * resonance,
      burstRadius: (era.fuze ?? 0) === 0 ? 0 : 3 + 3 * (era.fuze ?? 0),
      carrierMaxHp: 10 + 2 * (era.armor ?? 0),
      barrels: 1 + (era.barrels ?? 0),
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: flakInit,
  step: flakStep,
  render: flakRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: flakSummary,
};
