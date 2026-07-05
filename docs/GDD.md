# TIME WAR — Game Design Document

*Working title: **Time War** (repo: IncrementalArcade)*
*Genre: Incremental / prestige game built out of unwinnable classic-arcade knockoffs*
*Platform: Web (desktop-first, mouse + keyboard)*

---

## 1. High Concept

An entity called **the Unraveling** is eating history. You are a Chrono-Defense operative anchored to key moments in time. You cannot win — you can only hold the line longer. Every defeat rewinds the loop, but your suit records everything: on each new attempt, your past selves fight beside you as **Echoes**, replaying every shot they ever fired. Push deep enough and you tear open passage to other eras under attack — each one a different classic arcade game, in a different art style, with its own upgrade economy feeding a shared timeline-wide meta.

**The hook in one sentence:** *Missile Command, except every time you lose, all of your previous attempts fight alongside you.*

---

## 2. Design Pillars

1. **Losing is progress.** Every run ends in defeat by design. The rewind screen is a reward moment, not a fail state.
2. **Your past is your army.** The Echo system makes every previous run visible on screen. Power is measured in ghosts.
3. **Determinism is sacred.** The enemy attack is identical every loop (fixed seed, fixed schedule). This is what makes Echo replays meaningful — your ghosts re-kill what they killed before, and you fight at the frontier they never reached.
4. **Eras cross-pollinate.** Global upgrades and Temporal Resonance mean pushing deep in any era makes every era stronger. There is always a productive place to be.
5. **Each era is a postcard.** Different game, different century, different art technology. Switching eras should feel like changing channels on a haunted TV.

---

## 3. Core Loop

```
┌─────────────────────────────────────────────────────────┐
│  PLAY a short, escalating, deterministic arcade run     │
│  (same seed every loop → identical enemy waves)         │
└──────────────────────────┬──────────────────────────────┘
                           │ lose (always)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  REWIND — earn Chronotons (global) by depth reached;    │
│  era Salvage was earned per kill during the run         │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  UPGRADE — era-local stats (Salvage) and timeline-wide  │
│  upgrades incl. +Echo slots (Chronotons)                │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  RESTART with up to N past runs replaying as Echoes.    │
│  They clear the early game; you push the frontier.      │
└─────────────────────────────────────────────────────────┘
```

Timing targets: first rewind lands within ~90 seconds of a fresh player starting. First Echo slot is affordable within 2–3 loops (the "whoa, that's me from before" moment). Era 2 unlocks within a first play session.

### 3.1 The Echo system (the whole game)

- A **run recording** is the list of the player's inputs, quantized to simulation ticks.
- On restart, the last N recordings (N = Echo slots owned) are replayed as translucent ghost player-instances **inside the same simulation**, tick-for-tick.
- Enemy spawns are generated from a fixed per-era seed on a fixed tick schedule — player actions never alter the schedule. Ghost aim therefore stays valid forever.
- **Upgrades apply retroactively to Echoes.** Their inputs are frozen; their stats are yours, scaled by Echo Empowerment. Buying +blast radius makes every ghost you ever recorded stronger. This is the central power fantasy.
- When an Echo's recording ends (the tick where that run died), the ghost fades out for the rest of the loop. Late game, the screen is a crowd of ancestors dying one by one while you fight on.
- Divergence is embraced: a ghost shot that now kills two extra missiles thanks to your new blast radius is a feature, not a bug.

---

## 4. The Seven Eras

Every era is a shooter/defense game **on purpose**: N simultaneous player instances always read as visibly stacked firepower. Each era has a distinct art technology so the timeline feels like traveling through the history of light itself.

| # | Era | Codename | Knockoff of | Art style |
|---|-----|----------|-------------|-----------|
| 1 | 1983 — Cold War | **DEFCON LOOP** | Missile Command | Neon-on-black raster arcade, phosphor trails, CRT scanlines |
| 2 | 1944 — WWII Pacific | **FLAK ALLEY** | Galaga / 1942 | 8-bit NES pixel art |
| 3 | 1250 — Medieval | **SIEGEBREAK** | Space Invaders | Two-tone parchment / woodcut (1-bit + paper texture) |
| 4 | 1720 — Age of Sail | **BROADSIDE** | Breakout / Arkanoid | 16-bit Amiga-style painterly pixel art |
| 5 | Prehistory | **PRIMEVAL** | Centipede | Atari 2600: fat pixels, garish clashing palette |
| 6 | 2286 — Far Future | **DEBRIS FIELD** | Asteroids | White/neon vector line art with glow |
| 7 | The End of Time | **THE RIFT** | Tempest | Color-cycling synthwave wireframe vector |

