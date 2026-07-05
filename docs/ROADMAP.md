# TIME WAR — Build Roadmap

## M1 — Vertical Slice (this milestone) ✅
Prove the hook: *lose → rewind → your ghosts fight beside you → upgrade → push deeper.*

- Vite + TS scaffold, deterministic core (fixed 60 Hz timestep, seeded PRNG, input recorder/replayer)
- Era 1 **DEFCON LOOP** (Missile Command): 6 cities, up to 3 batteries, endless seeded escalating ICBM waves (MIRV splitters from wave 8)
- Echo playback: previous runs replay as translucent ghost batteries
- Rewind screen + upgrade shop: ~10 upgrades across Era/Timeline tabs, incl. **+Echo Slot** and Echo Empowerment
- Neon/CRT art pass (glow, trails, scanlines, screen shake), localStorage save, determinism unit test

## M2 — Meta shell & era plugin hardening
- Timeline map screen (era select, locked-era teasers)
- Formalize `EraModule` contract; move all Missile Command specifics behind it
- Save versioning/migration; stats screen (best depth, loops, per-era records)

## M3 — Era 2: FLAK ALLEY (proves the pattern)
- Galaga/1942-style sim on the shared core; NES-style low-res backbuffer renderer
- Era Key + depth-milestone unlock flow; second era-local upgrade set
- Validates that a new era = one folder + one upgrade file

## M4 — Global layer
- Temporal Resonance (best depth per era → global multiplier)
- Chrono Compression, Fast Forward, Auto-Rewind
- Balance pass on cost curves across two eras

## M5 — Remaining eras (one per sub-milestone, ship in any order)
- SIEGEBREAK (Invaders / parchment) → BROADSIDE (Breakout / 16-bit) → PRIMEVAL (Centipede / 2600) → DEBRIS FIELD (Asteroids / vector) → THE RIFT (Tempest / wireframe)

## M6 — Idle layer
- Parallel Simulation: unattended eras replay best Echo set, banking Salvage
- Offline progress on load; notification badges per era

## M7 — Juice & release polish
- SFX (per-era synth palettes), music stingers on rewind
- Era transition FX (time-tear), achievements, settings (volume, screen-shake, colorblind)
- Number formatting, mobile/touch pass, itch.io/web deploy
