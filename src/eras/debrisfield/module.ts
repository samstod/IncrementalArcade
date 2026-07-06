// Era 6 — 2286 DEBRIS FIELD, packaged behind the EraModule contract.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  debrisInit, debrisStep, debrisSummary,
  type DebrisState, type DebrisStats, DW, DH,
} from './sim';
import { debrisRender } from './render';

const cooldownAt = (lv: number) => Math.max(8, 20 - 2 * lv);

const UPGRADES: UpgradeDef[] = [
  {
    id: 'lasers', name: 'PULSE LASERS',
    desc: 'Ticks between shots',
    baseCost: 16, costMult: 2.7, maxLevel: 6,
    effect: (lv) => `${(cooldownAt(lv) / 60).toFixed(2)}s`,
  },
  {
    id: 'driver', name: 'MASS DRIVER',
    desc: 'Damage per round',
    baseCost: 22, costMult: 3.0, maxLevel: 6,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'salvo', name: 'SALVO RACKS',
    desc: 'Parallel bullet streams',
    baseCost: 70, costMult: 6, maxLevel: 2,
    effect: (lv) => `${1 + lv}`,
  },
  {
    id: 'engines', name: 'ION ENGINES',
    desc: 'Thrust and turn authority',
    baseCost: 18, costMult: 2.8, maxLevel: 6,
    effect: (lv) => `×${(1 + 0.2 * lv).toFixed(1)}`,
  },
  {
    id: 'deflector', name: 'DEFLECTOR GRID',
    desc: 'Colony hull integrity',
    baseCost: 30, costMult: 3.1, maxLevel: 6,
    effect: (lv) => `${12 + 3 * lv} HP`,
  },
  {
    id: 'nano', name: 'NANO REPAIR',
    desc: 'Hull recovered at each drift',
    baseCost: 45, costMult: 3.4, maxLevel: 4,
    effect: (lv) => `+${lv}/wave`,
  },
  {
    id: 'salvageRig', name: 'TRACTOR NETS',
    desc: 'Alloy reclaimed per wreck',
    baseCost: 25, costMult: 3.4, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const debrisEra: EraModule<DebrisState, DebrisStats> = {
  id: 'debris',
  title: '2286 — DEBRIS FIELD',
  short: 'DEBRIS FIELD',
  flavor: 'the fleet is already dead; the wrecks are still incoming',
  salvageName: 'ALLOY',
  inputMode: 'pointer',
  width: DW,
  height: DH,
  unlock: { eraId: 'primeval', wave: 5, cost: 2000 },
  chronoFactor: 9,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): DebrisStats {
    const eng = 1 + 0.2 * (era.engines ?? 0);
    return {
      cooldown: cooldownAt(era.lasers ?? 0),
      damage: (1 + (era.driver ?? 0)) * resonance,
      streams: 1 + (era.salvo ?? 0),
      thrust: 0.08 * eng,
      turnRate: 0.09 * eng,
      colonyMaxHp: 12 + 3 * (era.deflector ?? 0),
      regen: era.nano ?? 0,
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: debrisInit,
  step: debrisStep,
  render: debrisRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: debrisSummary,
};
