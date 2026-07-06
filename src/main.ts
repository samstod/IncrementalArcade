// TIME WAR — bootstrap and orchestration.
//
// Two screens: the HUB (monitor wall — every unattended era's echo loop
// simulating live and banking income) and PLAY (one era fullscreen, the
// classic play → collapse → rewind → upgrade loop). Idle runners keep
// stepping while you play elsewhere; offline gains are estimated on boot.

import './style.css';
import { startLoop } from './core/loop';
import { hashString } from './core/rng';
import { Recorder, Replayer, type InputEvent } from './core/recorder';
import { ERAS, eraById, type EraModule } from './eras/era';
import {
  echoSlots, chronotonAward, resonanceMult, idleSpeed,
} from './meta/upgrades';
import {
  loadSave, persistSave, wipeSave, eraSave,
  MAX_STORED_RUNS, type SaveData,
} from './meta/save';
import { IdleRunner, applyOfflineProgress } from './meta/idle';
import { updateHud } from './ui/hud';
import { showRewind, hideRewind } from './ui/rewind';
import { buildHub, isUnlocked, type HubHandle } from './ui/hub';

class Game {
  era: EraModule;
  state!: unknown;
  recorder!: Recorder;
  replayers: Replayer[] = [];
  phase: 'playing' | 'rewind' = 'playing';
  pendingClicks: { x: number; y: number }[] = [];
  pointer = { x: 0, y: 0, moved: false };
  private lastSentX = -1;
  private lastSentY = -1;

  constructor(
    eraId: string,
    private save: SaveData,
    private ctx: CanvasRenderingContext2D,
    private rewindEl: HTMLElement,
    private onHub: () => void,
  ) {
    this.era = eraById(eraId);
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
    this.lastSentY = -1;
    this.pointer.moved = false;
    this.phase = 'playing';
    hideRewind(this.rewindEl);
  }

  private liveEvents(t: number): InputEvent[] {
    const live: InputEvent[] = [];
    if (this.era.inputMode === 'click') {
      for (const c of this.pendingClicks) live.push({ t, x: c.x, y: c.y });
      this.pendingClicks = [];
    } else if (this.pointer.moved) {
      const x = Math.round(this.pointer.x);
      const y = Math.round(this.pointer.y);
      if (x !== this.lastSentX || y !== this.lastSentY) {
        live.push({ t, x, y });
        this.lastSentX = x;
        this.lastSentY = y;
      }
      this.pointer.moved = false;
    }
    for (const ev of live) this.recorder.add(ev);
    return live;
  }

  step(): void {
    if (this.phase !== 'playing') return;
    const t = (this.state as { tick: number }).tick;
    const inputs: InputEvent[][] = [this.liveEvents(t)];
    for (const rp of this.replayers) inputs.push(rp.expired(t) ? [] : rp.at(t));
    this.era.step(this.state, inputs);
    if (this.era.isOver(this.state)) this.endRun(true);
  }

  fastForwardActive(): boolean {
    if (this.phase !== 'playing') return false;
    const lv = this.save.globalLevels.fastForward ?? 0;
    if (lv === 0) return false;
    return this.era.liveInfo(this.state).wave < eraSave(this.save, this.era.id).bestWave;
  }

  stepFrame(): void {
    const mult = this.fastForwardActive()
      ? 1 + (this.save.globalLevels.fastForward ?? 0)
      : 1;
    for (let i = 0; i < mult && this.phase === 'playing'; i++) this.step();
  }

  collapse(showOverlay = true): void {
    if (this.phase !== 'playing') return;
    this.era.forceEnd(this.state);
    this.endRun(showOverlay);
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
        onHub: this.onHub,
      });
    }
  }

  render(): void {
    this.era.render(this.ctx, this.state);
    updateHud(
      this.era,
      this.era.liveInfo(this.state),
      this.save,
      this.replayers.length,
      this.fastForwardActive() ? 1 + (this.save.globalLevels.fastForward ?? 0) : 0,
    );
  }
}

// Playtest sandbox: append ?sandbox to the URL and every era is enterable
// without keys or depth gates. Nothing sandbox-only is written to the save.
const SANDBOX = new URLSearchParams(location.search).has('sandbox');

class App {
  save: SaveData = loadSave();
  screen: 'hub' | 'play' = 'hub';
  game: Game | null = null;
  runners = new Map<string, IdleRunner>();
  hub!: HubHandle;
  private frame = 0;
  private monitorCursor = 0;

  private hubEl = document.getElementById('hub')!;
  private playEl = document.getElementById('playview')!;
  private rewindEl = document.getElementById('rewind')!;
  private offlineEl = document.getElementById('offline')!;
  private canvas = document.getElementById('game') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;

