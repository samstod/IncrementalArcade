// The idle layer: every unattended era with recordings runs its echo set as
// a full background simulation — the same deterministic sim, driven purely
// by recorded inputs (instance 0 included). When the run dies it banks a
// share of its income (ECHO YIELD) and rewinds itself, forever. CHRONO
// ACCELERATION multiplies how many ticks these unattended timelines advance
// per real frame — the route to idling out-earning active play.

import { Replayer, type InputEvent } from '../core/recorder';
import { hashString } from '../core/rng';
import type { EraModule } from '../eras/era';
import {
  echoSlots, idleYield, idleSpeed, chronotonAward, resonanceMult,
} from './upgrades';
import { eraSave, type SaveData } from './save';

export class IdleRunner {
  state: unknown = null;
  private replayers: Replayer[] = [];
  loops = 0; // this session
  banked = { salvage: 0, chronotons: 0 }; // this session, for display

  constructor(
    readonly era: EraModule,
    private save: SaveData,
  ) {}

  /** Idle needs at least one recording to replay. */
  canRun(): boolean {
    return eraSave(this.save, this.era.id).recordings.length > 0;
  }

  /** (Re)start the background loop with current upgrades and recordings. */
  start(): void {
    if (!this.canRun()) {
      this.state = null;
      return;
    }
    const es = eraSave(this.save, this.era.id);
    const bestWaves: Record<string, number> = {};
    for (const [id, e] of Object.entries(this.save.eras)) bestWaves[id] = e.bestWave;
    const res = resonanceMult(this.save.globalLevels, bestWaves, this.era.id);
    const stats = this.era.computeStats(es.levels, this.save.globalLevels, res);
    // The ghost crew: your latest run plus your echo set.
    const crew = es.recordings.slice(0, 1 + echoSlots(this.save.globalLevels));
    this.replayers = crew.map((r) => new Replayer(r));
    this.state = this.era.init(hashString(`era-${this.era.id}`), stats, crew.length);
  }

  stop(): void {
    this.state = null;
  }

  /** Advance n ticks; completed loops bank income and self-rewind. */
  step(n: number): void {
    if (!this.state) return;
    for (let i = 0; i < n; i++) {
      const t = (this.state as { tick: number }).tick;
      const inputs: InputEvent[][] = this.replayers.map((rp) =>
        rp.expired(t) ? [] : rp.at(t),
      );
      this.era.step(this.state, inputs);
      if (this.era.isOver(this.state)) {
        this.bankLoop();
        this.start();
        if (!this.state) return;
      }
    }
  }

  private bankLoop(): void {
    const summary = this.era.summary(this.state);
    const es = eraSave(this.save, this.era.id);
    const y = idleYield(this.save.globalLevels);
    // Salvage stays fractional — flooring would zero out small ghost loops.
    const salvage = summary.salvage * y;
    const chrono = Math.floor(
      chronotonAward(summary.wave, this.save.globalLevels, this.era.chronoFactor) * y,
    );
    es.salvage += salvage;
    this.save.chronotons += chrono;
    es.loops++;
    this.loops++;
    this.banked.salvage += salvage;
    this.banked.chronotons += chrono;
    // Remember this loop's shape for offline estimation.
    es.idleTicks = summary.ticks;
    es.idleSalvage = salvage;
    es.idleChrono = chrono;
  }

  /** Approximate income per real-time second at current idle speed. */
  rates(): { salvage: number; chronotons: number } | null {
    const es = eraSave(this.save, this.era.id);
    if (!es.idleTicks || es.idleTicks <= 0) return null;
    const loopsPerSec = (60 * idleSpeed(this.save.globalLevels)) / es.idleTicks;
    return {
      salvage: (es.idleSalvage ?? 0) * loopsPerSec,
      chronotons: (es.idleChrono ?? 0) * loopsPerSec,
    };
  }
}

export interface OfflineGain {
  eraId: string;
  title: string;
  loops: number;
  salvage: number;
  salvageName: string;
  chronotons: number;
}

const MAX_OFFLINE_MS = 12 * 60 * 60 * 1000; // cap banked absence at 12h

/**
 * Estimate what the monitor wall earned while the page was closed, using
 * each era's last observed loop shape. Mutates the save; returns a report.
 */
export function applyOfflineProgress(save: SaveData, eras: EraModule[], now: number): OfflineGain[] {
  const last = save.lastSeen ?? 0;
  if (last <= 0) return [];
  const elapsedTicks = (Math.min(Math.max(0, now - last), MAX_OFFLINE_MS) / 1000) * 60;
  if (elapsedTicks < 60 * 30) return []; // under 30s away: not worth a report
  const speed = idleSpeed(save.globalLevels);
  const gains: OfflineGain[] = [];
  for (const era of eras) {
    const es = save.eras[era.id];
    if (!es || es.recordings.length === 0 || !es.idleTicks || es.idleTicks <= 0) continue;
    const loops = Math.floor((elapsedTicks * speed) / es.idleTicks);
    if (loops <= 0) continue;
    const salvage = loops * (es.idleSalvage ?? 0);
    const chronotons = loops * (es.idleChrono ?? 0);
    es.salvage += salvage;
    es.loops += loops;
    save.chronotons += chronotons;
    gains.push({
      eraId: era.id, title: era.title,
      loops, salvage: Math.floor(salvage), salvageName: era.salvageName, chronotons,
    });
  }
  return gains;
}
