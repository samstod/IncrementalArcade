// Upgrade plumbing shared by every era, plus the global "Timeline" upgrades.
// Era-specific upgrade lists live in their era modules; levels are stored in
// the save and stats are recomputed at run start, which is what makes
// upgrades retroactively empower echo replays.

export type Levels = Record<string, number>;

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: number;
  costMult: number;
  maxLevel: number;
  /** Human-readable effect at a given level, shown as "current → next". */
  effect: (lv: number) => string;
}

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costMult, level));
}

// ── Timeline (Chronoton) upgrades — apply to every era ───────────

export const GLOBAL_UPGRADES: UpgradeDef[] = [
  {
    id: 'echoSlot', name: 'ECHO SLOT',
    desc: 'Past runs replayed beside you each loop',
    baseCost: 25, costMult: 3, maxLevel: 6,
    effect: (lv) => `${lv} echoes`,
  },
  {
    id: 'echoPower', name: 'ECHO EMPOWERMENT',
    desc: 'Echo firepower as a share of yours',
    baseCost: 25, costMult: 2.5, maxLevel: 5,
    effect: (lv) => `${Math.round((0.7 + 0.1 * lv) * 100)}%`,
  },
  {
    id: 'chronoComp', name: 'CHRONO COMPRESSION',
    desc: 'Chronotons earned on rewind',
    baseCost: 20, costMult: 2.2, maxLevel: 8,
    effect: (lv) => `×${(1 + 0.25 * lv).toFixed(2)}`,
  },
  {
    id: 'resonance', name: 'TEMPORAL RESONANCE',
    desc: 'Each best wave in OTHER eras boosts this era’s firepower',
    baseCost: 75, costMult: 3, maxLevel: 5,
    effect: (lv) => `+${2 * lv}% per wave`,
  },
];

export function echoSlots(global: Levels): number {
  return global.echoSlot ?? 0;
}

export function echoPowerMult(global: Levels): number {
  return 0.7 + 0.1 * (global.echoPower ?? 0);
}

/** Chronotons awarded at rewind: superlinear in depth so pushing matters. */
export function chronotonAward(
  waveReached: number,
  global: Levels,
  chronoFactor: number,
): number {
  const mult = 1 + 0.25 * (global.chronoComp ?? 0);
  return Math.floor(5 * Math.pow(Math.max(1, waveReached), 1.6) * mult * chronoFactor);
}

/**
 * Temporal Resonance: firepower multiplier for the current era from best
 * depth reached in every OTHER era. The cross-era hook.
 */
export function resonanceMult(
  global: Levels,
  bestWaves: Record<string, number>,
  currentEraId: string,
): number {
  const lv = global.resonance ?? 0;
  if (lv === 0) return 1;
  let otherWaves = 0;
  for (const [id, w] of Object.entries(bestWaves))
    if (id !== currentEraId) otherWaves += w;
  return 1 + 0.02 * lv * otherWaves;
}