### Era 1 — DEFCON LOOP (1983, Cold War) — *the vertical slice*
Missile Command. Six cities under endless ICBM rain; click to launch interceptors from your batteries; explosions destroy warheads. Later waves add splitting MIRVs, faster warheads, denser volleys. **Echo flavor:** ghost missile batteries shimmer beside yours, firing every interceptor their run ever fired.

### Era 2 — FLAK ALLEY (1944, WWII Pacific)
Fixed shooter à la Galaga/1942. You are an AA gun on a carrier deck; dive-bomber formations wheel overhead, peel off, and strafe. Formations that reach the deck damage the carrier (your "cities"). Upgrades: turn rate, shell speed, flak burst size, carrier armor, extra gun mounts. **Echo flavor:** phantom AA guns manned by past gunners.

### Era 3 — SIEGEBREAK (1250, Medieval)
Space Invaders. Ranks of siege infantry advance in formation, step-step-drop, toward your castle wall. You slide along the battlements with a ballista; crumbling merlons are your destructible bunkers. Rams and siege towers as tanky units, sappers speed the formation. **Echo flavor:** spectral ballistae of fallen defenders.

### Era 4 — BROADSIDE (1720, Age of Sail)
Breakout/Arkanoid. Your ship tacks along the bottom of the screen; a ricocheting cannonball chews through the brick courses of an island fortress wall. Powder-keg bricks chain-explode; flotsam drops grant multi-ball (grapeshot), wider hull, sticky sails. **Echo flavor:** ghost ships, each keeping its own cannonball in play.

### Era 5 — PRIMEVAL (Prehistory)
Centipede. A giant megapede winds down through a mushroom-fern jungle toward your spear-hunter; segments split at every hit, giant fleas and spiders harass. **Echo flavor:** ancestor hunters hurl spears along their remembered paths.

### Era 6 — DEBRIS FIELD (2286, Far Future)
Asteroids. Inside the shattered wreck of a fleet, you defend a crippled colony ship (a fixed structure to protect — the "city" of this era). Hulks split into fragments; screen wraps. Thrust/rotate/fire controls. **Echo flavor:** ghost fighters flying their recorded sorties.

### Era 7 — THE RIFT (The End of Time)
Tempest. Entropy creatures crawl up the lanes of a wireframe well at the edge of existence. You skate the rim; Echoes occupy other rim segments. The final era — the source of the Unraveling. **Echo flavor:** echo blasters strobing on far rail segments.

---

## 5. Economy & Upgrades

### 5.1 Currencies
- **Salvage** (era-local, themed per era: *Scrap* / *Shell Casings* / *Timber* / *Doubloons* / *Amber* / *Alloy* / *Fragments*). Earned per enemy destroyed during a run (by you **or** your Echoes). Persists across loops. Spent on era-local upgrades.
- **Chronotons** (global). Awarded at rewind, superlinear in depth reached (`floor(5 · (wave+1)^1.6)` in the slice). Spent on timeline-wide upgrades.

### 5.2 Era-local upgrades (Salvage)
Standard exponential cost curves (`base · mult^level`). Per era, themed variants of:

| Upgrade | Effect |
|---|---|
| Fire rate | Lower cooldown between shots |
| Payload | Bigger blast radius / damage |
| Ammo | More shots per wave / magazine |
| Velocity | Faster projectiles |
| Fortification | Structure (city/carrier/wall) max HP |
| Emplacement | +1 battery / gun mount / instance position (hard-capped) |
| Salvage rig | +% Salvage per kill |

### 5.3 Global upgrades (Chronotons)

