// Era 1 — 1983 DEFCON LOOP, packaged behind the EraModule contract.

import type { EraModule } from '../era';
import type { UpgradeDef, Levels } from '../../meta/upgrades';
import { echoPowerMult } from '../../meta/upgrades';
import {
  mcInit, mcStep, mcSummary,
  type McState, type McStats, W, H,
} from './sim';
import { mcRender } from './render';

const cooldownAt = (lv: number) => Math.max(6, 36 - 4 * lv);

const UPGRADES: UpgradeDef[] = [
  {
    id: 'fireRate', name: 'RAPID LAUNCH',
    desc: 'Battery cooldown between interceptors',
    baseCost: 15, costMult: 2.7, maxLevel: 8,
    effect: (lv) => `${(cooldownAt(lv) / 60).toFixed(2)}s`,
  },
  {
    id: 'blast', name: 'WARHEAD YIELD',
    desc: 'Interceptor blast radius',
    baseCost: 20, costMult: 2.7, maxLevel: 10,
    effect: (lv) => `${28 + 7 * lv}px`,
  },
  {
    id: 'ammo', name: 'STOCKPILE',
    desc: 'Interceptors per battery, per wave',
    baseCost: 12, costMult: 2.4, maxLevel: 10,
    effect: (lv) => `${8 + 2 * lv}`,
  },
  {
    id: 'speed', name: 'SOLID FUEL',
    desc: 'Interceptor flight speed',
    baseCost: 18, costMult: 3.4, maxLevel: 8,
    effect: (lv) => `${(5 + 0.9 * lv).toFixed(1)} px/t`,
  },
  {
    id: 'cityHp', name: 'CIVIL DEFENSE',
    desc: 'Each city survives extra hits',
    baseCost: 30, costMult: 3.1, maxLevel: 5,
    effect: (lv) => `${1 + lv} HP`,
  },
  {
    id: 'battery', name: 'SILO NETWORK',
    desc: 'Additional missile battery',
    baseCost: 60, costMult: 7, maxLevel: 2,
    effect: (lv) => `${1 + lv} batteries`,
  },
  {
    id: 'salvageRig', name: 'SCRAP TEAMS',
    desc: 'Salvage recovered per kill',
    baseCost: 25, costMult: 3.4, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },
];

export const defconEra: EraModule<McState, McStats> = {
  id: 'defcon',
  title: '1983 — DEFCON LOOP',
  short: 'DEFCON LOOP',
  flavor: 'six cities, endless ICBM rain, no victory condition',
  salvageName: 'SCRAP',
  inputMode: 'click',
  overlay: 'crt',
  width: W,
  height: H,
  unlock: null,
  chronoFactor: 1,
  upgrades: UPGRADES,

  computeStats(era: Levels, global: Levels, resonance: number): McStats {
    return {
      cooldown: cooldownAt(era.fireRate ?? 0),
      blastRadius: (28 + 7 * (era.blast ?? 0)) * resonance,
      ammo: 8 + 2 * (era.ammo ?? 0),
      interceptorSpeed: 5 + 0.9 * (era.speed ?? 0),
      cityMaxHp: 1 + (era.cityHp ?? 0),
      batteryCount: 1 + (era.battery ?? 0),
      echoMult: echoPowerMult(global),
      salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
    };
  },

  init: mcInit,
  step: mcStep,
  render: mcRender,
  isOver: (s) => s.over,
  diedAt: (s) => s.diedAt,
  forceEnd: (s) => {
    s.over = true;
    s.diedAt = s.tick;
  },
  liveInfo: (s) => ({ wave: Math.max(1, s.wave), salvage: s.salvage }),
  summary: mcSummary,
};
