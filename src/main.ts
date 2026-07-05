// TIME WAR — bootstrap and run orchestration.
// Owns the play → collapse → rewind → upgrade → replay-with-echoes loop,
// era travel via the timeline map, and input capture for both era input
// modes ('click' fires at points; 'pointer' steers toward the cursor).

import './style.css';
import { startLoop } from './core/loop';
import { hashString } from './core/rng';
import { Recorder, Replayer, type InputEvent } from './core/recorder';
import { eraById, type EraModule } from './eras/era';
import {
  echoSlots, chronotonAward, resonanceMult,
} from './meta/upgrades';
import {
  loadSave, persistSave, wipeSave, eraSave,
  MAX_STORED_RUNS, type SaveData,
} from './meta/save';
import { updateHud } from './ui/hud';
import { showRewind, hideRewind } from './ui/rewind';
import { showTimeline, hideTimeline } from './ui/timeline';

type Phase = 'playing' | 'rewind' | 'map';

class Game {
  save: SaveData = loadSave();
  era: EraModule = eraById(this.save.currentEra);
  state!: unknown;
  recorder!: Recorder;
  replayers: Replayer[] = [];
  phase: Phase = 'playing';
  phaseBeforeMap: Phase = 'playing';

  // Input capture (converted to world coords per era)
  pendingClicks: { x: number; y: number }[] = [];
  pointer = { x: 0, y: 0, moved: false };
  private lastSentX = -1;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private rewindEl: HTMLElement,
    private timelineEl: HTMLElement,
  ) {
    this.startRun();
  }

  private bestWaves(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [id, es] of Object.entries(this.save.eras)) out[id] = es.bestWave;
    return out;
  }

  startRun(): void {
    const es = eraSave(this.save, this.era.id);
    const res = resonanceMult(this.save.globalLevels, this.bestWaves(), this.era.id);
    const stats = this.era.computeStats(es.levels, this.save.globalLevels, res);
    const echoes = es.recordings.slice(0, echoSlots(this.save.globalLevels));
    this.replayers = echoes.map((r) => new Replayer(r));
    this.state = this.era.init(hashString(`era-${this.era.id}`), stats, 1 + echoes.length);
    this.recorder = new Recorder();
    this.pendingClicks = [];
    this.lastSentX = -1;
    this.pointer.moved = false;
    this.phase = 'playing';
    hideRewind(this.rewindEl);
    hideTimeline(this.timelineEl);
  }

  /** Live input events for this tick, per the era's input mode. */
  private liveEvents(t: number): InputEvent[] {
    const live: InputEvent[] = [];
    if (this.era.inputMode === 'click') {
      for (const c of this.pendingClicks) live.push({ t, x: c.x, y: c.y });
      this.pendingClicks = [];
    } else if (this.pointer.moved) {
      // Steering: emit only when the target actually changed, so recordings
      // stay tiny (a few events per sweep, not one per frame).
      const x = Math.round(this.pointer.x);
      if (x !== this.lastSentX) {
        live.push({ t, x, y: Math.round(this.pointer.y) });
        this.lastSentX = x;
      }
      this.pointer.moved = false;
    }
    for (const ev of live) this.recorder.add(ev);
    return live;
  }

  step(): void {
    if (this.phase !== 'playing') return;
    const state = this.state;
    const t = (state as { tick: number }).tick;

    const inputs: InputEvent[][] = [this.liveEvents(t)];
    for (const rp of this.replayers) inputs.push(rp.expired(t) ? [] : rp.at(t));

    this.era.step(state, inputs);
    if (this.era.isOver(state)) this.endRun(true);
  }

  /** Manual early rewind ("collapse the timeline"). */
  collapse(): void {
    if (this.phase !== 'playing') return;
    this.era.forceEnd(this.state);
    this.endRun(true);
  }

  private endRun(showOverlay: boolean): void {
    this.phase = 'rewind';
    const es = eraSave(this.save, this.era.id);
    const summary = this.era.summary(this.state);
    const gain = chronotonAward(summary.wave, this.save.globalLevels, this.era.chronoFactor);

    this.save.chronotons += gain;
    es.salvage += summary.salvage;
    es.loops++;
    es.bestWave = Math.max(es.bestWave, summary.wave);

    if (this.recorder.events.length > 0) {
      es.recordings.unshift(this.recorder.finish(this.era.diedAt(this.state), summary.wave));
      es.recordings = es.recordings.slice(0, MAX_STORED_RUNS);
    }
    persistSave(this.save);

    if (showOverlay) {
      showRewind(this.rewindEl, this.era, summary, gain, this.save, {
        onRewind: () => this.startRun(),
        onTimeline: () => this.openTimeline(),
      });
    }
  }

  openTimeline(): void {
    if (this.phase !== 'map') this.phaseBeforeMap = this.phase;
    this.phase = 'map'; // pauses the sim
    showTimeline(this.timelineEl, this.save, {
      onTravel: (id) => this.travel(id),
      onClose: () => this.closeTimeline(),
    });
  }

  private closeTimeline(): void {
    hideTimeline(this.timelineEl);
    this.phase = this.phaseBeforeMap;
  }

  travel(eraId: string): void {
    if (eraId === this.era.id) return this.closeTimeline();
    // Traveling mid-run collapses the current run first (it still records,
    // still awards — the loop just ends early).
    if (this.phaseBeforeMap === 'playing' && this.phase === 'map') {
      this.era.forceEnd(this.state);
      this.endRun(false);
    }
    this.save.currentEra = eraId;
    this.era = eraById(eraId);
    persistSave(this.save);
    this.startRun();
  }

  render(): void {
    this.era.render(this.ctx, this.state);
    updateHud(this.era, this.era.liveInfo(this.state), this.save, this.replayers.length);
  }
}

function main(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const game = new Game(
    ctx,
    document.getElementById('rewind')!,
    document.getElementById('timeline')!,
  );

  const toWorld = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * game.era.width,
      y: ((e.clientY - rect.top) / rect.height) * game.era.height,
    };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (game.phase !== 'playing') return;
    const p = toWorld(e);
    if (game.era.inputMode === 'click') game.pendingClicks.push(p);
    else {
      game.pointer = { ...p, moved: true };
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (game.phase !== 'playing' || game.era.inputMode !== 'pointer') return;
    game.pointer = { ...toWorld(e), moved: true };
  });

  document.getElementById('btn-collapse')!.addEventListener('click', () => game.collapse());
  document.getElementById('btn-timeline')!.addEventListener('click', () => {
    if (game.phase === 'map') return;
    game.openTimeline();
  });
  document.getElementById('btn-wipe')!.addEventListener('click', () => {
    if (confirm('Erase the entire timeline? All progress and echoes are lost.')) {
      wipeSave();
      location.reload();
    }
  });

  startLoop(
    () => game.step(),
    () => game.render(),
  );
}

main();
