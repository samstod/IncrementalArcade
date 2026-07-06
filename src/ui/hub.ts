// The monitor wall: the game's home screen. One CRT per era, each showing
// its unattended echo-loop actually simulating and banking income. Locked
// eras show their unlock terms; unbuilt eras hiss static.

import { ERAS, TEASERS, type EraModule } from '../eras/era';
import { eraSave, persistSave, type SaveData } from '../meta/save';
import { echoSlots, idleSpeed, idleYield } from '../meta/upgrades';
import type { IdleRunner } from '../meta/idle';

export interface HubHooks {
  onEnter: (eraId: string) => void;
  /** Sandbox: every era is enterable regardless of keys (playtesting). */
  sandbox?: boolean;
}

export interface HubHandle {
  /** Canvas contexts to paint idle sims into, keyed by era id. */
  screens: Map<string, CanvasRenderingContext2D>;
  /** Cheap per-second stats refresh (wave/loop/income lines). */
  updateStats: (runners: Map<string, IdleRunner>) => void;
  rebuild: () => void;
}

export function isUnlocked(era: EraModule, save: SaveData): boolean {
  return era.unlock === null || save.keys.includes(era.id);
}

export function unlockRequirementMet(era: EraModule, save: SaveData): boolean {
  if (!era.unlock) return true;
  return (save.eras[era.unlock.eraId]?.bestWave ?? 0) >= era.unlock.wave;
}

export function buildHub(root: HTMLElement, save: SaveData, hooks: HubHooks): HubHandle {
  const screens = new Map<string, CanvasRenderingContext2D>();

  function rebuild(): void {
    screens.clear();
    const accel = idleSpeed(save.globalLevels);
    const yieldPct = Math.round(idleYield(save.globalLevels) * 100);
    root.innerHTML = `
      <header class="hub-head">
        <h1>CHRONO COMMAND</h1>
        <div class="hub-sub">
          <span class="hub-chrono">⧖ <b id="hub-chrono">${save.chronotons}</b> CHRONOTONS</span>
          <span>${echoSlots(save.globalLevels)} ECHO SLOTS</span>
          <span>IDLE ×${accel} · YIELD ${yieldPct}%</span>
          ${hooks.sandbox ? '<span class="hub-sandbox">SANDBOX — ALL ERAS OPEN</span>' : ''}
        </div>
      </header>
      <div class="hub-grid"></div>
      <footer class="hub-foot">
        <span>Unattended timelines replay your echoes and bank income. Enter one to push deeper.</span>
        <button id="btn-wipe">RESET TIMELINE</button>
      </footer>
    `;
    const grid = root.querySelector<HTMLElement>('.hub-grid')!;

    for (const era of ERAS) {
      const es = eraSave(save, era.id);
      const unlocked = hooks.sandbox || isUnlocked(era, save);
      const mon = document.createElement('div');

      if (unlocked) {
        const idle = es.recordings.length > 0;
        mon.className = `mon ${idle ? 'live' : 'dark'}`;
        mon.innerHTML = `
          <div class="mon-screen">
            <canvas width="${era.width}" height="${era.height}"></canvas>
            ${idle ? '' : `<div class="mon-msg">NO ECHO RECORDING<br/>ENTER TO FIGHT — YOUR RUNS BECOME THE GARRISON</div>`}
            <div class="mon-scan"></div>
          </div>
          <div class="mon-label">${era.title}</div>
          <div class="mon-stats" data-era="${era.id}">${
            idle ? 'REPLAYING…' : `BEST W${es.bestWave || '—'} · UNMANNED`
          }</div>
          <button class="mon-enter">ENTER ERA</button>
        `;
        const canvas = mon.querySelector('canvas')!;
        screens.set(era.id, canvas.getContext('2d')!);
        mon.querySelector('.mon-enter')!.addEventListener('click', () => hooks.onEnter(era.id));
      } else {
        const req = era.unlock!;
        const reqEra = ERAS.find((e) => e.id === req.eraId)!;
        const met = unlockRequirementMet(era, save);
        mon.className = 'mon locked';
        mon.innerHTML = `
          <div class="mon-screen"><div class="mon-static"></div>
            <div class="mon-msg">${era.flavor}</div>
          </div>
          <div class="mon-label">${era.title}</div>
          <div class="mon-stats ${met ? 'met' : ''}">
            NEEDS WAVE ${req.wave} IN ${reqEra.short} (best ${save.eras[req.eraId]?.bestWave ?? 0})
          </div>
          <button class="mon-enter" ${met && save.chronotons >= req.cost ? '' : 'disabled'}>
            STABILIZE — ${req.cost} ⧖
          </button>
        `;
        mon.querySelector('.mon-enter')!.addEventListener('click', () => {
          if (!met || save.chronotons < req.cost) return;
          save.chronotons -= req.cost;
          save.keys.push(era.id);
          persistSave(save);
          rebuild();
        });
      }
      grid.appendChild(mon);
    }

    for (const tz of TEASERS) {
      const mon = document.createElement('div');
      mon.className = 'mon teaser';
      mon.innerHTML = `
        <div class="mon-screen"><div class="mon-static"></div>
          <div class="mon-msg">SIGNAL LOST</div>
        </div>
        <div class="mon-label">${tz.title}</div>
        <div class="mon-stats">${tz.hint}</div>
      `;
      grid.appendChild(mon);
    }
  }

  function updateStats(runners: Map<string, IdleRunner>): void {
    const chrono = root.querySelector('#hub-chrono');
    if (chrono) chrono.textContent = String(save.chronotons);
    for (const era of ERAS) {
      const el = root.querySelector<HTMLElement>(`.mon-stats[data-era="${era.id}"]`);
      if (!el) continue;
      const runner = runners.get(era.id);
      const es = eraSave(save, era.id);
      if (runner?.state) {
        const info = era.liveInfo(runner.state);
        const rates = runner.rates();
        const rate = rates
          ? ` · +${rates.salvage.toFixed(1)}◈ +${rates.chronotons.toFixed(1)}⧖ /s`
          : '';
        el.textContent = `W${info.wave} · LOOP ${es.loops} · BEST W${es.bestWave}${rate}`;
      }
    }
  }

  rebuild();
  return { screens, updateStats, rebuild };
}
