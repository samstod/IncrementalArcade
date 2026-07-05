import type { EraModule, LiveInfo } from '../eras/era';
import { eraSave, type SaveData } from '../meta/save';

const el = (id: string) => document.getElementById(id)!;

const HINTS: Record<string, string> = {
  click: 'Click to fire. You cannot win — you can only fail deeper.',
  pointer: 'Steer with the pointer; the gun never stops firing. Fail deeper.',
};

export function updateHud(
  era: EraModule,
  info: LiveInfo,
  save: SaveData,
  echoCount: number,
): void {
  const es = eraSave(save, era.id);
  el('hud-era').textContent = era.short;
  el('hud-loop').textContent = String(es.loops + 1);
  el('hud-wave').textContent = String(info.wave);
  el('hud-echoes').textContent = String(echoCount);
  el('hud-salvage-name').textContent = era.salvageName;
  el('hud-salvage').textContent = String(Math.floor(es.salvage + info.salvage));
  el('hud-chrono').textContent = String(save.chronotons);
  el('hud-best').textContent = es.bestWave > 0 ? `W${es.bestWave}` : '—';
  el('foot-hint').textContent = HINTS[era.inputMode];
}