  constructor() {
    // Offline progress first, so the hub renders post-gain numbers.
    const gains = applyOfflineProgress(this.save, ERAS, Date.now());
    persistSave(this.save);

    for (const era of ERAS) {
      if (!SANDBOX && !isUnlocked(era, this.save)) continue;
      const runner = new IdleRunner(era, this.save);
      runner.start();
      this.runners.set(era.id, runner);
    }

    this.hub = buildHub(this.hubEl, this.save, {
      onEnter: (id) => this.enter(id),
      sandbox: SANDBOX,
    });
    this.wireHubFooter();
    if (gains.length > 0) this.showOfflineReport(gains);
    this.wireInput();
    startLoop(
      () => this.stepAll(),
      () => this.renderAll(),
    );
  }

  private wireHubFooter(): void {
    // Footer buttons are rebuilt with the hub DOM; delegate from the root.
    this.hubEl.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).id;
      if (id === 'btn-wipe') {
        if (confirm('Erase the entire timeline? All progress and echoes are lost.')) {
          wipeSave();
          location.reload();
        }
      } else if (id === 'btn-sandbox') {
        persistSave(this.save);
        const url = new URL(location.href);
        if (SANDBOX) url.searchParams.delete('sandbox');
        else url.searchParams.set('sandbox', '1');
        location.href = url.toString();
      }
    });
  }

  private showOfflineReport(gains: ReturnType<typeof applyOfflineProgress>): void {
    const rows = gains
      .map(
        (g) =>
          `<div class="off-row"><b>${g.title}</b> — ${g.loops} loops · +${g.salvage} ${g.salvageName} · +${g.chronotons} ⧖</div>`,
      )
      .join('');
    this.offlineEl.innerHTML = `
      <div class="off-card">
        <h2>WHILE YOU WERE GONE</h2>
        <div class="off-sub">Your echoes kept fighting.</div>
        ${rows}
        <button class="off-ok">COLLECT</button>
      </div>
    `;
    this.offlineEl.classList.remove('hidden');
    this.offlineEl.querySelector('.off-ok')!.addEventListener('click', () => {
      this.offlineEl.classList.add('hidden');
      this.hub.rebuild();
    });
  }

  enter(eraId: string): void {
    this.save.currentEra = eraId;
    persistSave(this.save);
    this.runners.get(eraId)?.stop(); // you ARE this timeline now
    this.screen = 'play';
    this.hubEl.classList.add('hidden');
    this.playEl.classList.remove('hidden');
    this.game = new Game(eraId, this.save, this.ctx, this.rewindEl, () => this.toHub());
  }

  toHub(): void {
    if (this.game && this.game.phase === 'playing') this.game.collapse(false);
    const eraId = this.game?.era.id;
    this.game = null;
    hideRewind(this.rewindEl);
    if (eraId) {
      // Restart the runner so it replays the newest recordings.
      let runner = this.runners.get(eraId);
      if (!runner) {
        runner = new IdleRunner(eraById(eraId), this.save);
        this.runners.set(eraId, runner);
      }
      runner.start();
    }
    // Newly stabilized eras need runners too.
    for (const era of ERAS) {
      if ((SANDBOX || isUnlocked(era, this.save)) && !this.runners.has(era.id)) {
        const runner = new IdleRunner(era, this.save);
        runner.start();
        this.runners.set(era.id, runner);
      }
    }
    this.screen = 'hub';
    this.playEl.classList.add('hidden');
    this.hubEl.classList.remove('hidden');
    this.hub.rebuild();
  }

  private stepAll(): void {
    if (this.screen === 'play' && this.game) this.game.stepFrame();
    const speed = idleSpeed(this.save.globalLevels);
    const activeEra = this.screen === 'play' ? this.game?.era.id : null;
    for (const runner of this.runners.values()) {
      if (runner.era.id === activeEra) continue;
      runner.step(speed);
    }
    this.frame++;
    if (this.frame % 600 === 0) persistSave(this.save); // every ~10s
  }

  private renderAll(): void {
    if (this.screen === 'play') {
      this.game?.render();
      return;
    }
    // Round-robin one monitor per frame (~12fps each), stats once a second.
    const live = [...this.runners.values()].filter((r) => r.state);
    if (live.length > 0) {
      const runner = live[this.monitorCursor % live.length];
      this.monitorCursor++;
      const ctx = this.hub.screens.get(runner.era.id);
      if (ctx) runner.era.render(ctx, runner.state);
    }
    if (this.frame % 60 === 0) this.hub.updateStats(this.runners);
  }

  private wireInput(): void {
    const toWorld = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const era = this.game!.era;
      return {
        x: ((e.clientX - rect.left) / rect.width) * era.width,
        y: ((e.clientY - rect.top) / rect.height) * era.height,
      };
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.screen !== 'play' || !this.game || this.game.phase !== 'playing') return;
      const p = toWorld(e);
      if (this.game.era.inputMode === 'click') this.game.pendingClicks.push(p);
      else this.game.pointer = { ...p, moved: true };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.screen !== 'play' || !this.game || this.game.phase !== 'playing') return;
      if (this.game.era.inputMode !== 'pointer') return;
      this.game.pointer = { ...toWorld(e), moved: true };
    });

    document.getElementById('btn-collapse')!.addEventListener('click', () => this.game?.collapse());
    document.getElementById('btn-hub')!.addEventListener('click', () => this.toHub());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persistSave(this.save);
    });
  }
}

new App();
