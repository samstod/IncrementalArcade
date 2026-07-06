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
  // Shape of the last completed idle loop, for offline estimation.
  idleTicks?: number;
  idleSalvage?: number;
  idleChrono?: number;
}

// Prototype-era saves (v1/v2) predate several sim, balance, and economy
// overhauls — their recordings and levels are meaningless now. Any save
// below the current schema is discarded on load: a clean restart.
export const SCHEMA = 3;

export interface SaveData {
  v: typeof SCHEMA;
  chronotons: number;
  globalLevels: Levels;
  currentEra: string;
  keys: string[]; // stabilized (unlocked) era ids beyond the starters
  eras: Record<string, EraSave>;
  lastSeen?: number; // wall-clock ms at last persist, for offline progress
}

const KEY = 'timewar-save-v1'; // storage key kept stable across versions

export function emptyEraSave(): EraSave {
  return { salvage: 0, levels: {}, bestWave: 0, loops: 0, recordings: [] };
}

export function defaultSave(): SaveData {
  return {
    v: SCHEMA,
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

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as { v: number };
    if (data.v === SCHEMA) return { ...defaultSave(), ...(data as SaveData) };
    return defaultSave(); // older prototype saves: clean restart
  } catch {
    return defaultSave();
  }
}

export function persistSave(data: SaveData): void {
  try {
    data.lastSeen = Date.now();
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable: the game keeps running, progress just
    // won't survive a reload.
  }
}

export function wipeSave(): void {
  localStorage.removeItem(KEY);
}
