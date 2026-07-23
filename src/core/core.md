# src/core — pure domain core

Purpose: every game *decision* — tuning tables, balance curves, wave composition,
gesture classification, run-state math, tech tree, meta-progression — as pure,
DOM-free, deterministic ES modules. Anything here must be importable from node with
no browser globals; randomness enters only as an injected `rng()` (a `() => [0,1)`
function). The app shell (`src/app/`) executes these decisions; it never makes them.

Numbers in this spec are the *initial tuning*; the tables in `config.js` are their
single home in code. Tests pin structural truths (curves monotonic, budgets respected,
prereqs enforced), not exact constants, so tuning stays cheap.

## Modules

| File | Purpose |
|------|---------|
| `geom.js` | Vector helpers: `dist`, `distToSegment`, `clamp`, `lerp`, angle utils |
| `rng.js` | `mulberry32(seed)` — seedable rng for tests; game uses `Math.random` |
| `config.js` | All content tables: enemies, variants, weapons, towers, tech tree, generic level-up cards |
| `balance.js` | Scaling formulas (below) |
| `waves.js` | `composeWave(waveNum, rng)` → spawn plan |
| `gestures.js` | Pointer-trace classification → `tap` / `swipe` / `hold` |
| `tech.js` | Tech tree queries: `canBuy`, `buy`, `effectsOf(owned)` |
| `state.js` | `newRun(meta, towerId)`, XP/leveling, level-up choice generation, shard payout |

## Balance formulas (`balance.js`)

