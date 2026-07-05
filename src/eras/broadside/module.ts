// Era 4 — 1720 BROADSIDE, packaged behind the EraModule contract.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  broadInit, broadStep, broadSummary,
  type BroadState, type BroadStats, BW, BH,
} from './sim';
import { broadRender } from './render';

const reloadAt = (lv: number) => Math.max(60, 180 - 18 * lv);

const UPGRADES: UpgradeDef[] = [
  {
    id: 'shot', name: 'CHAIN SHOT',
    desc: 'Damage per cannonball strike',
    baseCost: 18, costMult: 2.0, maxLevel: 6,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'hullWidth', name: 'BROAD HULL',
    desc: 'Ship beam — your catching surface',
    baseCost: 16, costMult: 1.9, maxLevel: 6,
    effect: (lv) => `${(34 + 5 * lv) * 2}px`,
  },
  {
    id: 'sails', name: 'FULL SAILS',
    desc: 'Tacking speed along the line',
    baseCost: 14, costMult: 1.8, maxLevel: 6,
    effect: (lv) => `${(5 + 1.1 * lv).toFixed(1)} px/t`,
  },
  {
    id: 'frames', name: 'HULL FRAMES',
    desc: 'Planking before the ship founders',
    baseCost: 30, costMult: 2.2, maxLevel: 6,
    effect: (lv) => `${10 + 3 * lv} HP`,
  },
  {
    id: 'monkeys', name: 'POWDER MONKEYS',
    desc: 'Time to run out a fresh cannonball',
    baseCost: 20, costMult: 2.0, maxLevel: 6,
    effect: (lv) => `${(reloadAt(lv) / 60).toFixed(1)}s`,
  },
  {
    id: 'grapeshot', name: 'GRAPESHOT LOCKER',
    desc: 'Cannonballs one ship can keep in the air',
    baseCost: 55, costMult: 3.5, maxLevel: 2,
    effect: (lv) => `${2 + lv} balls`,
  },
  {
    id: 'salvageRig', name: 'SALVAGE NETS',
    desc: 'Doubloons trawled per brick',
    baseCost: 25, costMult: 2.5, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const broadsideEra: EraModule<BroadState, BroadStats> = {
  id: 'broadside',
  title: '1720 — BROADSIDE',
  short: 'BROADSIDE',
  flavor: 'a fortress. a cannonball. arithmetic — and the wall grows back',
  salvageName: 'DOUBLOONS',
  inputMode: 'pointer',
  width: BW,
  height: BH,
  unlock: { eraId: 'siege', wave: 5, cost: 350 },
  chronoFactor: 4,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): BroadStats {
    return {
      ballDamage: (1 + (era.shot ?? 0)) * resonance,
      halfWidth: 34 + 5 * (era.hullWidth ?? 0),
      paddleSpeed: 5 + 1.1 * (era.sails ?? 0),
      hullMaxHp: 10 + 3 * (era.frames ?? 0),
      reload: reloadAt(era.monkeys ?? 0),
      maxBalls: 2 + (era.grapeshot ?? 0),
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: broadInit,
  step: broadStep,
  render: broadRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: broadSummary,
};
