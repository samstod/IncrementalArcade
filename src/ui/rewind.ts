// Rewind overlay: the reward moment. Run report, Chronoton award, and the
// two upgrade shops — the current era's (salvage) and the Timeline's
// (chronotons). Purchases mutate the save immediately; stats are recomputed
// at next run start.

import type { EraModule, RunSummary } from '../eras/era';
import { eraSave, persistSave, type SaveData } from '../meta/save';
import {
  GLOBAL_UPGRADES, upgradeCost, echoSlots,
  type UpgradeDef, type Levels,
} from '../meta/upgrades';

export interface RewindHooks {
  onRewind: () => void;
  onTimeline: () => void;
}

let autoTimer: ReturnType<typeof setInterval> | null = null;
let autoListener: AbortController | null = null;

function cancelAutoRewind(): void {
  if (autoTimer !== null) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

function teardownAuto(): void {
  cancelAutoRewind();
  autoListener?.abort();
  autoListener = null;
}

export function showRewind(
  root: HTMLElement,
  era: EraModule,
  summary: RunSummary,
  chronoGain: number,
  save: SaveData,
  hooks: RewindHooks,
): void {
  root.classList.remove('hidden');
  render(root, era, summary, chronoGain, save, hooks);

  // AUTO-REWIND: restart in 5s; touching the shop pauses it for this screen.
  teardownAuto();
  if ((save.globalLevels.autoRewind ?? 0) > 0) {
    autoListener = new AbortController();
    let remain = 5;
    const goBtn = () => root.querySelector<HTMLButtonElement>('.rw-go');
    const label = () => {
      const b = goBtn();
      if (b) b.textContent = `⟲ AUTO-REWIND IN ${remain}…`;
    };
    label();
    autoTimer = setInterval(() => {
      remain--;
      if (remain <= 0) {
        cancelAutoRewind();
        hooks.onRewind();
      } else label();
    }, 1000);
    root.addEventListener(
      'pointerdown',
      (e) => {
        // Clicking REWIND itself shouldn't cancel-then-require-a-second-click.
        if ((e.target as HTMLElement).closest('.rw-go')) return;
        cancelAutoRewind();
        const b = goBtn();
        if (b) b.textContent = `⟲ REWIND — BEGIN LOOP ${eraSave(save, era.id).loops + 1}`;
      },
      { capture: true, signal: autoListener.signal },
    );
  }
}

export function hideRewind(root: HTMLElement): void {
  teardownAuto();
  root.classList.add('hidden');
}

function upgradeRow(
  def: UpgradeDef,
  levels: Levels,
  funds: number,
  currency: string,
  onBuy: (cost: number) => void,
): HTMLElement {
  const lv = levels[def.id] ?? 0;
  const maxed = lv >= def.maxLevel;
  const cost = upgradeCost(def, lv);

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
      if (funds < cost) return;
      levels[def.id] = lv + 1;
      onBuy(cost);
    });
  }
  return row;
}

function render(
  root: HTMLElement,
  era: EraModule,
  summary: RunSummary,
  chronoGain: number,
  save: SaveData,
  hooks: RewindHooks,
): void {
  const es = eraSave(save, era.id);
  const secs = Math.floor(summary.ticks / 60);
  const slots = echoSlots(save.globalLevels);
  const echoesNext = Math.min(slots, es.recordings.length);

  root.innerHTML = `
    <h1>TIMELINE COLLAPSED</h1>
    <div class="rw-sub">
      ${era.title} — you held until <b>WAVE ${summary.wave}</b> —
      <span class="gain">+${chronoGain} CHRONOTONS</span>
    </div>
    <div class="rw-stats">
      <span>SURVIVED <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b></span>
      <span>KILLS <b>${summary.kills}</b></span>
      <span>${era.salvageName} <b>${Math.floor(es.salvage)}</b></span>
      <span>CHRONOTONS <b>${save.chronotons}</b></span>
      <span>BEST <b>W${es.bestWave}</b></span>
    </div>
    <div class="rw-shops">
      <div class="shop era"><h2>ERA — ${era.short} (${era.salvageName})</h2><div class="items"></div></div>
      <div class="shop global"><h2>TIMELINE (CHRONOTONS)</h2><div class="items"></div></div>
    </div>
    <div class="rw-actions">
      <button class="rw-go">⟲ REWIND — BEGIN LOOP ${es.loops + 1}</button>
      <button class="rw-map">⧗ TIMELINE MAP</button>
    </div>
    <div class="rw-echo-note">${
      echoesNext > 0
        ? `${echoesNext} echo${echoesNext > 1 ? 'es' : ''} of your past selves will fight beside you.`
        : slots === 0
          ? 'Buy an ECHO SLOT to bring a past self into the next loop.'
          : 'No recorded runs here yet — your next runs will become echoes.'
    }</div>
  `;

  const rerender = () => render(root, era, summary, chronoGain, save, hooks);
  const eraBox = root.querySelector<HTMLElement>('.shop.era .items')!;
  const globalBox = root.querySelector<HTMLElement>('.shop.global .items')!;

  for (const def of era.upgrades) {
    eraBox.appendChild(
      upgradeRow(def, es.levels, Math.floor(es.salvage), '◈', (cost) => {
        es.salvage -= cost;
        persistSave(save);
        rerender();
      }),
    );
  }
  for (const def of GLOBAL_UPGRADES) {
    globalBox.appendChild(
      upgradeRow(def, save.globalLevels, save.chronotons, '⧖', (cost) => {
        save.chronotons -= cost;
        persistSave(save);
        rerender();
      }),
    );
  }

  root.querySelector<HTMLButtonElement>('.rw-go')!.addEventListener('click', hooks.onRewind);
  root.querySelector<HTMLButtonElement>('.rw-map')!.addEventListener('click', hooks.onTimeline);
}
