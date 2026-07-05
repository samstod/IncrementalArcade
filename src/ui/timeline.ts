// Timeline map: travel between eras, stabilize (unlock) new ones, and see
// where the Unraveling still holds. Also shows each era's Temporal Resonance
// contribution so cross-era pushing is legible.

import { ERAS, TEASERS, type EraModule } from '../eras/era';
import { eraSave, persistSave, type SaveData } from '../meta/save';
import { echoSlots } from '../meta/upgrades';

export interface TimelineHooks {
  onTravel: (eraId: string) => void;
  onClose: () => void;
}

export function isUnlocked(era: EraModule, save: SaveData): boolean {
  return era.unlock === null || save.keys.includes(era.id);
}

export function unlockRequirementMet(era: EraModule, save: SaveData): boolean {
  if (!era.unlock) return true;
  return (save.eras[era.unlock.eraId]?.bestWave ?? 0) >= era.unlock.wave;
}

export function showTimeline(root: HTMLElement, save: SaveData, hooks: TimelineHooks): void {
  root.classList.remove('hidden');
  render(root, save, hooks);
}

export function hideTimeline(root: HTMLElement): void {
  root.classList.add('hidden');
}

function render(root: HTMLElement, save: SaveData, hooks: TimelineHooks): void {
  const resLv = save.globalLevels.resonance ?? 0;
  root.innerHTML = `
    <h1>THE TIMELINE</h1>
    <div class="tl-sub">⧖ ${save.chronotons} CHRONOTONS · ${echoSlots(save.globalLevels)} ECHO SLOTS${
      resLv > 0 ? ` · RESONANCE +${2 * resLv}%/wave` : ''
    }</div>
    <div class="tl-cards"></div>
    <button class="tl-close">RETURN</button>
  `;
  const cards = root.querySelector<HTMLElement>('.tl-cards')!;

  for (const era of ERAS) {
    const es = eraSave(save, era.id);
    const unlocked = isUnlocked(era, save);
    const current = save.currentEra === era.id;
    const card = document.createElement('div');
    card.className = `tl-card ${unlocked ? 'open' : 'locked'} ${current ? 'current' : ''}`;

    if (unlocked) {
      card.innerHTML = `
        <div class="tl-title">${era.title}${current ? ' <span class="here">◄ YOU ARE HERE</span>' : ''}</div>
        <div class="tl-flavor">${era.flavor}</div>
        <div class="tl-stats">
          BEST WAVE <b>${es.bestWave || '—'}</b> ·
          LOOPS <b>${es.loops}</b> ·
          ${era.salvageName} <b>${Math.floor(es.salvage)}</b> ·
          ECHOES <b>${Math.min(es.recordings.length, echoSlots(save.globalLevels))}</b>
        </div>
        ${current ? '' : `<button class="tl-go">TRAVEL</button>`}
      `;
      card.querySelector('.tl-go')?.addEventListener('click', () => hooks.onTravel(era.id));
    } else {
      const req = era.unlock!;
      const reqEra = ERAS.find((e) => e.id === req.eraId)!;
      const met = unlockRequirementMet(era, save);
      const affordable = save.chronotons >= req.cost;
      card.innerHTML = `
        <div class="tl-title">${era.title}</div>
        <div class="tl-flavor">${era.flavor}</div>
        <div class="tl-req ${met ? 'met' : ''}">
          REQUIRES: WAVE ${req.wave} IN ${reqEra.short}
          (best: ${save.eras[req.eraId]?.bestWave ?? 0})
        </div>
        <button class="tl-unlock" ${met && affordable ? '' : 'disabled'}>
          STABILIZE ERA — ${req.cost} ⧖
        </button>
      `;
      card.querySelector('.tl-unlock')?.addEventListener('click', () => {
        if (!met || save.chronotons < req.cost) return;
        save.chronotons -= req.cost;
        save.keys.push(era.id);
        persistSave(save);
        render(root, save, hooks); // refresh: card flips to open
      });
    }
    cards.appendChild(card);
  }

  for (const tz of TEASERS) {
    const card = document.createElement('div');
    card.className = 'tl-card teaser';
    card.innerHTML = `
      <div class="tl-title">${tz.title}</div>
      <div class="tl-flavor">${tz.hint}</div>
      <div class="tl-req">TEMPORAL LOCK — SIGNAL LOST</div>
    `;
    cards.appendChild(card);
  }

  root.querySelector('.tl-close')!.addEventListener('click', hooks.onClose);
}
