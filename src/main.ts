// TIME WAR — bootstrap and run orchestration.
// Owns the play → collapse → rewind → upgrade → replay-with-echoes loop.

import './style.css';
import { startLoop } from './core/loop';
import { hashString } from './core/rng';
import { Recorder, Replayer, type InputEvent } from './core/recorder';
import { mcInit, mcStep, mcSummary, type McState, W, H } from './eras/missileCommand/sim';
import { mcRender } from './eras/missileCommand/render';
import { computeStats, echoSlots, chronotonAward } from './meta/upgrades';
import { loadSave, persistSave, wipeSave, MAX_STORED_RUNS, type SaveData } from './meta/save';
import { updateHud } from './ui/hud';
import { showRewind, hideRewind } from './ui/rewind';

const ERA_SEED = hashString('era-1983-defcon-loop');

class Game {
  save: SaveData = loadSave();
  state!: McState;
  recorder!: Recorder;
  replayers: Replayer[] = [];
  phase: 'playing' | 'rewind' = 'playing';
  pendingClicks: { x: number; y: number }[] = [];

  constructor(
    private ctx: CanvasRenderingContext2D,
    private rewindEl: HTMLElement,
  ) {
    this.startRun();
  }

  startRun(): void {
    const stats = computeStats(this.save.eraLevels, this.save.globalLevels);
    const slots = echoSlots(this.save.globalLevels);
    const echoes = this.save.recordings.slice(0, slots);
    this.replayers = echoes.map((r) => new Replayer(r));
    this.state = mcInit(ERA_SEED, stats, 1 + echoes.length);
    this.recorder = new Recorder();
    this.pendingClicks = [];
    this.phase = 'playing';
    hideRewind(this.rewindEl);
  }

  step(): void {
    if (this.phase !== 'playing') return;
    const t = this.state.tick;

    const live: InputEvent[] = [];
    for (const c of this.pendingClicks) {
      const ev: InputEvent = { t, x: c.x, y: c.y };
      live.push(ev);
      this.recorder.add(ev);
    }
    this.pendingClicks = [];

    const inputs: InputEvent[][] = [live];
    for (const rp of this.replayers) inputs.push(rp.expired(t) ? [] : rp.at(t));

    mcStep(this.state, inputs);
    if (this.state.over) this.endRun();
  }

  /** Manual early rewind ("collapse the timeline"). */
  collapse(): void {
    if (this.phase !== 'playing') return;
    this.state.over = true;
    this.state.diedAt = this.state.tick;
    this.endRun();
  }

  private endRun(): void {
    this.phase = 'rewind';
    const summary = mcSummary(this.state);
    const gain = chronotonAward(summary.wave, this.save.globalLevels);

    this.save.chronotons += gain;
    this.save.salvage += summary.salvage;
    this.save.loop++;
    this.save.bestWave = Math.max(this.save.bestWave, summary.wave);

    if (this.recorder.events.length > 0) {
      this.save.recordings.unshift(this.recorder.finish(this.state.diedAt, summary.wave));
      this.save.recordings = this.save.recordings.slice(0, MAX_STORED_RUNS);
    }
    persistSave(this.save);

    showRewind(this.rewindEl, summary, gain, this.save, {
      onRewind: () => this.startRun(),
    });
  }

  render(): void {
    mcRender(this.ctx, this.state);
    updateHud(this.state, this.save, this.replayers.length);
  }
}

function main(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const rewindEl = document.getElementById('rewind')!;
  const game = new Game(ctx, rewindEl);

  canvas.addEventListener('pointerdown', (e) => {
    if (game.phase !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    game.pendingClicks.push({
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    });
  });

  document.getElementById('btn-collapse')!.addEventListener('click', () => game.collapse());
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
