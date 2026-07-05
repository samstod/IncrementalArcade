// Versioned localStorage persistence: currencies, upgrade levels, and the
// echo recordings themselves (input events only — a few KB per run).

import type { RunRecording } from '../core/recorder';
import type { Levels } from './upgrades';

export const MAX_STORED_RUNS = 6; // hard cap == max echo slots

export interface SaveData {
  v: 1;
  chronotons: number;
  salvage: number; // Era 1 currency ("Scrap")
  eraLevels: Levels;
  globalLevels: Levels;
  loop: number; // completed loops
  bestWave: number;
  recordings: RunRecording[]; // most recent first
}

const KEY = 'timewar-save-v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    chronotons: 0,
    salvage: 0,
    eraLevels: {},
    globalLevels: {},
    loop: 0,
    bestWave: 0,
    recordings: [],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as SaveData;
    if (data.v !== 1) return defaultSave();
    return { ...defaultSave(), ...data };
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
