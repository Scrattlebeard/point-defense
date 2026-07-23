# ADR-0003: Mastery progression — the web, weapon trees, tower paths

**Status:** ACCEPTED 2026-07-24 (Daniel), with amendments — see Addendum below
**Deciders:** Daniel (design authority), Zephyr (drafting)
**Context:** Daniel's ask, verbatim shape: more weapons; a generic tech tree that
*looks like an actual tree or web* with many more options and escalating costs;
per-weapon upgrade paths as separate trees with experience earned *by using the
weapons*, able to unlock variants or significantly change weapon behavior;
per-tower upgrade paths earned by using that tower, giving towers distinct
identities.

## Decision (proposed)

Three progression systems, three currencies, one interaction grammar.

### 1. The Lattice — generic tech web (replaces the 5-column tech tree)

- **Radial layout centered on the Point motif**: the tech screen becomes a
  defense-grid diagram — nodes radiate outward from a center hub in sectors,
  depth ring = cost tier. The metaphor is free cohesion: you are literally
  building out the Point's lattice.
- **Web, not tree**: most nodes have one prerequisite edge, but sectors
  cross-link at their borders (a node may require `A OR B`), so hybrid builds
  route sideways instead of grinding a second trunk from the root.
- **Scale**: ~50–60 nodes (from today's 24). Sectors: **Hull, Arms, Mind,
  Arsenal, Salvage** (Salvage split out of Mind: economy is its own identity),
  plus **Towers** as unlock nodes at sector borders.
- **Node kinds**:
  - *Stat nodes* — small stackable bumps (today's +hp/+dmg/+xp family), cheap,
    many.
  - *Unlock nodes* — weapons and towers entering the pool (today's Arsenal).
  - *Keystones* — build-changers at ring 3+, e.g. "Overheat Vents: the beam's
    forced cooldown fires a nova pulse", "Dead Man's Wall: expiring walls
    detonate". One per sector at most owned… no cap actually — costs cap it.
- **Escalating costs**: ring cost bands ~15 / 40 / 100 / 250 / 600 shards. The
  shard payout curve gets a matching pass — deep lattice is weeks of play, not
  days.
- **Currency: shards** (existing). Shards buy *only* lattice nodes.

### 2. Weapon mastery — per-weapon trees, earned by use

- **Weapon XP**: each weapon earns its own XP in-run; persists in meta.
  **The metric matches the weapon's job, not damage universally**:

  | weapon | earns by |
  |--------|----------|
  | bolt, beam, nova, tesla, seek, turret, orbit | damage dealt |
  | frost | enemy-seconds slowed (×rate constant) |
  | wall | damage dealt + damage absorbed by the wall |

  Rationale: damage-only would starve the utility weapons exactly where their
  mastery matters most. Rates tuned so a weapon used all run earns roughly one
  early node per run.
- **Tree shape per weapon**: a short **trunk** (4–5 nodes: % stat deepeners,
  cheap) forking into **two mutually exclusive aspects** (2–3 nodes each) that
  *change behavior*, not numbers. One aspect active per weapon; switching is
  free between runs (locked during). In-run leveling (L1–max) is untouched —
  aspects re-flavor what the levels already do.
- **Aspect draft table** (content illustrative, tuned at implementation; the
  *fork-per-weapon structure* is the decision):

  | weapon | aspect A | aspect B |
  |--------|----------|----------|
  | bolt | **Railgun** — fans collapse into one piercing lance, slower cd | **Scattergun** — wider fans, +1 flank per fan, −dmg per bolt |
  | wall | **Rampart** — longer, tougher, walls block enemy contact longer | **Dead Man's Switch** — walls detonate on expiry (synergy w/ keystone) |
  | beam | **Prism** — kills split the beam to a second target briefly | **Cutter** — sweeping the beam across shapes deals bonus edge damage |
  | orbit | **Sawstorm** — more, smaller blades, faster | **Bulwark Blades** — fewer, huge blades that also block enemy bullets/bodies briefly |
  | nova | **Implosion** — ring pulls shapes inward before damaging | **Echo** — second half-strength ring 0.5s later |
  | frost | **Shatter** — shapes that die while slowed burst for AoE | **Permafrost** — brief root on entering the aura (once per shape) |
  | tesla | **Storm** — chains can fork | **Capacitor** — longer charge, double damage discharge |
  | seek | **Swarm** — more, weaker missiles | **Warheads** — fewer, bigger blast |
  | turret | **Overwatch** — turrets prioritize your aim target | **Artillery** — slow arcing AoE shells |

- **Currency: that weapon's XP only.** No pooling, no conversion.

### 3. Tower paths — identity amplifiers, earned by playing the tower

- **Tower XP**: waves cleared with that tower (bosses count double).
- **Small linear-ish paths** (5–6 nodes): passive amplifiers early, one
  **signature** late, e.g. Bastion "Second Wind" (once per run, survive a
  killing blow at 1hp); Tempest "Overload" (tesla discharge on taking damage);
  Warden "Aftershock" (novas leave a slowing field); Lance "Focus" (beam ramp
  cap rises). Signatures are the tower identity statement.
- **Currency: that tower's XP only.**

### 4. New weapons

Two in this work's scope, entering via Arsenal unlock nodes: **Mines**
(proximity area-denial — drops behind the frost/wall identity space) and
**Mortar** (slow arcing AoE vs crowds — the anti-cluster tool the late game
lacks). Full treatment each: spec row, aspects, bestiary-grade visuals, sim
coverage. More weapons later ride the same rails.

## Guardrails (the part that keeps this from eating the game)

1. **Progressive disclosure.** A fresh install sees exactly today's game. The
   Lattice appears at first shard payout (as today); a weapon's mastery tree
   appears only when that weapon hits its first XP threshold; a tower's path
   appears after clearing wave 10 with it. Menus never show three empty trees
   to a player who hasn't earned questions that need answers.
2. **One interaction grammar.** A single graph-view component (SVG in the DOM
   overlay layer; pan by drag, nodes show name/cost/state) renders all three
   systems. Learn it once.
3. **Three currencies, three questions, zero conversion.** Shards = account
   breadth. Weapon XP = this weapon's depth. Tower XP = this tower's depth.
   The moment currencies convert, players optimize exchange rates instead of
   playing favorites.
4. **Calibration is part of the loop now.** The death-wave spike graduates to
   `scripts/calibrate` (committed tool): fresh-run median must stay in the
   wave 5–10 band; a maxed-lattice bot run gets its own target band (to be
   established at stage 1). Any stage that moves the medians out of band
   doesn't land.
5. **Save migration.** `meta` gains a schema version; `defaultMeta()` deep-fills
   missing fields so existing saves upgrade losslessly. Tested.

## Staging (each stage lands independently, ships green)

- **Stage 1 — the Lattice.** Data model (`tech.js` generalizes to graph w/ OR
  edges), radial SVG view, node content ×~50, cost/payout rebalance,
  `scripts/calibrate`, save migration scaffold. *Biggest single stage; pure
  superset of today's tech tree.*
- **Stage 2 — weapon mastery.** XP earn hooks in the sim (pure, tested), meta
  persistence, per-weapon trees + aspects for all 9 weapons, mastery UI via the
  stage-1 graph component.
- **Stage 3 — tower paths + new weapons.** Tower XP + 4 paths + signatures;
  Mines + Mortar with aspects.

Estimate honestly: three overnight sessions, one per stage, each ending in a
reviewable `.md` diff + green suite + deploy. Stage boundaries are the abort
points — the game is never mid-surgery between nights.

## Alternatives considered

- **One mega-tree holding everything** (weapons/towers as branches of the
  Lattice, shards buy all): fewer systems, but use-based earning is the whole
  point of Daniel's ask — buying beam depth with generic shards says nothing
  about *playing* beam. Rejected.
- **In-run-only depth** (aspects as rare level-up cards, no meta): cheaper, but
  abandons persistence and the "my bolt is *mine*" ownership arc. Rejected.
- **Prestige/reset loops**: classic roguelite lever, but it resets exactly the
  ownership this builds. Deferred indefinitely.
- **Canvas-drawn tree UI**: full visual control, but DOM/SVG gets hit-testing,
  scrolling and accessibility for free, and every other overlay is DOM already.
  Rejected.

## Open questions — ANSWERED (Daniel, 2026-07-24)

1. Aspect switching: **free** between runs.
2. Weapon XP visibility: **post-game screen and mastery/tree screens only** —
   supersedes the drafted pause-panel placement; combat and pause stay clean.
3. Mines/Mortar: **promoted to stage 1.**

## Addendum — the mega-lattice amendment (Daniel, 2026-07-24)

Stage 1 builds **one large, deep lattice now**, accepting that parts will later
migrate into the diverged weapon/tower trees of stages 2–3. Priorities, in
order: (1) **layout and presentation** that make players want to keep playing;
(2) **depth** — enough rings and escalating costs to generate a real felt sense
of progression pacing, *even if early content is mostly stat nodes*; (3)
interesting behavior-changers arrive afterwards, on rails the mega-lattice
establishes. Consequence: keystones largely defer to later stages; stage 1's
node population is deliberately stat-heavy; the shard payout curve gains a
superlinear term (core.md) and is explicitly provisional — feeling out the
economy is a stage-1 goal, not a risk.
