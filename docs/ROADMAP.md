# TIME WAR — Build Roadmap

## M1 — Vertical Slice (this milestone) ✅
Prove the hook: *lose → rewind → your ghosts fight beside you → upgrade → push deeper.*

- Vite + TS scaffold, deterministic core (fixed 60 Hz timestep, seeded PRNG, input recorder/replayer)
- Era 1 **DEFCON LOOP** (Missile Command): 6 cities, up to 3 batteries, endless seeded escalating ICBM waves (MIRV splitters from wave 8)
- Echo playback: previous runs replay as translucent ghost batteries
- Rewind screen + upgrade shop: ~10 upgrades across Era/Timeline tabs, incl. **+Echo Slot** and Echo Empowerment
- Neon/CRT art pass (glow, trails, scanlines, screen shake), localStorage save, determinism unit test

## M2 — Meta shell & era plugin hardening ✅
- Timeline map screen (era select, stabilize/unlock flow, locked-era teasers)
- `EraModule` contract formalized; Missile Command fully behind it
- Save v2 (multi-era) with transparent v1 migration

## M3 — Era 2: FLAK ALLEY (proves the pattern) ✅
- Galaga/1942-style sim on the shared core; NES-style 256×192 backbuffer
  renderer with hard pixel upscale
- Pointer-steered autofiring AA gun (second input mode: recordings are
  target-x events, so echo gunners sweep their remembered arcs)
- Unlock: wave 5 in DEFCON LOOP + 60 chronotons to stabilize
- Determinism suite extended to the plane spawn schedule

## M4 — Global layer ✅
- Temporal Resonance (best depth in other eras → firepower multiplier)
- Chrono Compression; per-era chronoton factor (later eras pay more)
- TEMPORAL SKIP (fast-forward while below your best wave) and AUTO-REWIND
  (5s self-restart, paused by any shop interaction)
- Bot-driven balance probe (`BALANCE=1 npx vitest run tests/balance.report.test.ts`)
  plays every era headlessly and reports death waves per tier; first tuning
  pass applied (FLAK wave density/carrier HP, SIEGEBREAK aimed-arrow damage
  model so fortification upgrades actually matter)

## M5 — Remaining eras (one per sub-milestone, ship in any order)
- ✅ SIEGEBREAK (Invaders / parchment-woodcut): formation march with the
  classic accelerando, aimed arrow volleys vs merlons + gate, piercing
  ballista bolts. Unlock: wave 5 in FLAK ALLEY + 150 chronotons.
- ✅ BROADSIDE (Breakout / 16-bit Amiga banded-gradient painterly): the
  fortress wall grows a course per wave and settles toward your blockade
  line; powder kegs chain, flotsam bricks drop grapeshot/broad-hull/coin
  pickups; seeded mortar volleys are the early killer. Echo ships each keep
  their own cannonballs in play — this era's depth scales with fleet size.
  Unlock: wave 5 in SIEGEBREAK + 350 chronotons.
- ☐ PRIMEVAL (Centipede / 2600) → DEBRIS FIELD (Asteroids / vector) →
  THE RIFT (Tempest / wireframe)

## M6 — Idle layer
- Parallel Simulation: unattended eras replay best Echo set, banking Salvage
- Offline progress on load; notification badges per era

## M7 — Juice & release polish
- SFX (per-era synth palettes), music stingers on rewind
- Era transition FX (time-tear), achievements, settings (volume, screen-shake, colorblind)
- Number formatting, mobile/touch pass, itch.io/web deploy
