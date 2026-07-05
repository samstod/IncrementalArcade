import type { McState } from '../eras/missileCommand/sim';
import type { SaveData } from '../meta/save';

const el = (id: string) => document.getElementById(id)!;

export function updateHud(state: McState, save: SaveData, echoCount: number): void {
  el('hud-loop').textContent = String(save.loop + 1);
  el('hud-wave').textContent = String(Math.max(1, state.wave));
  el('hud-echoes').textContent = String(echoCount);
  el('hud-salvage').textContent = String(Math.floor(save.salvage + state.salvage));
  el('hud-chrono').textContent = String(save.chronotons);
  el('hud-best').textContent = save.bestWave > 0 ? `WAVE ${save.bestWave}` : '—';
}