| Upgrade | Effect |
|---|---|
| **Echo Slot** | +1 past run replayed each loop. The marquee upgrade. |
| Echo Empowerment | Echoes inherit a bigger % of your current stats (base 70%, +10%/level) |
| Chrono Compression | +% Chronoton income |
| **Temporal Resonance** | Each era's best depth grants +% power to *all other* eras |
| Era Key | Unlocks travel to the next era (also gated by depth milestone) |
| Parallel Simulation | Unattended eras keep replaying their best Echo set, banking Salvage (idle layer) |
| Fast Forward | Skip/accelerate early waves your Echoes already handle |
| Auto-Rewind | Loop restarts automatically on defeat |

### 5.4 Progression skeleton
1. **Loops 1–3 (Era 1):** learn the game, buy fire rate/blast, afford Echo Slot 1 → the hook lands.
2. **Loops 4–10:** stack 2–3 Echoes, wall out around wave 8–10, feel the soft cap.
3. **Era 2 unlock** (depth milestone + Era Key): new game, new art style, fresh cheap upgrades — the classic incremental "new layer" dopamine.
4. **Resonance loop:** deep pushes in Era 2 boost Era 1; return trips smash old walls.
5. **Parallel Simulation:** the game becomes a true incremental — rotate attention across eras while the others idle-farm.
6. **THE RIFT** as the endgame skill-check where all global multipliers converge.

---

## 6. Technical Design

### 6.1 Stack
Vanilla TypeScript + Canvas 2D + Vite. No game engine: the deterministic fixed-timestep core **is** the product. DOM/CSS for meta UI (HUD, rewind screen, shops). `localStorage` saves.

### 6.2 Determinism rules (non-negotiable)
- Simulation advances in integer ticks at 60 Hz (fixed timestep with accumulator; rendering reads state, never mutates it).
- All in-sim randomness flows from a seeded PRNG (mulberry32) owned by the sim. `Math.random`, `Date.now`, wall-clock time are banned inside the sim.
- Enemy spawn schedules are precomputed per wave from the era seed at fixed ticks — player behavior cannot perturb them.
- Inputs are quantized to `{tick, x, y, action}` and recorded; an Echo is just the same sim stepped with a recorded input stream bound to player-instance *i*.
- A recording: `{ seedId, ticks: [{t, x, y}...] }`. Kept per era, most-recent-first, capped at max Echo slots.

### 6.3 Era plugin interface
Each era implements a small contract so the core engine, recorder, and meta layer are shared:

```ts
interface EraModule<S> {
  init(seed: number, stats: StatBlock, playerCount: number): S;
  step(state: S, inputs: InputEvent[][], tick: number): void; // inputs[0]=live, [1..]=echoes
  render(ctx: CanvasRenderingContext2D, state: S): void;       // owns its art style
  isOver(state: S): boolean;
  summary(state: S): RunSummary;                               // depth, kills, salvage
}
```

### 6.4 Art direction implementation notes
- **DEFCON LOOP:** additive-feel glow via `shadowBlur`, phosphor trails (gradient strokes), CSS scanline overlay + vignette, screen shake on city loss.
- **FLAK ALLEY:** offscreen low-res canvas (256×240) scaled up with `imageSmoothingEnabled=false`; NES 54-color palette discipline.
- **SIEGEBREAK:** two-tone rendering onto a parchment texture; dithered "ink" fills; jittered line ends for a woodcut feel.
- **BROADSIDE:** 32-color painterly palette, chunky sprite work, parallax sea.
- **PRIMEVAL:** double-wide fat pixels (160×192 backbuffer), deliberately clashing 2600 hues.
- **DEBRIS FIELD:** pure stroked paths, white core + colored glow, wraparound draw at edges.
- **THE RIFT:** projected 3D well (precomputed lane geometry), HSL color-cycling strokes.

---

## 7. Failure Modes & Design Risks

- **Echo staleness:** early recordings become trivial once upgrades outscale early waves → Fast Forward upgrade + option to re-record over your worst Echo.
- **Recording bloat:** input recordings are click events only (bytes per second, not per frame); cap per-era stored runs at max slots.
- **Determinism drift:** guarded by an automated replay test (same seed + same inputs twice → identical state hash) run in CI.
- **Prestige fatigue:** era switching and Resonance exist precisely to vary the loop; auto-rewind + fast-forward keep late loops short.
