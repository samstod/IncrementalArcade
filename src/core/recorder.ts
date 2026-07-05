// A run recording is just the player's inputs quantized to simulation ticks.
// An Echo is the same simulation stepped with one of these streams bound to a
// ghost player instance.

export interface InputEvent {
  t: number; // simulation tick
  x: number; // world coords
  y: number;
}

export interface RunRecording {
  events: InputEvent[];
  endTick: number; // tick the run died — the ghost fades out here
  wave: number;    // depth that run reached (for display)
}

export class Recorder {
  events: InputEvent[] = [];
  add(ev: InputEvent) {
    this.events.push(ev);
  }
  finish(endTick: number, wave: number): RunRecording {
    return { events: this.events, endTick, wave };
  }
}

export class Replayer {
  private i = 0;
  constructor(readonly rec: RunRecording) {}

  /** Events scheduled for exactly tick t. Must be called with monotonically increasing t. */
  at(t: number): InputEvent[] {
    while (this.i < this.rec.events.length && this.rec.events[this.i].t < t) this.i++;
    const out: InputEvent[] = [];
    while (this.i < this.rec.events.length && this.rec.events[this.i].t === t) {
      out.push(this.rec.events[this.i]);
      this.i++;
    }
    return out;
  }

  /** True once the recorded run is past its death tick. */
  expired(t: number): boolean {
    return t > this.rec.endTick;
  }
}
