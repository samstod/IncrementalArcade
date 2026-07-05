// Rewind overlay: the reward moment. Shows the run report, the Chronoton
// award, and the two upgrade shops (Era / Timeline). Purchases mutate the
// save immediately; stats are recomputed at next run start.

import type { RunSummary } from '../eras/missileCommand/sim';
import type { SaveData } from '../meta/save';
import { persistSave } from '../meta/save';
import { UPGRADES, upgradeCost, echoSlots } from '../meta/upgrades';

export interface RewindHooks {
  onRewind: () => void;
}

export function showRewind(
  root: HTMLElement,
  summary: RunSummary,
  chronoGain: number,
  save: SaveData,
  hooks: RewindHooks,
): void {
  root.classList.remove('hidden');
  render(root, summary, chronoGain, save, hooks);
}

export function hideRewind(root: HTMLElement): void {
  root.classList.add('hidden');
}

function render(
  root: HTMLElement,
  summary: RunSummary,
  chronoGain: number,
  save: SaveData,
  hooks: RewindHooks,
): void {
  const secs = Math.floor(summary.ticks / 60);
  const slots = echoSlots(save.globalLevels);
  const echoesNext = Math.min(slots, save.recordings.length);

  root.innerHTML = `
    <h1>TIMELINE COLLAPSED</h1>
    <div class="rw-sub">
      You held until <b>WAVE ${summary.wave}</b> —
      <span class="gain">+${chronoGain} CHRONOTONS</span>
    </div>
    <div class="rw-stats">
      <span>SURVIVED <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></span>
      <span>KILLS <b>${summary.kills}</b></span>
      <span>SCRAP <b>${Math.floor(save.salvage)}</b></span>
      <span>CHRONOTONS <b>${save.chronotons}</b></span>
      <span>LOOPS <b>${save.loop}</b></span>
    </div>
    <div class="rw-shops">
      <div class="shop era"><h2>ERA — 1983 (SCRAP)</h2><div class="items"></div></div>
      <div class="shop global"><h2>TIMELINE (CHRONOTONS)</h2><div class="items"></div></div>
    </div>
    <button class="rw-go">⟲ REWIND — BEGIN LOOP ${save.loop + 1}</button>
    <div class="rw-echo-note">${
      echoesNext > 0
        ? `${echoesNext} echo${echoesNext > 1 ? 'es' : ''} of your past selves will fight beside you.`
        : slots === 0
          ? 'Buy an ECHO SLOT to bring a past self into the next loop.'
          : 'No recorded runs yet — your next runs will become echoes.'
    }</div>
  `;

  const eraBox = root.querySelector<HTMLElement>('.shop.era .items')!;
  const globalBox = root.querySelector<HTMLElement>('.shop.global .items')!;

  for (const def of UPGRADES) {
    const levels = def.scope === 'era' ? save.eraLevels : save.globalLevels;
    const lv = levels[def.id] ?? 0;
    const maxed = lv >= def.maxLevel;
    const cost = upgradeCost(def, lv);
    const funds = def.scope === 'era' ? Math.floor(save.salvage) : save.chronotons;
    const currency = def.scope === 'era' ? '◈' : '⧖';

    const row = document.createElement('div');
    row.className = 'upg';
    row.innerHTML = `
      <div class="upg-info">
        <div class="upg-name">${def.name} <span class="lv">Lv ${lv}${maxed ? ' MAX' : `/${def.maxLevel}`}</span></div>
        <div class="upg-desc">${def.desc}:
          <span class="upg-fx">${def.effect(lv)}${maxed ? '' : ` → ${def.effect(lv + 1)}`}</span>
        </div>
      </div>
      <button ${maxed || funds < cost ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `${cost} ${currency}`}
      </button>
    `;
    if (!maxed) {
      row.querySelector('button')!.addEventListener('click', () => {
        const bank = def.scope === 'era' ? save.salvage : save.chronotons;
        if (bank < cost) return;
        if (def.scope === 'era') save.salvage -= cost;
        else save.chronotons -= cost;
        levels[def.id] = lv + 1;
        persistSave(save);
        render(root, summary, chronoGain, save, hooks); // refresh costs/buttons
      });
    }
    (def.scope === 'era' ? eraBox : globalBox).appendChild(row);
  }

  root.querySelector<HTMLButtonElement>('.rw-go')!.addEventListener('click', hooks.onRewind);
}
