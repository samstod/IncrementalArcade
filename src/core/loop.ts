// Fixed-timestep driver: simulation always advances in whole 60 Hz ticks via
// an accumulator; rendering happens once per animation frame and never
// mutates simulation state.

export const TICK_MS = 1000 / 60;

export function startLoop(step: () => void, render: () => void): void {
  let acc = 0;
  let last = performance.now();

  function frame(now: number) {
    acc += Math.min(now - last, 250); // clamp so a background tab can't spiral
    last = now;
    while (acc >= TICK_MS) {
      step();
      acc -= TICK_MS;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
