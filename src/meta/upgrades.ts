// Upgrade registry. Era upgrades cost Salvage (per-era currency); global
// "Timeline" upgrades cost Chronotons and apply to every era. Levels are
// stored in the save; stats are recomputed from levels at every run start,
// which is what makes upgrades retroactively empower Echo replays.

import type { McStats } from '../eras/missileCommand/sim';

export type Levels = Record<string, number>;

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  scope: 'era' | 'global';
  baseCost: number;
  costMult: number;
  maxLevel: number;
  /** Human-readable effect at a given level, shown as "current → next". */
  effect: (lv: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  // ── Era: 1983 DEFCON LOOP (Salvage) ──────────────────────────────
  {
    id: 'fireRate', scope: 'era', name: 'RAPID LAUNCH',
    desc: 'Battery cooldown between interceptors',
    baseCost: 15, costMult: 1.9, maxLevel: 8,
    effect: (lv) => `${(cooldownAt(lv) / 60).toFixed(2)}s`,
  },
  {
    id: 'blast', scope: 'era', name: 'WARHEAD YIELD',
    desc: 'Interceptor blast radius',
    baseCost: 20, costMult: 1.9, maxLevel: 10,
    effect: (lv) => `${28 + 7 * lv}px`,
  },
  {
    id: 'ammo', scope: 'era', name: 'STOCKPILE',
    desc: 'Interceptors per battery, per wave',
    baseCost: 12, costMult: 1.7, maxLevel: 10,
    effect: (lv) => `${8 + 2 * lv}`,
  },
  {
    id: 'speed', scope: 'era', name: 'SOLID FUEL',
    desc: 'Interceptor flight speed',
    baseCost: 18, costMult: 1.8, maxLevel: 8,
    effect: (lv) => `${(5 + 0.9 * lv).toFixed(1)} px/t`,
  },
  {
    id: 'cityHp', scope: 'era', name: 'CIVIL DEFENSE',
    desc: 'Each city survives extra hits',
    baseCost: 30, costMult: 2.2, maxLevel: 5,
    effect: (lv) => `${1 + lv} HP`,
  },
  {
    id: 'battery', scope: 'era', name: 'SILO NETWORK',
    desc: 'Additional missile battery',
    baseCost: 60, costMult: 5, maxLevel: 2,
    effect: (lv) => `${1 + lv} batteries`,
  },
  {
    id: 'salvageRig', scope: 'era', name: 'SCRAP TEAMS',
    desc: 'Salvage recovered per kill',
    baseCost: 25, costMult: 2.5, maxLevel: 10,
    effect: (lv) => `×${(1 + 0.3 * lv).toFixed(1)}`,
  },

  // ── Timeline (Chronotons) ────────────────────────────────────────
  {
    id: 'echoSlot', scope: 'global', name: 'ECHO SLOT',
    desc: 'Past runs replayed beside you each loop',
    baseCost: 25, costMult: 3, maxLevel: 6,
    effect: (lv) => `${lv} echoes`,
  },
  {
    id: 'echoPower', scope: 'global', name: 'ECHO EMPOWERMENT',
    desc: 'Echo blast radius as a share of yours',
    baseCost: 25, costMult: 2.5, maxLevel: 5,
    effect: (lv) => `${Math.round((0.7 + 0.1 * lv) * 100)}%`,
  },
  {
    id: 'chronoComp', scope: 'global', name: 'CHRONO COMPRESSION',
    desc: 'Chronotons earned on rewind',
    baseCost: 20, costMult: 2.2, maxLevel: 8,
    effect: (lv) => `×${(1 + 0.25 * lv).toFixed(2)}`,
  },
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costMult, level));
}

function cooldownAt(lv: number): number {
  return Math.max(6, 36 - 4 * lv);
}

export function computeStats(era: Levels, global: Levels): McStats {
  return {
    cooldown: cooldownAt(era.fireRate ?? 0),
    blastRadius: 28 + 7 * (era.blast ?? 0),
    ammo: 8 + 2 * (era.ammo ?? 0),
    interceptorSpeed: 5 + 0.9 * (era.speed ?? 0),
    cityMaxHp: 1 + (era.cityHp ?? 0),
    batteryCount: 1 + (era.battery ?? 0),
    echoMult: 0.7 + 0.1 * (global.echoPower ?? 0),
    salvageMult: 1 + 0.3 * (era.salvageRig ?? 0),
  };
}

export function echoSlots(global: Levels): number {
  return global.echoSlot ?? 0;
}

/** Chronotons awarded at rewind: superlinear in depth so pushing matters. */
export function chronotonAward(waveReached: number, global: Levels): number {
  const mult = 1 + 0.25 * (global.chronoComp ?? 0);
  return Math.floor(5 * Math.pow(Math.max(1, waveReached), 1.6) * mult);
}
