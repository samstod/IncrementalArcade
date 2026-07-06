# TIME WAR — Incremental Arcade

An incremental game built out of unwinnable classic-arcade knockoffs. You defend
moments in history from **the Unraveling**. Every defeat rewinds the loop — and
your past runs replay beside you as ghostly **Echoes**, firing every shot they
ever fired, empowered by every upgrade you've bought since.

**Current state:** six playable eras, each in its own art technology —
*1983 DEFCON LOOP* (Missile Command, neon/CRT), *1944 FLAK ALLEY*
(Galaga/1942-style, 8-bit NES pixel art), *1250 SIEGEBREAK* (Space Invaders
as a castle siege, parchment/woodcut ink), *1720 BROADSIDE* (Breakout as an
Age-of-Sail bombardment, 16-bit Amiga banded-gradient painterly),
*PREHISTORY PRIMEVAL* (Centipede in Atari 2600 fat pixels), and *2286
DEBRIS FIELD* (Asteroids in glowing vector line art) — with the full lose →
rewind → echo-replay → upgrade loop, the CHRONO COMMAND monitor-wall idle
layer, Temporal Resonance cross-era boosts, and the TEMPORAL SKIP /
AUTO-REWIND quality-of-life layer. Era chain: each era's wave 5 unlocks the
next (1983 → 1944 → 1250 → 1720 → Prehistory → 2286). Only THE RIFT — the
Tempest-style endgame — remains.

- 📜 [Game Design Document](docs/GDD.md) — the seven eras, echo system, economy
- 🗺️ [Roadmap](docs/ROADMAP.md) — milestones from slice to full game

## Run it

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm test         # determinism test suite (the replay system's safety net)
```

## The idle layer

The home screen is **CHRONO COMMAND** — a wall of CRT monitors, one per era.
Any era where you've recorded runs keeps *simulating on its monitor while
you're elsewhere*: your echo crew replays the fight, banks a share of each
loop's income (ECHO YIELD), and rewinds itself forever. CHRONO ACCELERATION
makes unattended timelines run up to ×16 — eventually idling out-earns
playing, and entering an era is about pushing your best wave deeper (which
makes every future ghost loop richer), not grinding income by hand. Closing
the page banks up to 12 hours of estimated progress.

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