- `enemyHpMult(w) = 1 + 0.22(w−1) + 0.012(w−1)²` — exactly 1 at wave 1, strictly increasing.
- `enemySpeedMult(w) = min(1.6, 1 + (w-1)*0.012)` — capped so lategame stays readable.
- `waveBudget(w) = 8 + 4w + 0.35w²` — strictly increasing.
- `spawnInterval(w) = clamp(1.4 − 0.05w, 0.22, 1.4)` seconds between spawns.
- `xpForLevel(l) = round(10 + 8(l−1) + 1.2(l−1)²)` — XP needed to go from level l to l+1.
- `bossHp(w) = 1500 * (1 + 0.3*(w−5))` for boss waves (w = 5, 10, 15…). *(Tripled
  2026-07-23: a boss's radius means multi-bolt volleys connect in full, so effective
  TTK was near a tank's — bosses must outlast the trash by an order of feel.)*
- `shardPayout(wave, kills, bossKills) = round(3*wave + kills/10 + 8*bossKills)`,
  minimum 1 — **losing must always buy something** (pillar 4). Salvage tech multiplies.
- `enemyMass(age) = 1 + min(2, age/15)` — **shapes gain inertia with age** (1 at spawn,
  capped ×3 from 30s on). Knockback impulses, wall push and aura slow are divided by
  mass, so crowd-control decays against anything that survives long enough — an old
  shape has earned its momentum. (2026-07-23 playtest: complements the frost/orbit
  nerf; permanent CC-lock must not be reachable at any level combination.)
  **Age = time spent inside the combat radius (280px of the Point), not time since
  spawn** — travel time scales with screen size, and aging-in-transit pre-hardened
  everything before its first contact (second 2026-07-23 finding: on a desktop window
  a tank reached the mass cap before reaching the fight).

## Enemies (`config.js: ENEMIES`)

Base shapes; contact with the Point deals `dmg` and the enemy dies (kamikaze), except
the boss, which rams, knocks itself back, and comes again.

| id | shape | hp | speed | radius | dmg | xp | cost | from wave | color |
|----|-------|----|-------|--------|-----|----|------|-----------|-------|
| grunt | circle | 12 | 40 | 12 | 8 | 2 | 1 | 1 | red |
| dart | triangle | 8 | 88 | 10 | 6 | 2 | 1.5 | 2 | amber |
| tank | square | 48 | 26 | 15 | 16 | 5 | 3 | 4 | violet |
| splitter | pentagon | 34 | 34 | 14 | 10 | 6 | 4 | 8 | green — splits into 2 darts (60% dart hp) on death |
| elite | hexagon | 110 | 30 | 18 | 20 | 12 | 8 | 14 | blue |
| boss | nonagon | `bossHp(w)` | 22 | 34 | 26 | 80 | — | every 5th wave | magenta |

**Introductions (2026-07-23 playtest):** content is deliberately drip-fed — roughly one
new shape or variant every 2–3 waves, stretching past wave 20 — and every first
sighting **of the run** fires an on-field introduction: a banner ("NEW SHAPE:
DART — fast and fragile" / "NEW SPECIMEN: REGEN — heals 3% max HP per second") plus a
~3s pulsing highlight ring around the arriving specimen so it can be found on screen.
The banner repeats each run by design — it's a tutorial beat, not a trophy; the
run-scoped record lives in `S.introduced`. Forever-firsts still record to `meta.seen`
(the bestiary). Bosses introduce themselves by name banner instead — no generic card.

## Variants (`config.js: VARIANTS`) — the color/highlight grammar

A variant is a *modifier* on a base enemy: stat multipliers + one visual highlight.
Shape encodes species; highlight encodes the variation (pillar 3).

| id | visual highlight | effect | xp mult | from wave |
|----|------------------|--------|---------|-----------|
| swift | white-hot glow outline | speed ×1.7, hp ×0.8 | 1.3 | 6 |
| armored | thick steel outline | hp ×2.5, speed ×0.8 | 1.6 | 11 |
| regen | green pulsing ring | heals 3% max hp / s | 1.5 | 17 |
| shielded | rotating ring segments | absorbs first 3 damage instances (ring depletes visibly) | 1.6 | 21 |
| volatile | pulsing orange core | on death: burst r=70 — **heals nearby shapes 30% of their max hp** and damages the Point if in range (reworked 2026-07-23: friendly fire made popping them a free win; a medic-bomb makes target priority a real decision) | 1.4 | 23 |

Roll: from wave 6, each non-boss spawn has `min(0.35, 0.015*(w−5))` chance of one
variant chosen uniformly **from those whose `from wave` has arrived** — the pool
widens as the run deepens, so each variant gets its own debut. Debut waves avoid
boss waves (multiples of 5) so introduction banners and boss-name banners don't
land together — hence shielded at 21, not 20. (Ordering intent: mechanically
simplest first; volatile last because its lesson costs the most to learn.)

**Boss variants:** bosses roll no variants until the name roster recirculates
(boss #8, wave 40). From then on, every returning noble carries a **guaranteed**
variant from the debuted pool, announced as an epithet — *"SIR CUMFERENCE, THE
ARMORED"*. A name you've beaten coming back changed is the lategame's escalation.

## Weapons (`config.js: WEAPONS`)

Manual (gesture) weapons:

| id | gesture | max | levels |
|----|---------|-----|--------|
| bolt | aim | 6 | auto-fires toward the aim point every 0.34−0.02L s (needs a live enemy); dmg 9+4L; L3: 2 bolts, L5: 3 bolts (small spread); L4: pierce 1; **L6: adds an independent second volley at the nearest shape** |
| wall | swipe | 5 | **Force Wall** (reworked twice, 2026-07-23): the swipe conjures a stationary wall **anchored at the gesture's start** (length 150+40L; longer swipes trimmed toward the start — overshooting the tail must not move the wall). The wall is *siegeable*: it has **70+35L HP** that degens passively over ~5s, and shapes in contact **attack it** (their dmg every 0.9s) while being pushed along its tower-away normal at (100+25L)÷mass px/s and taking 4+2L dmg per 0.4s tick. Wall dies at 0 HP, whichever clock runs out first. Active walls: **1 until max level, 2 at L5**; swiping past the cap replaces the oldest; cd 0.4s |
| beam | hold | 5 | ticks **per-target every 0.25s** at dps 30+18L (damage = dps×0.25 per tick) — so a shield loses one charge per *tick*, never per frame (playtest 2026-07-23: frame-rate ticking erased shields on touch); **per-target damage ramp** ×1→×2.5 over 2s of continuous exposure, decaying back over ~1.5s once out of the beam — sustained tracking is rewarded, field-flicking isn't; heat 0→1 in ~3.5s, forced cooldown at 1; L3: slower heat; **L5: no overheat and always-on — channels toward the standing aim point with no hold needed** (a no-overheat beam that still demanded holding would just be a finger tax) |

Auto weapons (level-up pool):

| id | max | behavior |
|----|-----|----------|
| orbit | 5 | blades orbiting the Point — count 1/2/2/3/5, dmg 9+5L, per-enemy hit cooldown 0.35s |
| nova | 5 | expanding ring every 5.2−0.6L s (floor 1.8), dmg 14+7L, radius 120+26L |
| frost | 5 | slow aura, radius 100+26L, slow 22/28/33/38/45% *(was …62%; capped after the 2026-07-23 playtest — max slow + orbital knockback held enemies in place indefinitely)* |
| tesla | 5 | chain lightning every 2.3−0.22L s: 2/3/3/4/6 chains, dmg 11+6L, falloff 0.8/jump — **tech-locked** |
| seek | 5 | homing missiles: 1/1/2/2/3 per volley every 2.6−0.3L s, dmg 18+9L, small AoE — **tech-locked**. **Trajectory re-acquisition:** when a missile's target dies *or falls behind its heading*, it locks onto the best-aligned shape ahead of it instead (falling back to nearest if nothing's ahead) — a whiff curves into new prey rather than orbiting a lost cause (2026-07-23 playtest: limited turn rate made misses ineffective) |
| turret | 5 | orbiting mini-turrets 1/1/2/2/3 shooting nearest, dmg 7+3.5L, cd 1.0−0.09L — **tech-locked** |

Generic cards (always in pool): **Repair** (restore 40% max hp; only offered when
below 70%), **Bulkhead** (+25 max hp, heals the same), **Overclock** (+10% damage,
stacking additively on the run's damage multiplier).

Level-up choice generation (`state.js: levelChoices(state, rng)`): 3 distinct options
drawn from {each owned weapon below max, each unowned *pool-unlocked* weapon, generic
cards}. New weapons are tagged NEW; upgrades show current→next level.

## Towers (`config.js: TOWERS`)

Every tower taps bolt (pillar 1). Identity = stat profile + extra starting weapon.

| id | name | unlock | hp | dmg | xp | starts with |
|----|------|--------|----|----|----|-------------|
| bastion | Bastion | free | 100 | ×1.0 | ×1.0 | bolt L2 |
| tempest | Tempest | tech | 80 | ×1.0 | ×1.1 | bolt L1 + tesla L1 (tesla need not be pool-unlocked — the tower *is* the unlock; it may be upgraded in-run regardless) |
| warden | Warden | tech | 130 | ×0.9 | ×1.0 | bolt L1 + nova L1 |
| lance | Lance | tech | 85 | ×1.1 | ×1.0 | bolt L1 + beam L1 |

## Tech tree (`config.js: TECH`, logic in `tech.js`)

Nodes: `{id, branch, name, desc, cost, req: [nodeIds], effect}`. `canBuy` requires:
not owned, all `req` owned, shards ≥ cost. Effects aggregate in `effectsOf(owned)`:
additive within a stat (`hpBonus`, `dmgMult`, `xpMult`, `regen`, `dmgTakenMult`,
`cdMult`, `critChance`, `salvageMult`, `startLevel`), plus set-valued
`unlockWeapons` / `unlockTowers`.

| branch | nodes (cost◆, req) |
|--------|--------------------|
| Hull | Vitality I/II/III (+20 hp; 15/30/60, chained) · Plating I/II (−8% dmg taken; 40/80, req Vitality I then chained) · Nanites I/II (+0.5 hp/s; 35/70, req Vitality I then chained) |
| Arms | Overcharge I/II/III (+8% dmg; 15/30/60, chained) · Precision (10% crit ×2; 50, req Overcharge II) · Haste I/II (−6% cooldowns; 40/80, req Overcharge I then chained) |
| Mind | Quick Study I/II (+10% xp; 15/35, chained) · Head Start (start at level 2 with a free pick; 45, req Quick Study I) · Salvage I/II (+20% shards; 30/60, req Quick Study I then chained) |
| Arsenal | Unlock Tesla (25) → Unlock Seekers (45) → Unlock Turrets (70) — chained |
| Towers | Tempest (40) → Warden (75) → Lance (120) — chained |

Tuning intent: a first run reaching wave 5–8 pays ~20–40◆ — enough for one node.

## Gestures (`gestures.js`)

A trace is `{t0, points: [{x, y, t}], holdEngaged}`. Classification:

- **hold** — engages *during* the gesture once `t − t0 ≥ 0.28s` while max displacement
  from origin < 14px, and only if the run owns a hold weapon. Once engaged, moving the
  finger aims the beam (movement no longer reclassifies). Ends on release.
- **swipe** — on release, if not hold-engaged and total path length ≥ 30px. Payload:
  first→last point segment.
- **tap** — anything else on release. Payload: release point.

**The aim point** is a separate, standing input (not a gesture): every pointer
position update — hover on desktop, any touch/drag on mobile — moves it, and the bolt
auto-fires toward it. Taps therefore *aim* rather than fire; a swipe with no force
wall owned still re-aims at its endpoint (no dead inputs, README pillar 1).

One hold at a time; concurrent other pointers still resolve as taps/swipes
(multi-touch: beam with one finger, tap-fire with another).

## Run state (`state.js`)

`newRun(meta, towerId)` folds tech effects + tower profile into starting stats:
`maxHp = (100 + hpBonus) * tower.hpMult`, `dmgMult = (1 + dmgMults) * tower.dmgMult`,
etc. XP: `addXp` applies xp multipliers, consumes `xpForLevel` thresholds, and returns
the number of level-ups gained (the shell opens one choice screen per pending level).
Wave-clear heals 4% max hp. `payout(state, meta)` computes shards (with salvage) and
returns the new meta (shards added, best wave maxed, no other mutation).

Meta shape (persisted by the shell, versioned key `pointdefense.meta.v1`):
`{ shards, best, tech: [nodeIds], tower: lastSelectedId, sound: bool,
seen: { enemies: [kinds], variants: [ids] } }`. `seen` is the **bestiary's discovery
record**: a kind/variant is recorded the first time one spawns in a run (sighting, not
kill); undiscovered entries render as "?" cards. Old saves without `seen` inherit the
empty default on load. Enemy/variant tables in `config.js` carry `lore` + display
`desc` strings for the bestiary — content, single home.
