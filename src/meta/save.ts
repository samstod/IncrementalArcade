// Versioned localStorage persistence. v2 is multi-era: per-era currencies,
// upgrade levels, best depth, and echo recordings, plus the global timeline
// state. v1 (single-era slice saves) migrates transparently.

import type { RunRecording } from '../core/recorder';
import type { Levels } from './upgrades';

export const MAX_STORED_RUNS = 6; // hard cap == max echo slots

export interface EraSave {
  salvage: number;
  levels: Levels;
  bestWave: number;
  loops: number;
  recordings: RunRecording[]; // most recent first
}

export interface SaveData {
  v: 2;
  chronotons: number;
  globalLevels: Levels;
  currentEra: string;
  keys: string[]; // stabilized (unlocked) era ids beyond the starters
  eras: Record<string, EraSave>;
}

const KEY = 'timewar-save-v1'; // storage key kept stable across versions

export function emptyEraSave(): EraSave {
  return { salvage: 0, levels: {}, bestWave: 0, loops: 0, recordings: [] };
}

export function defaultSave(): SaveData {
  return {
    v: 2,
    chronotons: 0,
    globalLevels: {},
    currentEra: 'defcon',
    keys: [],
    eras: {},
  };
}

/** Get-or-create the per-era section. */
export function eraSave(save: SaveData, eraId: string): EraSave {
  return (save.eras[eraId] ??= emptyEraSave());
}

export function totalLoops(save: SaveData): number {
  return Object.values(save.eras).reduce((n, e) => n + e.loops, 0);
}

interface SaveV1 {
  v: 1;
  chronotons: number;
  salvage: number;
  eraLevels: Levels;
  globalLevels: Levels;
  loop: number;
  bestWave: number;
  recordings: RunRecording[];
}

function migrateV1(old: SaveV1): SaveData {
  return {
    v: 2,
    chronotons: old.chronotons ?? 0,
    globalLevels: old.globalLevels ?? {},
    currentEra: 'defcon',
    keys: [],
    eras: {
      defcon: {
        salvage: old.salvage ?? 0,
        levels: old.eraLevels ?? {},
        bestWave: old.bestWave ?? 0,
        loops: old.loop ?? 0,
        recordings: old.recordings ?? [],
      },
    },
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as { v: number };
    if (data.v === 1) return migrateV1(data as SaveV1);
    if (data.v === 2) return { ...defaultSave(), ...(data as SaveData) };
    return defaultSave();
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable: the game keeps running, progress just
    // won't survive a reload.
  }
}

export function wipeSave(): void {
  localStorage.removeItem(KEY);
}
