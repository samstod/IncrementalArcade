# TIME WAR — Incremental Arcade

An incremental game built out of unwinnable classic-arcade knockoffs. You defend
moments in history from **the Unraveling**. Every defeat rewinds the loop — and
your past runs replay beside you as ghostly **Echoes**, firing every shot they
ever fired, empowered by every upgrade you've bought since.

**Current state:** five playable eras, each in its own art technology —
*1983 DEFCON LOOP* (Missile Command, neon/CRT), *1944 FLAK ALLEY*
(Galaga/1942-style, 8-bit NES pixel art), *1250 SIEGEBREAK* (Space Invaders
as a castle siege, parchment/woodcut ink), *1720 BROADSIDE* (Breakout as an
Age-of-Sail bombardment, 16-bit Amiga banded-gradient painterly), and
*PREHISTORY PRIMEVAL* (Centipede in Atari 2600 fat pixels) — with the full
lose → rewind → echo-replay → upgrade loop, a timeline map with
unlock/travel, Temporal Resonance cross-era boosts, and the TEMPORAL SKIP /
AUTO-REWIND quality-of-life layer. Era chain: each era's wave 5 unlocks the
next (1983 → 1944 → 1250 → 1720 → Prehistory).

- 📜 [Game Design Document](docs/GDD.md) — the seven eras, echo system, economy
- 🗺️ [Roadmap](docs/ROADMAP.md) — milestones from slice to full game

## Run it

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm test         # determinism test suite (the replay system's safety net)
```

## How to play the slice

Click to launch interceptors at incoming ICBMs. Protect the six cities. You
will lose — that's the point. On the rewind screen, spend **Scrap** (earned per
kill) on era upgrades and **Chronotons** (earned by depth) on timeline upgrades.
Buy an **ECHO SLOT** and your previous run fights beside you next loop.

## Architecture notes

- Fixed 60 Hz simulation ticks, seeded PRNG, input recording/replay — the enemy
  attack is identical every loop, which is what keeps echo recordings valid.
- `src/core/` — deterministic loop, RNG, recorder. `src/eras/` — one folder per
  era behind a small module contract. `src/meta/` — upgrades, save. `src/ui/` —
  DOM overlays.
