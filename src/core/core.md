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
| `state.js` | `newRun(meta, towerId, rehearsal)`, level grants (run start + per wave cleared), level-up choice generation, shard payout |

## Balance formulas (`balance.js`)

- `enemyHpMult(w) = 1 + 0.58(w−1) + 0.003(w−1)²` — exactly 1 at wave 1, strictly
  increasing. *(Re-reshaped 2026-07-24 — the onboarding curve: playtest verdict "we
  start out too easy"; a new player's first death should arrive within player levels
  ~5–10 so the first tech-tree visit is minutes away, not a quarter-hour. Front-loaded
  linear slope, trimmed quadratic, converging with the 2026-07-23 curve ≈ wave 35 and
  running slightly under beyond 40 — early bites harder, lategame keeps its shape.
  **Calibrated by spike, not hand-waving:** headless robot runs (perfect 0.2s
  retargeting, random picks, no walls/beam — a rough stand-in for a new human) died
  at median wave 14 / lvl ~15 before, median wave 9 / lvl 8–11 after, first death in
  3.5–5.5 min paying ~30 shards ≈ two starter tech nodes. Deaths quantize to boss
  waves (5/10/15) — the intended wall is a named boss, not trash. (Re-checked after
  the same-day bolt-fan/orbit/nova rebalance: median 10, range 5–20 — still in band,
  the buffed early autos lift the lucky tail more than the floor.) **Round 4 (same
  day, "crank the enemy opening another notch"):** linear 0.185→0.34→**0.46**, quad
  down to 0.004, converging with the original 2026-07-23 curve ≈ wave 45. The notch
  was largely spent *holding the band against nova's second range buff* — nova at
  L1-radius 210 with no enemy change sent the bot median to 17. First attempt put
  the notch in `waveBudget` and made runs LONGER (median 17) — at the time, bodies were XP; the
  budget-as-difficulty mistake is now twice-confirmed, durability is the only
  early-difficulty lever that doesn't feed the player. *(Since ADR-0015 removed XP,
  chaff volume feeds the player nothing at all — the finding stands, but it now rests
  only on its other leg: bigger budgets lengthen waves without deepening them.)* Result: median 10, range
  5–20; no-nova runs eat the full ~+20% early HP. **Round 5 ("MOAR early enemy
  hp!!", same day):** linear 0.34→0.46→**0.58**, quad 0.003 — pure HP notch, no
  offsetting buffs. 16-trial spike: median 9, range 4–20, and the shape shifted —
  ~45% of fresh runs now end at the *first* boss (lvl 6–8, ~3 min), most of the
  rest at the wave-10 noble. The first shop visit is nearly guaranteed inside
  Daniel's 5–10-level onboarding band. Durability was the
  lever because volume fed back: more bodies = more XP, and the player scaled with
  the wave (true until ADR-0015; volume now feeds nothing); tried first, moved the
  median barely. Contact damage stays untouched.
  **Round 7 (2026-07-25, paying for the composition change):** linear 0.58→**0.70**.
  Cost-weighted composition ("Wave composition") deliberately makes early waves
  chaff-heavy — at wave 5 the mix went from 33/34/32 grunt/dart/tank to 50/33/17,
  which is the intended design but carries ~12% less total wave HP in cheaper,
  faster-dying bodies. Measured consequence: the fresh-run median moved from a
  rock-steady **8** (four consecutive 32-trial runs pre-change) to **9–11**, parking
  it exactly on the band's upper bound — so the prod gate became a coin flip rather
  than a guardrail. Durability is the sanctioned compensator (see the round-4/5 note
  above: budget feeds the player, durability does not), and 0.70 restores median 8
  with margin. **The mix is the design and was not touched to fix this** — the
  difficulty loss was paid for separately, which is the whole reason the two levers
  are kept distinct.)*
- `enemySpeedMult(w) = min(1.6, 1 + (w-1)*0.012)` — capped so lategame stays readable.
- `waveBudget(w) = 22 + 7w + 0.21w²` — strictly increasing. *(2026-07-24, same
  reshape: more bodies early, converging with the previous budget ≈ wave 22 and
  running ~10% under at wave 40 — the deep waves lean on tougher shapes instead.)*
- `spawnInterval(w) = clamp(1.1 − 0.05w, 0.22, 1.1)` seconds between spawns (pacing
  tightened alongside the bigger early waves).
- `mixTilt(w) = clamp(0.55·(w−14)/40, 0, 0.55)` — the composition tilt (Enemies
  → "Wave composition"): 0 until the elite debut at wave 14, reaching 0.55 at wave
  54. Species budget share ∝ `cost^mixTilt`, pick weight ∝ `cost^(mixTilt−1)`.
- **Levels come from waves, not kills** (ADR-0015): the run opens at level 1 and every
  wave cleared pays one level (ADR-0016 — 0015 opened with a draft of three; the player
  starts at the bottom and climbs instead). Level at the start of wave N is N. There is no XP curve — the old one is gone, and the measurement that
  killed it showed it had been paying exactly 1.00 levels/wave (min = max, 40 runs) at
  every depth anyway.
- `stackChance(w) = w < 40 ? 0 : clamp(0.12 + 0.012(w−40), 0, 0.55)` — the chance a
  variant-bearing spawn gains *another* variant, rolled repeatedly to a cap of 3
  (Variants → "Stacking"). At wave 60 roughly an eighth of all spawns carry two or
  more; stacked shapes are meant to be a scary minority, never the texture.
- `hpBarThreshold(w) = 2.4 · grunt.hp · enemyHpMult(w)` — a shape shows an HP sliver
  when it is beefy *for its wave* (app.md "fill encodes allegiance"; bosses always
  show one). ≈ the old absolute `40` at wave 1 by construction (38.4 — deliberately just under, so an armored grunt, at exactly ×2.5, clears it), and unlike it
  does not go dead as the HP curve climbs. Variants count: an armored grunt is beefy
  and earns a bar, which is the rule working.
- `waveTrashHp(w) = waveBudget(w) · E[hp per cost] · enemyHpMult(w)` — the expected
  total HP of a wave's non-boss bodies, where `E[hp per cost]` follows the same mix
  weights `composeWave` uses (Enemies → "Wave composition"). Exists so the boss
  curve can be *derived from* the wave rather than drifting against it.
- `bossHp(w) = max( bossTargetTtk(w) · referenceDps(w), presenceFloor(w) )` — **a boss
  fight is an event with a designed length, and its HP is whatever produces that
  length** (ADR-0012, superseding ADR-0008's fixed share).
  - `bossTargetTtk(w)` ramps **`BOSS_TTK_FIRST` → `BOSS_TTK_TARGET` by wave 25**, then
    holds. The first boss is still the shortest — it is the onboarding wall where ~45%
    of fresh runs end — but not *trivial*: raised 15s → **22s on 2026-07-26** because
    Daniel found the wave-5 noble "too little HP to be meaningful". Raising the ramp's
    floor is the whole change: it lifts wave 5 by **+47%**, wave 10 by **+14.5%** (his
    stated 10–15%), and converges to ~2% by wave 20, so the mid and late curve — which
    nobody complained about — is left alone. One constant, because the complaint was
    about the *shape* of the early ramp rather than about two waves.
  - `referenceDps(w) = 8.0 · w^1.15` — **fitted to measurement, not derived.** Player
    power comes from level-ups, weapon ladders and build luck; none has a closed
    form. The reference is a **fresh account playing naturally**, because a maxed
    loadout is not what anyone holds at wave 20. `scripts/bosstime.mjs` is the
    instrument that makes this constant rot loudly when weapons change.
  - **Presence floor** — `BOSS_HP_SHARE = 0.10` survives from ADR-0008 as a *floor*,
    not a definition, so a boss can never decay into one chunky elite among forty.
    It binds past roughly wave 55, where a fresh account's dps has plateaued and only
    the tech tree can keep the fight bounded. That is the lattice doing its job.
  - **`BOSS_TTK_TARGET = 100` is a compromise and is labelled as one in the source.**
    The design intent is **60s** (Daniel). Measured, 60s is not currently reachable:
    the conductor gate reads ×1.109 at 60s (fails), ×1.125 at 90s (a 0.4% margin,
    refused as a coin flip), **×1.227 at 100s** (holds). Below ~90s the do-nothing run
    stops dying, because **Law·Delegation was being enforced almost entirely by boss
    health bars** — the finding that forced the next bullet.
  - *(Why the share was wrong, kept because the reasoning outlives the numbers: a
    share normalises the boss against the **enemy** budget, but whether a boss is a
    focus-forcer or a sponge is time-to-kill, which depends on **player damage** —
    absent from that formula. Measured on a fresh account, boss alive-time ran 19s at
    wave 5 and **212s at wave 45**, because `bossHp` grew as **w^2.19** while natural
    player dps grows as **w^1.15**. Two curves that were never compared. The tell was
    already in ADR-0008, which had to bolt on "any future increase must re-check
    time-to-kill": a lever needing a manual check of a different quantity is a proxy,
    not a control.)*
  - **Bounded above by the stall constraint, which is load-bearing:** the wave
    director will not start wave w+1 until the field is empty (`game.js`, phase
    `clear`), so a boss too tanky to kill does not raise difficulty — it *freezes
    the run* at that wave. This is why the fight length is now the thing being
    controlled directly rather than inferred.
- *(`BOSS_AUTO_RESIST` was **removed 2026-07-26, ADR-0013.** It made delegated damage land
  at half on a boss, which upheld Law·Delegation but did so as a permanent, invisible,
  global multiplier with no tell — the exact failure this file already names for `guard`
  ("without a tell this reads as 'my weapons stopped working'"). The decisive objection was
  not the player's but the designer's: **a hidden multiplier corrupts every measurement taken
  through it**, so changing boss HP produced effects composed with a factor nobody could see.
  Law·Delegation is consequently unenforced at the boss and the conductor gate is knowingly
  RED — see ADR-0013 for why a visibly failing law is safer than an invisibly upheld one, and
  for the telegraphed replacement.)*
- `BOSS_ENTRY = 0.33` — where the boss enters its wave's spawn queue. Appended last
  (the old behaviour) it fought an **empty field**, because the wave was already
  cleared by the time it arrived — a solo duel, which is the opposite of a
  focus-forcer. A third of the way in leaves two thirds of the wave still landing.
- `shardPayout(wave, kills, bossKills) = round(2.5*wave + kills/9 + 9*bossKills +
  0.18*wave²)`, minimum 1 — **losing must always buy something** (pillar 4). Salvage
  tech multiplies. *(Superlinear term added with the Lattice, ADR-0003 stage 1: the
  web's deep rings cost 250–600, so deep runs must pay deep — a wave-20 run now
  yields ~250 base instead of ~140. Provisional by design: the whole point of the
  mega-lattice is to feel out progression pacing; expect this curve to move.)*
- `enemyMass(age) = 1 + min(2, age/15)` — **shapes gain inertia with age** (1 at spawn,
  capped ×3 from 30s on). Knockback impulses, wall push and aura slow are divided by
  mass, so crowd-control decays against anything that survives long enough — an old
  shape has earned its momentum. (2026-07-23 playtest: complements the frost/orbit
  nerf; permanent CC-lock must not be reachable at any level combination.)
  **Bosses resist knockback ×6 on top of age-mass** (`BOSS_KNOCK_RESIST`,
  2026-07-24 — a shape with a name should not be shoved around by an orbital graze).
  Applies to *player-inflicted* impulses only (`applyKnock`): the boss's ram recoil
  is self-imposed and unaffected, and frost slow deliberately keeps full effect on
  bosses — frost's role as the counter-boss tool survives the resistance.
  **Age = time spent inside the combat radius (280px of the Point), not time since
  spawn** — travel time scales with screen size, and aging-in-transit pre-hardened
  everything before its first contact (second 2026-07-23 finding: on a desktop window
  a tank reached the mass cap before reaching the fight).

## Enemies (`config.js: ENEMIES`)

**A besieging shape is explicit state, not a distance test.** While a shape holds
the rim it carries `e.sieging = true`, and each strike sets a decaying `e.strike`
marker. Both exist so the renderer can answer *"who is hurting me?"* without
re-deriving geometry — the shell owns the fact, the view reads it (pillar 5).
*(2026-07-25: damage attribution was the missing half of the death-shape problem.
Measured the same night, a run bleeds a median 40s of which only ~6s is the actual
drowning; a besieger announced itself with a small particle burst and a generic
tower shake, so several shapes on the rim were indistinguishable and "your line has
a hole" — the signal GDD §2 says a chip is — never arrived. The **wind-up telegraph**
matters more than the hit flash: a tell that fires ~0.25s **before** the strike is
what makes the threat answerable, and an unanswerable chip is bookkeeping.)*

Base shapes; on reaching the Point they **besiege** it: stop at the rim and strike
for `dmg` every 0.9s (first strike on arrival) — same siege grammar as the force
wall ("shapes in contact attack it"). Knockback still applies, so CC can shove a
besieger off the rim; it walks back in. The boss keeps its own melee identity:
ram, self-knockback, come again. *(Reworked 2026-07-24 from v1 kamikaze — contact
killed the attacker, uncelebrated. Consequences of the rework are deliberate:
every shape now dies by player hand, so nothing leaves the field uncontested;
splitters split and
volatiles burst even at the rim — a volatile reaching the Point is a standing
threat, not a free trade.)*

**Spawn geometry — time-to-Point is the invariant, not speed** (`geom.edgeSpawn`,
2026-07-23). Wave spawns appear ON the arena wall (uniform over the perimeter, offset
outward by radius + 6 so the first visible frame is at the wall) with base speed scaled
by `distToPoint / (max(W,H)/2 + pad)`: every shape's wall-to-Point run takes the same
time regardless of screen aspect or spawn side. Short-axis shapes move visibly slower,
long-axis shapes at full speed — the reaction window a player gets is a *time* budget,
and it must not depend on which edge fate picked or whether the screen is a phone or an
ultrawide. The reference matches the old spawn circle (`max(W,H)/2 + 60`), so wave
pacing is balance-neutral vs. the 2026-07-23 playtest baseline. Before this, spawns sat
equidistant on that circle: total time was already uniform, but long-axis shapes walked
most of it off-screen and popped in with a fraction of the visible warning (the
widescreen top/bottom ambush, reported same day). Split/volatile children (explicit
spawn position) are unscaled — they were born inside, not at the gate. Variant speed
multipliers (swift ×1.7) stack on top: a swift is still a swift *relative to its lane*.

| id | shape | hp | speed | radius | dmg | cost | from wave | color |
|----|-------|----|-------|--------|-----|------|-----------|-------|
| grunt | circle | 16 | 44 | 12 | 8 | 1 | 1 | red |
| dart | triangle | 9 | 96 | 10 | 6 | 1.5 | 2 | amber |
| tank | square | 60 | 29 | 15 | 16 | 3 | 4 | violet |
| splitter | pentagon | 43 | 37 | 14 | 10 | 4 | 8 | green — splits into 2 darts (60% dart hp) on death |
| elite | hexagon | 138 | 33 | 18 | 20 | 8 | 14 | blue |
| boss | nonagon | `bossHp(w)` | 24 | 34 | 26 | — | every 5th wave | magenta |

*(Balance round 6, 2026-07-24: ~+10% base hp and speed across every species —
human play after round 5 still outran the pressure; base stats moved rather than
the wave curves so the change is uniform from wave 1. Calibrate band re-verified.)*

### Wave composition (`waves.js: composeWave`)

**Each available species is allocated a share of the wave budget, and spends that
share on bodies at its own cost.** So a species' *body count* is its budget share
divided by its cost: cheap species are numerous, expensive ones are rare, and cost
governs the mix rather than merely the wave's size. Picking is therefore weighted
`∝ share / cost`, not uniform.

**The tilt — composition is the escalation lever.** Shares are equal until wave 14
(the elite debut); from there the allocation **tilts toward the expensive species**,
reaching its endpoint at wave 54 and holding: `share ∝ cost^tilt(w)`, so the pick
weight is `cost^(tilt−1)`. Deep waves buy fewer, meaner bodies out of the same
budget point. Measured trajectory (share of wave HP): elites **24% at wave 14 → 39%
at wave 60**; grunts 23% → 12%; body counts rise the whole way (77 at w14, 293 at
w45, 1016 at w100).

*(Rewritten 2026-07-25. The previous rule picked a species **uniformly** and only
subtracted its cost afterward, so cost regulated wave size and never the mix. The
measured result: the species share was **20/20/20/20/20 at wave 14 and identical at
wave 500**, elites were 52% of wave HP against grunts' 6% — "chaff the autos eat"
barely existed, there was one answer to "what now?", and the threat distribution was
frozen from wave 14 forever, in a game aimed at wave 50–100. The tilt is what makes
GDD §5's content doctrine — "denser and meaner" — true past wave 29, where every
other composition lever is inert. Tilt endpoint and reach are tuning; the pinned
truths are structural: cheap species outnumber expensive ones, and the expensive
share rises with the wave.)*

**This change does not stand alone, and must not be re-tuned alone — ADR-0008.**
Restoring chaff *broke* Law·Delegation on its own (the conductor gate went to
hands-worth-1-wave, parked deaths 0/11): chaff is exactly what autos eat, and a
conserved budget means buying cheap bodies takes budget from expensive ones. A
steep tilt makes the gate pass by producing a **59%-elite mix — worse than the bug
being fixed**. The boss re-slope below is what actually restores the law; the mix
is guarded at the test tier (chaff never below 15% of bodies) so a future change
cannot buy a green gate by deleting the chaff.

**Introductions (2026-07-23 playtest):** content is deliberately drip-fed — roughly one
new shape or variant every 2–3 waves, stretching past wave 20 — and every first
sighting **of the run** fires an on-field introduction: a banner ("NEW SHAPE:
DART — fast and fragile" / "NEW SPECIMEN: REGEN — heals 3% max HP per second") plus a
~3s pulsing highlight ring around the arriving specimen so it can be found on screen.
The banner repeats each run by design — it's a tutorial beat, not a trophy; the
run-scoped record lives in `S.introduced`.

**No more than two consecutive waves carry a new beat.** Introductions land at
waves 1, 2, 4, 5, 7, 8, 11, 14, 17, 21, 23 (and 40, when modifiers begin to stack),
so the player never meets three unfamiliar things in three waves. *(Swift moved from
wave 6 to 7 on 2026-07-25. Tank at 4, the boss at 5 and swift at 6 were three beats
in three waves, landing squarely where ~45% of fresh runs end — peak content firehose
at peak difficulty wall. The guaranteed-debut change the same day made that cluster
**certain** where it had previously been a 53% coin flip, which is what forced the
fix: solving one problem sharpened another.)*

*Rejected by measurement, recorded because the rejected option was the prettier one:*
moving tank to 3 and splitter to 9 as well would have given a beat every other wave —
1, 2, 3, 5, 7, 9 — and filled the empty wave 3. Measured over four 48-trial runs it
also **widened the onboarding spread** (medians 9/9/5/9 against a baseline that sits
tight at 8–9, and a death floor dropping to wave 3), because tanks at wave 3 make
early runs bimodal. A wider spread means a band gate that flakes at both edges, which
is the failure this project fixed the same night. The smallest change that solves the
stated problem won.

**A debut is guaranteed, not hoped for.** On the wave a variant's `minWave` names,
`composeWave` marks one non-boss spawn as its **debut** (`plan.debutVariant` +
`plan.debutAt`; core decides both what and where, the director only executes). That
specimen wears **exactly** that modifier — never a stack, never a second roll on top
— because a debut is a teaching beat and the whole point is to show one new thing
cleanly.

*(Added 2026-07-25. Before this, a debut was just the first wave on which the variant
became **eligible**, at the ordinary `variantChance` roll — so it fired when the dice
allowed. Measured over 4000 waves: swift's nominal wave-6 debut actually happened
that wave in **53%** of runs. **A tutorial beat that fires "usually" is not a
tutorial beat** — half of all players met their first modified shape at some
unannounced later moment, or as a nasty surprise mid-fight. The variant may of course
also roll normally on other spawns in the same wave; the guarantee is a floor, not a
cap.)*

**The regime change announces itself.** The first *stacked* shape of a run (two or
more modifiers on one body, so from wave 40 — Variants → "Stacking") fires its own
introduction: **"MODIFIERS ARE COMPOUNDING"**, carrying the actual stacked specimen
as its icon. Without it the wave-40 gear change is invisible — the player meets a
shape that is quietly ×4 harder and has no way to know a rule changed rather than
the dice going badly. It is the same tutorial contract as every other debut: teach
the piece the first time it appears.

*The drip, end to end:* introductions land at waves 1, 2, 4, 5, 6, 8, 11, 14, 17,
21, 23 — and then **40**, where stacking and boss epithets arrive together. The
stretch from 24 to 39 is deliberately empty of *new pieces*: the content there is
combination, not vocabulary. GDD §9 asks for a new shape or modifier every 2–3 waves
"stretching past wave 20"; past 23 the game escalates by mixing what you already
know, which is GDD §5's content doctrine, not a gap in it. Filling 24–39 with
invented species would be content ahead of the Route's order. Forever-firsts still record to `meta.seen`
(the bestiary). Bosses introduce themselves by name banner instead — no generic card.

## Variants (`config.js: VARIANTS`) — the color/highlight grammar

A variant is a *modifier* on a base enemy: stat multipliers + one visual highlight.
*(2026-07-24: swift's ×0.8 hp and armored's ×0.8 speed drawbacks removed — variants
are threats, not trades; the highlight should mean "worse", full stop. XP bonuses
unchanged. Same day: regen's highlight moved from a ring to a **pulsating green plus
drawn inside the shape** — the ring vocabulary was crowded (frost circle, shield
arcs, intro rings) and a medic cross reads instantly; stroked, not filled, so the
fill-encodes-allegiance law holds: the volatile core stays the only filled thing on
any enemy.)*
Shape encodes species; highlight encodes the variation (pillar 3).

| id | visual highlight | effect | from wave |
|----|------------------|--------|-----------|
| swift | white-hot glow outline | speed ×1.7 | 7 |
| armored | thick steel outline | hp ×2.5 | 11 |
| regen | pulsating green plus inside the shape | heals 3% max hp / s | 17 |
| shielded | rotating ring segments | absorbs first 3 damage instances (ring depletes visibly) | 21 |
| volatile | pulsing orange core | on death: burst r=70 — **heals nearby shapes 30% of their max hp** and damages the Point if in range (reworked 2026-07-23: friendly fire made popping them a free win; a medic-bomb makes target priority a real decision) | 23 |

Roll (`waves.js: rollVariants` → an array, possibly empty): from wave 6, each
non-boss spawn has `min(0.35, 0.015*(w−5))` chance of a first variant chosen
uniformly **from those whose `from wave` has arrived** — the pool widens as the run
deepens, so each variant gets its own debut.

**Stacking — the wave-40 regime change (GDD §5).** A spawn that already carries a
variant rolls for *another*, at `stackChance(w)`, repeatedly, to a hard cap of
**three**. Zero before wave 40, which is deliberately the same threshold as boss
recirculation: wave 40 is where the whole game changes gear, and one threshold is
more legible than two. The cap is three because GDD §5 pictures exactly that —
*"three modifiers read as three channels lit on one silhouette"* — and because it
bounds the legibility problem to something verifiable rather than open-ended.

- **Stats compose multiplicatively** (hp, speed): an armored swift is ×2.5 hp
  *and* ×1.7 speed. *(Variants also carried an xp multiplier until ADR-0015 removed
  in-run XP; "scarier shapes pay better" is a lever we no longer have.)* Compounding is the point — GDD §5's content
  doctrine is that the game gets crueler by mixing known ingredients, not by adding
  new ones. Flags (shield charges, regen %, the volatile burst) take the strongest
  present rather than summing, since only one variant of each kind can be in a stack.
- **Bosses do not stack.** A recirculated noble carries exactly one variant, worn as
  an epithet — *"SIR CUMFERENCE, THE ARMORED"*. A name is one word; a boss wearing
  three modifiers is a stat block, not a character. (ADR-0009's `boss` overrides still
  apply to that one.)
- **Rendering allocates annulus slots** so stacked outer-ring channels cannot overlap
  — see app.md "Stacked highlights". Verified with the `?specimen` hatch. Debut waves avoid
boss waves (multiples of 5) so introduction banners and boss-name banners don't
land together — hence shielded at 21, not 20. (Ordering intent: mechanically
simplest first; volatile last because its lesson costs the most to learn.)

**Boss signature moves (`config.js: BOSS_MOVES`).** A boss is a *focus-forcer*
(GDD §5 Law·Bosses), and a threat that only rams differs from the last one by an HP
number. Each **name** carries a move — the move belongs to the character, so a
recirculated noble brings its signature back with it. Decisions live in the table;
`enemies.js` only executes (pillar 5).

| boss | move | the dilemma it poses |
|------|------|----------------------|
| Sir Cumference | **adds** — shakes 2 darts out of its sides every ~6s | split your aim or let leakers through. This is GDD §3's canonical ninety seconds verbatim: *"Sir Cumference shakes himself and more enemies fly out from his sides"* — the one boss behaviour the target experience explicitly names |
| The Obtuse One | **surge** — +60% speed below 35% hp | finish it or buy time; a wounded boss is a *faster* boss, so chip damage without commitment is the worst option |
| Marquis de Sides | **sunder** — at 55% hp, once, sheds 4 shards and is **guarded (×0.25 damage) while any shard lives** | *stop hitting the boss.* Your DPS is now being wasted; the fight demands a target switch and a return |
| The Final Vertex | **bulwark** — every ~9s, plants itself for 3s: **guarded (×0.25 damage) and completely stationary** | *stop hitting the boss, for a while.* It is not threatening you during the window either — the seconds are a gift you waste by dumping damage into armour instead of clearing trash or placing setups |
| Lord Rhombus | **charge** — winds up in place for ~3.3s, then crosses at ×4 speed until it reaches the rim. **The wind-up is interruptible: damage pushes the timer back, and emptying it staggers the boss** | *distance is not safety* — but it is now a question you get to answer. The wind-up is a window with a meter in it: burn it down and the charge never happens and the boss is briefly stunned; ignore it and the margin you were banking is spent in a second |
| Grandmaster Hexley | **study** — every consecutive second of ***hand*** damage hardens it one step (×0.85 each, floor ×0.4); two seconds untouched by a hand and it forgets. **Auto weapons do not feed the clock** | *sustained focus is punished.* The exact inverse of surge: here chip-and-rotate beats commitment, so the two nobles ask opposite questions and a player who learned one must unlearn it |
| Polygothra | **devour** — every ~5s, eats the nearest trash shape within 150px, healing 4% max HP | *the escort is the boss's food.* Inverts the standing target priority: ignore the chaff here and the fight lengthens under you |

**The two 2026-07-25 moves are deliberately opposite in *when* they free your attention,
and they exist because of a playtest.** Daniel fought waves 30 and 35 — `bossIdx` 5 and 6,
**Marquis de Sides and The Final Vertex, the two names furthest down the unbuilt list** —
and reported: *"felt a bit underwhelming to have a single boss attack racing against their
hp bar."* He was right, and the reason was structural rather than tuning: both bosses he
met were the ram-only ones. `sunder` displaces attention in **space** (there is another
target you must deal with); `bulwark` displaces it in **time** (there is a window in which
this target is the wrong one). Neither adds damage to the player — Law·Bosses asks for a
focus-forcer, and *"deal more"* is the move a boss makes when nobody could think of one.

**The charge is interruptible, and that is counterplay rather than a difficulty number
(2026-07-26).** Daniel, fresh account: *"Level 10 was brutal… I think we need some counterplay
on the boss-charge-rush-thing."* His design, built as specified: the wind-up carries a timer
that ticks toward the charge and is **pushed back by damage**; empty it and the boss is
**staggered** instead of charging.

- **The window is long enough to turn around in.** Tripled 2026-07-26 — tell 1.1s → **3.3s**,
  and `interruptFrac` 0.035 → **0.105** with it. Daniel: *"the charge-up is too quick, there's
  very little time to react if you're not already on the boss."* Tripling **both** is the
  point: it holds the damage-per-second the interrupt demands roughly constant while tripling
  the time you have to notice, decide and turn. A window you can only answer by already
  looking at it is not counterplay, it is a check on where your cursor happened to be.
- **The interrupt threshold is a fraction of the boss's own max HP** (`interruptFrac`), never
  an absolute damage number. An absolute threshold beside a scaling curve is this codebase's
  most repeated defect — `bossHp` linear vs quartic, boss variants vs a wave-share pool, the
  hp-bar gate at `maxHp > 40`. Expressed as a share, one constant works at every wave.
- **All damage counts, including autos — and the bias toward hands is emergent, not
  legislated.** The tempting rule is "only player-driven weapons interrupt", mirroring
  `study`. It is the wrong call here for a reason that is worth writing down: this mechanic
  exists to make wave 10 *survivable on a fresh account*, and a hands-only rule makes it
  harder, not easier. It gets its focus dilemma for free instead — autos spread their damage
  across whatever is on the field, so **concentrating enough damage inside a ~1.1s window is
  something aiming does naturally and delegation does not.** The pressure comes from the
  window, not from a rule about weapon classes.
- **A meter you cannot see is not counterplay.** The wind-up draws a **dial that fills inside
  the shape** — a clock running down toward the charge, pushed back when damage lands, so
  "shooting it is doing something" is visible while it is happening. Without that the move is
  indistinguishable from the old uninterruptible one, and the player learns nothing.
- The stagger is deliberately **short and damage-free**: it buys tempo, not a damage window.
  A boss that becomes a free hit is a boss you *farm*, which is a different game.

**Every noble now carries a move (2026-07-25, second playtest), and the pin that prompted
it was wrong about why.** Daniel, fresh account, wave 10: *"Lord Rhombus went down easy
too, didn't see any trace of any signature move."* The pin filed from that report blamed
the **gate** — it claimed `game.js` fired moves only on roster recirculation, so the first
move in the game landed at wave 40. **False, and checkable in one line:** the gate has read
`S.wave >= 10` since the moves landed, and `bossmoves.test` has pinned the wave-5 ram since
the same commit. The real cause was duller and worse: **three of seven names had no move at
all, and they sat at indices 1, 3 and 4 — waves 10, 20 and 25.** The first move a player
could actually meet was The Obtuse One's surge at wave 15, and it is a speed change below
35% HP, which is the subtlest of the four. So the observation was exactly right and the
mechanism behind it was invented. *Third instance this week of a plausible mechanism
outranking a measurement in a spec file; the standing lesson in the rim pin applies to
one's own diagnoses too.*

**The three new moves are chosen to not repeat a dilemma.** With seven nobles the risk is
seven flavours of "an attack happens": `charge` displaces attention in **distance**,
`study` in **rhythm**, `devour` in **target priority** — against the existing three axes of
space (`adds`, `sunder`), time (`bulwark`) and commitment (`surge`). None of the three deals
direct damage to the Point, which keeps Law·Bosses' "focus-forcer, not damage-dealer" line
intact across the whole roster. `study` is deliberately the mirror of `surge`, because two
nobles asking opposite questions is what makes the roster a roster rather than a difficulty
curve with names on it.

**`study` reads *attention*, not damage.** Only weapons the player drives (`input !== 'none'`
— aim, hold and swipe alike) feed the clock. Without that rule autos never stop firing, so
the clock never resets, so the boss sits permanently at its floor and *"two seconds untouched
and it forgets"* could never fire in any run fielding a single auto: the dilemma in the table
above would be fiction and the move a flat tax — *"deal less"*, the same failure of
imagination as *"deal more"* wearing a defensive coat. The rule makes the promised response
actually available: take your hand off it, let it forget, come back.

**The floor (×0.55) was set by measurement, and the measurement went through two wrong
answers first — both recorded, because the wrong ones are the useful part.** A guard floor
is an HP multiplier wearing a verb, and the wave director will not advance while the boss
lives, which is exactly the freeze-the-run failure ADR-0009 exists for.

- **Wrong answer 1, a mechanism.** At floor 0.4, isolating each new move against the
  conductor showed `study` alone moving the delegation ratio ×1.41 → ×2.31 while `charge`
  and `devour` moved it ~0.04 between them. The obvious story — *autos pin the clock, so
  study taxes delegated builds* — is **false**, and the check cost one run: excluding autos
  from the clock changed the ratio by ~0.01. The real cause was blunter, and visible only in
  the distribution rather than the median. Parked death waves, 11 pairs, floor 0.4: `20 20
  20 20 20 20 20 35 35 35 35`. Seven of eleven hands-off runs died *at Hexley's wave*. He
  was not taxing the delegated build, he was **stopping** it.
- **Wrong answer 2, a threshold.** The first killability test asserted "dead within 45
  seconds" — an absolute bar beside a scaling curve, which is this codebase's most repeated
  defect (`bossHp` linear vs quartic; boss variants vs a wave-share pool; the hp-bar gate at
  `maxHp > 40`). Time-to-kill is dominated by how much tech the rig carries, so seconds mean
  nothing. Re-cut as a **ratio against a moveless control**: every other move measures
  ×1.00–1.24, `study` at floor 0.4 measures **×2.47**. The test caps every move at **×2.2** —
  past double, a punishment for playing badly stops reading as a dilemma and starts reading
  as a boss that does not work. *(And the ratio test was itself theatre at first: started at
  8% HP it passed at every floor including the broken one, because a fight that ends during
  the ~4s ramp-in cannot measure the ramp. The 15% start is measured, not guessed.)*

**What shipping floor 0.55 actually costs, stated because it is not free.** Killability and
delegation pressure turn out to be the *same dial*: at 0.4 study walls the hands-off run
(7/11 deaths at wave 20, ratio ×2.31); at 0.55 it does not (1/11, ratio ×1.176). Worse, the
gate reads **lower** with study than without it (×1.176 vs ×1.412) — because the conductor's
robot never rotates targets, so it plays into `study` exactly as badly as a player can, while
the parked run's untended gun rarely lands on the boss at all. The move is therefore
**invisible-to-slightly-negative** on the one instrument this project has, and the thing it
is actually for — rewarding a human who learns to take their hand off — is precisely what
that instrument cannot see (README "known coverage gap": the robot is a weak veteran).
Killability won, because an unadvanceable wave is a bug and a soft dilemma is only a
disappointment. Net effect of this landing on the gate: ×1.176 → ×1.176, unchanged.

**`e.guard`** is the shared mechanism: a 0–1 multiplier applied in `damageEnemy` after
crit and before attribution, so a guarded hit is *recorded at the damage it actually
dealt* and the ledger keeps adding up (core.md Run state). Default 1. It is not a shield
(which eats whole hits and is a variant); it is a scalar, and it is the only thing either
move needed.

*(Added 2026-07-25. **Moves fire from wave 10 onward**, so only the very first noble
— the wave-5 onboarding wall, where ~45% of fresh runs end — is a clean ram. One
thing at a time: that fight teaches what a boss *is*, and every boss after it teaches
what a boss can *do*. **Since the roster completed, that sentence is true in play and
not only in code** — before it, "moves from wave 10" described a gate that the first
two nobles past it walked through empty-handed. **The gate is a design choice, not a balance necessity, and the
distinction is measured:** running moves from the first appearance leaves the
fresh-run median at 8, comfortably in band, twice — so nothing forced this. Recorded
because the honest reason is pacing, and a "for balance" justification would have
been a made-up one. Note the fit with GDD §3's canonical ninety seconds: it names
Sir Cumference shaking out adds in a run that already has regen and armored elites,
which puts it at his recirculation around wave 40 — the scene the table reproduces.)*

**Boss variants:** bosses roll no variants until the name roster recirculates
(boss #8, wave 40). From then on, every returning noble carries a **guaranteed**
variant from the debuted pool, announced as an epithet — *"SIR CUMFERENCE, THE
ARMORED"*. A name you've beaten coming back changed is the lategame's escalation.

**An epithet changes the fight, not the arithmetic** — bosses use the `boss`
override on each variant (`config.js: VARIANTS[id].boss`), never the trash
multipliers. *(Decided 2026-07-25 by measurement, resolving a pin that had asked
the question since the audit. Trash multipliers on a boss are not "harder", they
are broken: a boss's HP is a share of the whole wave (`bossHp`), and the trash
percentages scale with it. Measured against a maxed budget-legal build with the
field otherwise **empty** — the most generous case the player ever gets — a
wave-40 **regen** boss healing 3%/s of a 117k pool took **0% damage in 23
seconds**: mathematically unkillable, and the director will not advance the wave
until the field is empty, so the reward for reaching wave 40 was a guaranteed
20%-of-the-time dead end. **Armored** ×2.5 was the same failure in slower motion —
7% dead at the player's death against 18% for a plain boss.)*

| variant | trash | boss (`.boss`) | why it differs |
|---------|-------|----------------|----------------|
| swift | ×1.7 speed | ×1.35 speed | speed is already the scariest thing a boss can gain — the ram arrives sooner and the reaction window is the real resource |
| armored | ×2.5 hp | ×1.35 hp | multiplies a pool that is already 31% of the wave; the epithet must not become "wait longer" |
| regen | 3% max hp/s | **0.5%** max hp/s | the only variant that can make a boss *unkillable* rather than merely long — this is a DPS check, not a wall |
| shielded | 3 hits | 12 hits | a boss eats hits continuously; 3 charges are invisible on it |
| volatile | burst r70, heals 30% | unchanged | the burst heals *nearby shapes by their own* max hp, so it does not scale with the boss — and a noble dying into a crowd heal is exactly the tactical event the epithet should be |

## Weapons (`config.js: WEAPONS`)

*Balance round 2 (2026-07-23, playtest-driven): every weapon EXCEPT bolt and frost
buffed ~10% — bolt is the always-on carry and was already winning the damage race;
frost's power is control, not damage, and its 45% slow cap is a hard ceiling (see
variant row note). Frost got visual oomph instead (app.md render.js).*

**Taxonomy (ADR-0006, supersedes ADR-0004's gesture slots):** every weapon carries
two orthogonal fields. **`input`** (`aim` / `hold` / `swipe` / `none`) is how the
player drives it; the card chip is *derived* from it (`chipOf(w)`: AIM / HOLD /
SWIPE, `none` → AUTO), never stored. **`category`** (`gun` / `hold` / `swipe` /
`auto`) is what the weapon costs the build — the load-bearing field. The sorting
test is attention-scaling: a gun's output scales with your aim, an auto's does not —
which is why the boomerang (input `aim`, category `auto`) is infrastructure that
happens to read the aim.

**The slot budget (`config.js: SLOT_BUDGET`, enforced in `levelChoices`):** a run
fields **at most 6 weapons — of which at most 2 guns, 1 hold, 1 swipe**. Autos have
no cap of their own; they fill whatever the budget leaves. At 6/6 no new weapon is
ever offered (upgrades and generics continue); a category already holding its
ceiling locks its remaining rivals out of the draft. The gun slot **may sit
empty** — bolt is the default weapon, not a guaranteed one (ADR-0007); no rule
requires a loadout to contain a gun.

**Why guns get two and gestures get one (ADR-0011).** The ceiling of 1 came from
ADR-0004, whose reason was **gesture ambiguity**: a gesture must mean exactly one
thing mid-fight, so two hold weapons make a hold a question and two swipe weapons
make a swipe a question. That argument never applied to guns, which consume no
gesture at all — they auto-fire toward the **standing aim point**, which is shared,
singular, and updated by every tap and swipe. Two guns firing at one aim is not
ambiguous, it is two guns. The old ceiling was a rule about gestures applied to the
one category that has none. It also produced measurable dead content: since every
tower opens with bolt, the gun slot was occupied at t=0 in *every run ever played*,
and Scattergun and Howitzer were offered in **0 of 60** mature-account runs. The
second gun still costs an auto slot — `total` is unchanged at 6 — so the new
question ("is a second gun worth more than a fifth auto?") is a real trade, and one
the build could not previously ask.

Held weapons (input = the player's hands; categories: bolt = gun, wall/blades =
swipe, beam/flame/meteor = hold):

| id | input | max | levels |
|----|-------|-----|--------|
| bolt | aim | 6 | auto-fires toward the aim point every 0.38−0.02L s (needs a live enemy); dmg **9+4L through L4, then 58 at L5 and 99 at L6**. **One bolt per stream, always** — and until MAX there is only one stream. The *manual stream* fires at your aim; **at L6 an *auto stream*** fires at the nearest shape *inside the arena walls* (bullets die at the wall — an outside target eats bolts for nothing, 2026-07-23; no in-bounds shape → the auto stream holds fire, the manual stream always fires). Ladder: **L3 pierce 1, L4 ricochet 1, L5 ricochet 2, L6 MAX +auto stream** — a bolt that lands **kicks to another shape** within `RICOCHET_RANGE` (190), re-aiming rather than dying. **A bolt never damages the same shape twice** (it remembers who it hit), so both pierce and ricochet only ever buy *new* victims — and both are worth exactly nothing against a lone target. **Kicks are spent before pierce**, so the second contact is a steered one and the bolt punches straight through only at the end of its chain; a kick with nothing in range is **not** consumed, so the bolt falls through to pierce and keeps its kicks banked for later in the same flight. Max bolt therefore reaches up to 4 shapes (1 + 2 kicks + 1 pierce) at **full damage each** — there is no per-kick falloff. *(The stream moved from L3 to MAX on 2026-07-26, ADR-0014: it was the ladder's steepest rung — ×2.6 emission — sitting third, so the weapon spent its mastery curve before the player met a boss. The three grants above it each shifted down a rung so none was left hollow; per-bolt damage stayed pinned to the level, not to the grants. Max bolt is **byte-for-byte what it was** — two streams × 99 with ricochet 2 — so this re-slopes the road, it does not touch the destination; L3–L5 lose half their emission and get pierce/ricochet a level early in exchange.)* *(Re-cut 2026-07-25, ADR-0006 Decision 8: the fan volleys L5/L6 used to grant moved **out** of the ladder and became the **Fan** form, because a form must not sell at mastery what levelling already gives away — the same objection that killed *Overpenetrator*, turned on our own draft. The ladder gained ricochet in their place, and L5/L6 per-bolt damage is the **old ladder's emission collapsed into one bolt** — 58 = 2×29, 99 = 3×33, exactly the volleys×damage the fan used to throw. L1–L4 are untouched at 9+4L because those levels never granted a fan, so raising them would buy nothing back; the rejected first attempt did raise the whole ladder to 9+6L and took calibrate 8→14, out of band. *(core.md carried that rejected 9+6L formula as if it had shipped, from 2026-07-25 until the same day's playtest sent someone back to this row — a spec describing the abandoned branch of its own decision.)* **The collapse is power-neutral against the old bolt in emission but not in concentration**: all of it now lands on one shape instead of spreading across a fan, which is where max bolt's single-target dominance comes from and what the Fan form gives back. They **compose**: max bolt wearing Fan throws a spread of bolts that each ricochet, which is a better max-bolt picture than either alone. Prior history: at 2026-07-24 the max was 1 aimed + 4 auto-aimed bolts and was "way overpowered" in playtest, so it returned to center-true fans, one per stream; that shape is now the Fan form rather than the ladder's gift.)* |
| blades | swipe | 5 | **Force Blades** (swipe slot, ADR-0004): the swipe hurls 2/3/3/4/5 crescent blades, spawned evenly along the swipe segment (trimmed to 200px toward the start, wall rule), all traveling along the segment's tower-away normal at 400 px/s; dmg 15+7L, pierce everything (once per shape per blade), die at the arena wall with the standard flare; cd 0.45s. The wall's defensive cousin inverted: the same gesture, pushed *outward* as pure offense |
| wall | swipe | 5 | **Force Wall** (reworked twice, 2026-07-23): the swipe conjures a stationary wall **anchored at the gesture's start** (length 150+40L; longer swipes trimmed toward the start — overshooting the tail must not move the wall). The wall is *siegeable*: it has **80+40L HP** that degens passively over ~5s, and shapes in contact **attack it** (their dmg every 0.9s) while being pushed along its tower-away normal at (100+25L)÷mass px/s and taking 5+2L dmg per 0.4s tick. Wall dies at 0 HP, whichever clock runs out first. Active walls: **1 until max level, 2 at L5**; swiping past the cap replaces the oldest; cd 0.4s |
| flame | hold | 5 | **Flamethrower** (hold slot, ADR-0004): channels a cone toward the hold aim (range 230+18L, half-angle 0.3 rad); every 0.3s each shape in the cone takes 4+1.5L direct AND gains a **burn stack** (max 5): each stack ticks 3+1.5L dps for 2.5s, refreshed per application — the DoT keeps cooking after the shape leaves the cone (that's the weapon's identity: paint the crowd, let it burn). Burn damage is player-sourced but renders flame flicker, not damage-number spam. While channeling, drops **burning ground patches** in the cone (~every 0.35s, r 26, ~2.2s life, 6+3L dps, field-capped ~40) — area denial persists briefly where the cone swept. Heat like beam (slower at L3); **L5: no overheat, always-on toward the standing aim**. Bosses burn like everything else — no stack resistance (frost precedent: the counter-boss tools keep their teeth) |
| meteor | hold | 5 | **Meteor** (hold slot, ADR-0004): holding **charges** a meteor (0→full in 1.5s, shown growing at the aim); release drops it on the aim point — 0.45s fall behind a warm ground telegraph (mortar's grammar), then impact: dmg (24+12L)·(0.45+0.55·charge), blast (60+8L)·(0.55+0.45·charge), radial knockback scaling with charge, and a **scorch patch** (burning-ground register, ~2s). **Auto-releases at full charge** — keep holding and it keeps raining, one meteor per 0.9−0.05L s. A tap-short hold still throws a pebble: min charge is a real (weak) strike, never a dead input |
| beam | hold | 5 | ticks **per-target every 0.25s** at dps 34+20L (damage = dps×0.25 per tick) — so a shield loses one charge per *tick*, never per frame (playtest 2026-07-23: frame-rate ticking erased shields on touch); **per-target damage ramp** ×1→×2.5 over 2s of continuous exposure, decaying back over ~1.5s once out of the beam — sustained tracking is rewarded, field-flicking isn't; heat 0→1 in ~3.5s, forced cooldown at 1, **re-arms at 0.35** (the heat gauge marks this threshold — the lockout must be legible, see app.md "Beam heat gauge"); L3: slower heat; **L5: no overheat and always-on — channels toward the standing aim point with no hold needed** (a no-overheat beam that still demanded holding would just be a finger tax) |

Aim-input ordnance (auto-fires toward the standing aim like bolt, holds fire with
no live in-bounds shape; all **tech-locked**, ADR-0004). Categories per ADR-0006
Decision 7: **scatter and heavy are guns** (their output scales with aim); **boomer
is an auto** (it sweeps its own geometry whatever you point at); **burst is the
demoted form-of-bolt** — category `auto` *interim* and `formOf: 'bolt'`, offered
only once bolt is at max level (the "card you draw at max level", ADR-0006 Alt-4:
the pilot for the phase-4 form system, at which point it stops costing a slot and
becomes bolt's alternate rhythm; until then an aim-reading auto is the honest
approximation that doesn't collide with the ≤1-gun ceiling — recorded in PINS):

| id | category | max | behavior |
|----|----------|-----|----------|
| scatter | gun | 5 | **Scattergun** — a slow, heavily overlapping volley: 6+L pellets every 1.7−0.1L s toward the aim, each pellet on its own semi-random bearing within ±0.26 rad with ±70 speed jitter — a shot *pattern*, not a center-true fan (deliberate contrast with bolt: bolt rewards precision, scatter rewards pointing at the problem); dmg 6+2L per pellet |
| burst | auto (form pilot) | 5 | **Repeater** — salvos: 3/3/4/5/6 bolts 0.085s apart, each shot tracking the *live* aim through the salvo (dragging the aim smears the burst — a feature), then a pause; dmg 8+3L; salvo every 1.6−0.12L s. Offered only when bolt is maxed (`formOf`) |
| heavy | gun | 5 | **Howitzer** — the sidearm-and-heavy rhythm: three quick light rounds (dmg 6+2L, 0.11s apart), a 0.45s beat, then one heavy shell — dmg 24+11L, pierce 2, visibly fat and slower (380 vs 520 px/s). Cycle restarts 1.2−0.08L s after the shell |
| boomer | auto | 5 | **Boomerang** — a wide spinning blade thrown at the aim every 2.6−0.2L s, dmg 13+6L; decelerates (~480 px/s²), reverses, and returns to the Point, hitting each shape **once per leg** (out + back = two bites; the hit record resets at the turn); **bounces off the arena wall** instead of dying — the one projectile the force field returns to sender, keeping the return leg alive at every aim length; caught (removed) when it re-reaches the Point; L5: a second blade at +0.5 rad per throw |

Auto weapons (level-up pool):

| id | max | behavior |
|----|-----|----------|
| orbit | 5 | **the ring expands as it levels** — 96/104/112 for L1-3, then **168** at L4 and **218** at L5 *(re-shaped 2026-07-25, and the direction is the opposite of what the old rim pin proposed)*. Measured with the new damage ledger: at the old 88+8L the orbitals contributed **0% of a maxed build's damage at 15 minutes and 1% at 40** — a starting-pool auto that did nothing. The cause is not power and not coverage: against a stationary crowd standing in its band it does **616 dmg/s**, comparable to nova's 672. It is **exposure**. Shapes die where the shooting is — measured, at wave 35+ deaths cluster at 120-240px and *nothing* dies inside 120px — so a ring at 128px sat behind the killing, catching shapes only during a brief transit. Moving it out to where shapes actually are took orbit to **19%** and dropped bolt's share from 69% to 55%. L1-3 are left untouched on purpose: any early widening pushed the onboarding median to the band's top edge, so the fix is aimed at depth, where the problem is. Levelling now *expands the patrol* rather than nudging a circle — blades orbiting the Point — **contact damage**: a blade grinds any shape it touches (they never shoot; the card text must say so — 2026-07-23 second playtester read "blade orbits" and waited for it to fire); count **2/3/3/4/5** *(started at 1 until 2026-07-24 — a single blade circling a 2D arena touches too little to feel like a weapon at all)*, dmg 10+6L, orbit radius **88+8L** *(was 64+8L; pushed out 2026-07-24 as a deliberate slight nerf — every inbound path still crosses the ring, but blade arc-coverage of the longer circumference drops, so more shapes slip the band per crossing)*, per-enemy hit cooldown 0.35s |
| nova | 5 | expanding ring every 5.0−0.6L s (floor 1.7), dmg 16+8L, radius **195+15L** *(120+26L → 160+18L → this, both 2026-07-24 — "even more": L1 pulse 146→178→210, max 250→270. Balance note: this buff alone moved the fresh-run bot median from 10 to 17; enemy HP round 4 exists to pay for it)* |
| frost | 5 | slow aura, radius 100+26L, slow 22/28/33/38/45% *(was …62%; capped after the 2026-07-23 playtest — max slow + orbital knockback held enemies in place indefinitely)* |
| tesla | 5 | chain lightning every 2.3−0.22L s: 2/3/3/4/6 chains, dmg 12+7L, falloff 0.8/jump — **tech-locked** |
| seek | 5 | homing missiles: 1/1/2/2/3 per volley every 2.6−0.3L s, dmg 20+10L, small AoE — **tech-locked**. **Trajectory re-acquisition:** when a missile's target dies *or falls behind its heading*, it locks onto the best-aligned shape ahead of it instead (falling back to nearest if nothing's ahead) — a whiff curves into new prey rather than orbiting a lost cause (2026-07-23 playtest: limited turn rate made misses ineffective) |
| turret | 5 | orbiting mini-turrets 1/1/2/2/3 shooting nearest, dmg 8+4L, cd 1.0−0.09L — **tech-locked** |
| mine | 5 | proximity mines seeded at random field positions (ring 120..min(W,H)/2−40 from the Point) every 2.6−0.25L s (floor 1.2); armed after 0.5s; trigger radius 44, blast 62+6L, dmg 24+12L; live cap 2/3/4/5/6, seeding pauses at cap — **tech-locked** (ADR-0003: the area-denial tool; new 2026-07-24) |
| catapult | 5 | **Catapult** (ADR-0004 wave C): every 4.5−0.35L s hurls a rolling boulder (r 14+L, 130 px/s) at a random living shape's bearing; the boulder **doesn't stop** — it tramples: 20+9L dmg per shape per 0.5s of contact plus a heavy shove (part forward along its roll, part aside from its bulk; mass-resisted via `applyKnock` like all CC), rolls until the arena wall and crumbles there. L5: twin boulders per volley — **tech-locked** |
| caltrop | 5 | **Caltrops** (ADR-0004 wave C): every 3.0−0.2L s scatters a cluster of 5 spikes (patch r 55) at a random field position (mine ring rule); a shape stepping on one takes 6+3L dmg and is **slowed 45% for 1.2s** (stored per-shape at prick time; mass-resisted, stacks *multiplicatively* with frost — a fresh shape in both is at ~30% speed, deliberately strong and brief); each caltrop is spent on one prick. Live cap 12+3L, seeding pauses at cap (mine rule); spikes rust away after 14s — **tech-locked** |
| cascade | 5 | **Cascade** (ADR-0004 wave C, "the chain reaction"): every 5.5−0.4L s hurls a white-hot spark at a random living shape; contact **primes** it (0.6s fuse). A primed shape detonates on fuse-out *or death, whichever first*: 22+10L dmg in r 70, and every living shape caught gains a prime at **×0.75 power** — the chain spreads until damage decays below 8 (or generation 8, the runaway stop). One good cluster is a firework show; the weapon's whole skill is *when*, not *where*. L5: two sparks per volley — **tech-locked** |
| mortar | 5 | arcing shells lobbed at a random living shape (±30px scatter) every 3.4−0.3L s (floor 1.6); 1.1s flight, then AoE: blast 68+8L, dmg 30+14L; **L5: twin shells** per volley — **tech-locked**. **Shells arc OVER the arena wall**: the mortar is deliberately the one weapon that can strike shapes still outside the walls — bullets die at the wall because they travel *through* the field; a shell was never in it (ADR-0003: the anti-cluster tool, new 2026-07-24) |

## Forms (`config.js: FORMS`) — ADR-0006 Decisions 6-8, the pilot

A **form** changes how a weapon *feels*, never what it *produces*.

> **A form redistributes a weapon's output; it never increases it.**

Burst redistributes in **time** (the same volleys, re-timed into a salvo and a beat).
Fan redistributes in **space** (one bolt becomes a spread of weaker ones). Both are
neutral in *emission* — shots × damage per second — which is the thing the test
measures. Note that a spatial form is deliberately **not** neutral in damage *landed*:
Fan trades single-target for coverage, and that trade is the whole point of it.
Measuring landed damage against one anvil would have punished exactly the design the
rule exists to allow. *(The rule first landed 2026-07-25 as "regroups in time", which
was too narrow — it described the pilot rather than the concept, and Fan broke it the
next day. Generalised the same day, before the second form shipped.)*

That is the enforceable version of ADR-0006 Decision 6 ("a form that is only
bigger-slower-more is a stat wearing a name"), and it is pinned by test: a form's
**emitted** damage per second — bullets spawned × their damage — must match its
base weapon's within a few percent. *Emission, not damage landed:* measuring what
lands on a single target punishes a spatial form for the exact trade it exists to
make, and (measured) reads a stable ~6% drift on a purely temporal one too. Power-neutrality
holds **by construction**, not by tuning — a form re-times the same shots, so the
arithmetic cannot drift even when the base weapon is rebalanced later.

| form | of | what changes | unlocked by |
|------|----|--------------|-------------|
| **Burst** | bolt | the same volleys arrive as a fast salvo of `salvo` shots then a beat, instead of an even stream - *ratatatata-pause-ratatatata* against the default's *bang-pause-bang* (GDD section 4). Gap = `gapFrac` x the base cadence, and the pause makes the cycle exactly `salvo` x base cadence, so shots-per-second is unchanged | the `burst` lattice node (interim) |
| **Fan** | bolt | each shot becomes a **center-true spread** of `spread` bolts at ±0.11 rad, each carrying `1/spread` of the damage. Coverage instead of concentration; the centre bolt still sits exactly on the aim line, so aim fidelity - bolt's identity - survives the trade | the `fan` lattice node (interim) |

**The active form is visible wherever the loadout is** — `state.js: loadout(S)` is
the single query behind the level-up header, the pause stats panel and the in-fight
weapons bar, and it reports each owned weapon with its level and its worn form. GDD
section 4 calls forms *"rhythm is loot"*; loot the player cannot see is not loot, and
Law-Legibility applies to the HUD as much as to the field. The weapons-bar cache key
includes the worn form, so taking a form mid-fight refreshes the bar — it did not,
before this existed. *(Added 2026-07-25, immediately after forms shipped: the first
two forms went in with no surface anywhere telling the player their bolt had
changed.)*

**Forms cost no slot.** They are not weapons: `S.forms[weaponId]` names the active
form, `S.formPool` is what the account has unlocked, and a form card is offered only
when its base weapon is **at max level**, its form is unlocked, and it is not already
active. That is GDD section 7's canonical wave-30 draft: *"since our gun is maxed at
level 6, we were lucky enough to draw a variant card that lets us change it from the
default form into the burst."*

*(Landed 2026-07-25. Burst previously existed as a **weapon** carrying `formOf` - an
interim recorded at the time as a known lie. Measurement convicted it: on a mature
account burst was offered in **0% of 60 runs**, because a slot-costing weapon cannot
win a budget that is full by level ~8. A form costs nothing, so the content is
reachable again. The **mastery** half of ADR-0003 stage 2 - use-earned XP, per-weapon
trees - remains unbuilt; forms unlock from the lattice for now, which is the honest
interim and is pinned.)*


**Generic cards are a pool the lattice authors** (`config.js: GENERICS`), not a fixed
list — GDD §6's organizing principle: *"lattice unlocks inject card types into the
in-run pool."* A card marked `techLock: true` is absent until some node's
`effect.unlockGeneric` names it, exactly as `techLock` weapons wait on
`unlockWeapon`. `newRun` freezes the unlocked set into `S.generics`; `levelChoices`
draws from that.

| card | effect | unlocked by |
|------|--------|-------------|
| Repair | restore 40% max hp — only offered below 70% | always |
| Bulkhead | +25 max hp, healed on the spot | always |
| Overclock | +10% damage (additive on the run multiplier) | always |
| Coolant | −5% cooldowns | always |
| **Critical Systems** | **+10% crit chance, stacking within the run** | **`prec` (Precision)** |

*(Added 2026-07-25. The pool was a hard-coded four-entry object that every draft
received unconditionally — nothing in the lattice could add, remove or modify a
generic card, so the meta layer's headline principle had no mechanism behind it and
GDD §7's canonical wave-30 draft was literally unimplementable: it offers a crit card
that "joined the pool when we unlocked crits," while crit was a permanent passive
folded into `S.critChance` at run start. **`prec` now buys the card rather than the
stat** — its old flat +10% is gone, so a fully-invested crit account runs 20% base
instead of 30% and draws crit cards on top. That is the intended direction: meta
progression should pay in richer decks, not bigger constants. `prec2`/`deadeye`
remain flat baseline for now; converting the whole chain to card-authoring is a
follow-up, pinned. This is also the seam ADR-0003 stage 2's **form cards** land in.)*

Level-up choice generation (`state.js: levelChoices(state, rng)`): 3 distinct options
drawn from {each owned weapon below max, each unowned *pool-unlocked* weapon, generic
cards}. **Budget filter (ADR-0006, replacing ADR-0004's gesture-slot filter):** an
unowned weapon is never offered when (a) the run already fields `SLOT_BUDGET.total`
weapons, or (b) its category's ceiling is held by a *different* owned weapon —
owning the beam means never being offered the flamethrower or meteor that run, and
owning any gun locks out the other guns the same way; or (c) it carries `formOf`
and its base weapon is not yet at max level. No tower's starting loadout may
violate the budget (test-pinned — the pinned invariant is deliberately the budget
and its ceilings, *never* "has a gun": ADR-0007). **Card chips are a control-scheme vocabulary, nothing else:** AIM / SWIPE /
HOLD / AUTO on weapons (derived from `input` by `chipOf`, never stored — ADR-0006),
PASSIVE on generic cards. A new weapon keeps its control chip
— newness is marked in the level line ("NEW — Level 1"), never in the chip slot
(2026-07-23 second playtester: NEW-as-chip hid *how the weapon fires* on exactly the
pick where that matters most, and BOOST didn't say "this is not a weapon" — PASSIVE
does). Upgrades show current→next level.

## Towers (`config.js: TOWERS`)

Bolt is the **default** weapon a loadout reaches for, not a guaranteed one — a
tower may open with a different gun, or with no gun at all (ADR-0007; the current
four all happen to start bolt). Identity = stat profile + starting loadout, which
must respect the slot budget (test-pinned).

| id | name | unlock | hp | dmg | starts with |
|----|------|--------|----|----|-------------|
| bastion | Bastion | free | 100 | ×1.0 | bolt L2 |
| tempest | Tempest | tech | 80 | ×1.0 | bolt L1 + tesla L1 (tesla need not be pool-unlocked — the tower *is* the unlock; it may be upgraded in-run regardless) |
| warden | Warden | tech | 130 | ×0.9 | bolt L1 + nova L1 |
| lance | Lance | tech | 85 | ×1.1 | bolt L1 + beam L1 |

## The Lattice (`config.js: LATTICE`, logic in `tech.js`) — ADR-0003 stage 1

The meta tech system is a **web**: 60+ nodes in seven sectors (**Hull, Arms,
Mind, Salvage, Arsenal, Armory, Towers** — Armory added by ADR-0004 for the
manual/aim weapon unlocks, so Arsenal keeps its auto-ordnance identity and its
lane stays readable) across five rings, ring = cost band (~15 / 40 / 100 / 250
/ 600).

**How long the arc actually is — measured, not promised.** 64 nodes, **11,620◆**.
Against the real payout curve that is roughly **47 runs** for a player habitually
dying around wave 20, ~71 at wave 15, ~25 at wave 30 — *several hours, not weeks.*
*(This spec previously claimed "deep lattice is weeks of play", which GDD §6 flagged
as a live contradiction. The claim is now the measurement. Whether the arc **should**
be longer is a live design question for playtest and is pinned with the full table —
it is deliberately not answered by quietly inflating costs, because the economy curve
is Daniel's call and "provisional until he plays it" is written into ADR-0003.)*

**Law·No-meta-accel is enforced structurally, not by good intentions.** No node may
carry a `salvageAdd` effect — nothing purchasable may speed up meta-progression.
*(2026-07-25: the entire Salvage income line — `salv1`–`salv4`, `goldrush`,
`quartermaster`, 1255◆ for **×2.35 shard income** — was retired for breaking it.
Two laws convicted it: the ratified rule, and the focus law, since an income node is
an optimiser's no-brainer first buy and therefore never a real choice. Retiring it
also removed the distortion behind the cost-curve claim: with salvage bought first
the whole lattice cost ~25 runs; without the line it is ~47. The `xpAdd` nodes were held legal under the same law — in-run
levelling speed is game power, not meta speed — until **ADR-0015 removed in-run XP
entirely on 2026-07-26**, retiring `study1..4`, `enlighten` and `scholarsoldier`
(1105◆, refunded) and striking the law's carve-out with them.)*

**Retired nodes refund on load** (`config.js: RETIRED_NODES`, `tech.js:
refundRetired`): a save holding a retired id gets its shards back and the id
dropped, once, at load. Respecs are free, so a retirement must never cost the
player the investment — and the alternative (silently ignoring unknown ids) would
strand shards with no way to notice. Rendered as an actual graph (app.md
"Lattice view", layout per ADR-0005), not columns. **The sector order is core
data** (`config.js: SECTORS`, the order above): since ADR-0005 stacks sectors
as bands, adjacency in that order is *semantic* — **a cross-sector requisite
may only reference an adjacent sector** (within-sector chains are free). Why:
a cross-link should read as a short hop across one shared border — edge lanes
of a sector reaching into the neighbouring sector's near lane — not a cable
hauled across the whole board; the rule is enforced by test, so new content
can't quietly violate it. This is the deliberate
**mega-lattice**: large and deep first, mostly stat nodes for now; parts migrate to
diverged weapon-mastery and tower trees in ADR-0003 stages 2–3, and the interesting
behavior-changers land there. What stage 1 must nail is layout, presentation, and a
cost curve worth feeling out.

Nodes: `{id, sector, ring, name, desc, cost, req: [nodeIds], reqMode?, effect}`.
`canBuy` requires: not owned, prereqs satisfied, shards ≥ cost. **`reqMode: 'any'`
makes a node a web cross-link** — satisfied by ANY listed prereq (default: all);
cross-links sit at sector borders and let hybrid builds route sideways instead of
grinding a second trunk. Effects aggregate in `effectsOf(owned)`: additive within a
stat (`hpBonus`, `dmgMult`, `regen`, `dmgTakenMult`, `cdMult`,
`critChance`, `salvageMult`, `startLevel`), plus set-valued `unlockWeapons` /
`unlockTowers` — stage 1 adds **no new effect keys**; depth comes from chains and
costs, which is exactly what keeps the sim untouched by the lattice.

Node ids from the pre-lattice tree are preserved verbatim (`vit1`, `tesla`,
`tower_lance`…) so existing saves keep their purchases; the v1 storage key and the
shallow default-merge in `meta.js` cover stage 1 migration (a real deep-merge +
schema version lands with stage 2's nested fields — recorded in ADR-0003).

| branch | nodes (cost◆, req) |
|--------|--------------------|
| Hull | Vitality I/II/III (+20 hp; 15/30/60, chained) · Plating I/II (−8% dmg taken; 40/80, req Vitality I then chained) · Nanites I/II (+0.5 hp/s; 35/70, req Vitality I then chained) |
| Arms | Overcharge I/II/III (+8% dmg; 15/30/60, chained) · Precision (10% crit ×2; 50, req Overcharge II) · Haste I/II (−6% cooldowns; 40/80, req Overcharge I then chained) |
| Mind | Head Start (one level higher, with a free pick; 45) · Running Start (again; 250) · War Chest (+8% damage; 100) — *thinned twice: the Salvage income line retired 2026-07-25, the Quick Study xp line retired 2026-07-26 (ADR-0015). Mind now has no ring-1 node and is a candidate for a re-theme.* |
| Arsenal | Unlock Tesla (25) → Unlock Seekers (45) → Unlock Turrets (70) — chained; Mines → Caltrops (r2) → Catapult (r3, any-req with Mortar) → Cascade (r4) — the field-ordnance trunk (ADR-0004 wave C) |
| Armory | Two entries: Scattergun (r1) → Repeater → Howitzer gun trunk + Boomerang branch; Force Blades (r1) → Flamethrower → Meteor close-quarters trunk → Siegecraft (r4 stats) → Master-at-Arms capstone (r5, any-req from either trunk); Ballistics cross-links to Arsenal (Munitions) |
| Towers | Tempest (40) → Warden (75) → Lance (120) — chained |

Tuning intent: a first run reaching wave 5–8 pays ~20–40◆ — enough for one node.

## Haptics (`config.js: HAPTICS`)

Phone-first game, so touch is an output channel too (GDD section 8). **It is a
scarce one, deliberately.** A buzz means *"this happened to you"* — never "you did
a thing". Only three events carry haptics:

| event | pattern | why it earns the channel |
|-------|---------|--------------------------|
| `hurt` | 18ms | the tower took damage. GDD section 2 calls a chip a **signal**, and touch is the one channel that reaches the player even when their eyes are on the far rim |
| `boss` | 45 / 70 / 45ms | a named boss arrived — a threat that cannot be delegated, arriving off-screen more often than not |
| `gameover` | 220ms | the run ended |

Everything else is deliberately silent to the hand. `shoot` fires from five call
sites and `death` fires on every kill; a phone that buzzes for those is unusable and
battery-hostile, and — the real argument — **if everything buzzes, nothing does.**
That is Law-Legibility applied to touch: a channel only carries meaning while it
stays scarce.

**Rate-limited to one buzz per `HAPTIC_MIN_GAP`** (120ms). A surrounded tower takes
a strike every 0.9s *per besieger*, so without the limit a pile-up machine-guns the
motor; with it, a pile-up reads as a rumble. Total pattern length is capped by test
(`HAPTIC_MAX_MS`) so no future event can become a punishment.

Execution lives in `app/audio.js` (`haptic(id)`), which no-ops silently when
`navigator.vibrate` is absent — that is the *desktop* path, not an edge case, and it
is test-pinned. Toggled by `meta.haptics`, separate from `meta.sound`: silent-with-
haptics is a real way to play a phone game in company.

## Gestures (`gestures.js`)

A trace is `{t0, points: [{x, y, t}], holdEngaged}`. Classification:

- **hold** — engages *during* the gesture, under **two regimes, because the rule only
  needs to be strict when there is something to be strict about** *(2026-07-25)*:
  - **The run owns no swipe weapon** — nothing to disambiguate against, so a press
    engages after **0.15s regardless of motion**. This is the common case (the swipe
    slot is frequently empty under ADR-0006's budget, and no tower starts with one),
    and it is the case Daniel's first playtest broke on: *"noticeable delay before
    lance starts after I start holding."* **Tracking a moving shape with the beam is
    the beam's core interaction, and under the stillness rule it reads as wandering** —
    the anchor resets every frame the finger follows a target, so the channel starts
    late or never. 0.15s still clears a deliberate tap (typically 60–120ms) so taps
    keep aiming rather than channeling; it is a feel constant and Daniel's to tune.
  - **The run owns a swipe weapon** — the **0.28s sliding-stillness** rule stands:
    still = within 14px of an anchor that resets every time the pointer strays past
    it, judged over the *recent* window rather than since the press. A stroke and a
    track are genuinely indistinguishable mid-gesture, so the swipe has to be
    protected, and the cost is the delay above. *(2026-07-24, second-playtester bug:
    the older rule — max displacement from the press origin < 14px — permanently
    disqualified any press that moved early; stillness afterward couldn't
    rehabilitate it. "The beam won't trigger" was the classifier judging the gesture's
    past instead of its present.)* Deliberate consequence, unchanged: freezing
    mid-swipe for 0.28s converts the gesture to a hold — stopping and holding *is*
    holding, and the abandoned wall would have anchored at a start point the finger
    left long ago.

  The two regimes are **why the fast path is safe**: it is unreachable in exactly the
  runs where a swipe could be stolen. Both require the run to own a hold-slot weapon
  (at most one — gesture slots, ADR-0004); ownership of both slots is read from
  `WEAPONS[id].category` (ADR-0006), not a hardcoded id list. Once engaged, moving the finger aims the channel
  (movement no longer reclassifies). Ends on release; for the meteor, **release
  IS the trigger** (`releaseHold` seam) — beam and flame simply stop channeling.
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

**Rehearsal** (ADR-0018) — two run parameters that let a playtester start mid-game, so a
weapon can be felt without a lucky twenty-wave draft. `newRun`'s optional third argument:

- `startWave: W` — the run opens on wave *W* at **level W** with *W−1* picks banked, so the
  player drafts the build under test rather than being handed one. The director starts at
  `W−1` and increments into `W`; no spawn logic knows the difference.
- `startWeapon: id` — replaces **bolt** in the tower's starting loadout at bolt's level, and
  joins the level-up pool. The first real exercise of "a loadout may skip bolt" (ADR-0007).
  **Tech locks are deliberately ignored**: the weapons most needing a pass are the locked ones.

**A rehearsal run is invisible to the meta.** Either parameter sets `S.rehearsal`, and a
rehearsal run pays **no shards**, sets **no `best`**, writes **no score row** and unlocks **no
achievements** — otherwise opening at wave 25 and dying instantly is a free payout for a wave
nobody survived, which Law·No-meta-accel forbids in its purchasable form and which is worse
when free. The game-over screen says so rather than silently paying zero. These are unbuilt
lattice nodes being used early; when they graduate, the grant is earned and the flag goes.

`newRun(meta, towerId)` folds tech effects + tower profile into starting stats:
`maxHp = (100 + hpBonus) * tower.hpMult`, `dmgMult = (1 + dmgMults) * tower.dmgMult`,
etc. **Levels are granted by the wave director, not earned by kills** (ADR-0015):
`newRun` banks three at run start and `waveCleared` grants one per wave, each queued on
`S.pendingLevels` so the shell opens one choice screen per pending level.
**Every level-up heals 10% max HP** (`LEVELUP_HEAL`, applied per level granted,
so banked levels each pay). This is GDD §7's third half of a level-up — three
cards *and* a heal — and GDD §2 names it as the mechanism that keeps chip damage "in
the signal business and out of the death business": a single leaker taking a bite is
information, not attrition, only if the bite is recoverable. *(Added 2026-07-25; it
had never existed. Measured before, 12 fresh runs: median **40s of bleeding of which
only 6s was the actual drowning** — 85% invoicing, with individual runs at 292s bleed
/ 6s drowning (98%). Law·Death-shape outlaws exactly that shape.)* GDD §7's doom clock wants heals to
*rarify* as pressure peaks, and core.md long claimed the xp curve delivered that. **It
did not** (ADR-0015): the curve stretched, but so did the XP a wave paid, and the two
cancelled to a flat 1.00 levels per wave at every depth. The rarification that *does*
happen is carried by the **wave clock** — measured seconds-per-wave rise from ~35s
around wave 4 to ~41s by wave 15, so heals thin by roughly 17% over eleven waves.
Granting levels per wave therefore preserves the doom clock exactly as it really
operates and removes only a false account of why. A doom clock with teeth would have to
be built deliberately; it is pinned, not assumed.

**Control is measured in seconds, not damage** (`S.slowBy`, a `sourceId → seconds`
map). GDD section 4 judges the control weapons by *"seconds purchased and setups
created — **not** DPS"*, so a damage ledger structurally understates them: it
correctly reports frost at 0% (frost deals none) and misleadingly reports caltrops
near zero (their job is a 45% slow, not their 21 damage).

The unit is **shape-seconds of progress denied**: each frame, every slowed shape
contributes `(1 − slowFactor) × dt`. A shape held at half speed for two seconds has
been denied one second of approach — which is exactly the thing the swipe/field
weapons are supposed to be buying. Mass resistance is already inside `slowFactor`,
so an aged shape correctly yields fewer seconds than a fresh one (core.md
`enemyMass`), and a stationary besieger yields none, because slowing something that
has already arrived buys nothing.

When several sources slow the same shape their effects multiply, so the denied
second is split **proportionally to each source's own reduction** rather than being
double-counted — the ledger's total stays equal to the progress actually denied.

*(Added 2026-07-25, after a damage census ranked caltrops 0.4% and I recorded that
the metric, not the weapon, was what the census had wrong.)*

**Damage is attributed to its source** (`S.dmgBy`, a `weaponId → total` map). Every
`damageEnemy` call names what dealt it, and damage that genuinely has no weapon
behind it — a volatile's medic-bomb, a shape walking into another shape's blast —
lands in an explicit **`other`** bucket rather than vanishing. A breakdown that
silently drops damage is worse than none, because it reads as complete.

Attribution follows the **weapon**, not the form: a bolt wearing Fan is still bolt,
since a form is that weapon's rhythm rather than a separate thing (core.md Forms).
Entities that outlive the moment they were fired — bullets, shells, burning ground —
carry their source with them, because by the time they deal damage the weapon that
made them has long since moved on.

*Why it exists:* GDD section 6 wants mastery XP "shown post-game", and use-earned
mastery (ADR-0003 stage 2) needs a per-weapon signal to earn against — this is that
substrate. It is also immediately useful on its own: the death screen can finally
answer *what was actually carrying this run*, which is the question every balance
decision this week was made without being able to ask.

Wave-clear heals 4% max hp. `payout(state, meta)` computes shards (with salvage) and
returns the new meta (shards added, best wave maxed, no other mutation).

Meta shape (persisted by the shell, versioned key `pointdefense.meta.v1`):
`{ shards, best, tech: [nodeIds], tower: lastSelectedId, sound: bool,
seen: { enemies: [kinds], variants: [ids] },
scores: [{wave, kills, tower, ts}], ach: [achievementIds],
totalKills, totalBossKills, totalShards }`. `seen` is the **bestiary's discovery
record**: a kind/variant is recorded the first time one spawns in a run (sighting, not
kill); undiscovered entries render as "?" cards. Old saves missing any field inherit
the defaults on load. Enemy/variant tables in `config.js` carry `lore` + display
`desc` strings for the bestiary — content, single home.

## Records (high scores & achievements)

- **High scores** (`state.js: addScore`): top-10 runs, sorted by wave then kills;
  `addScore(meta, entry)` returns the new meta and the entry's 1-based rank (0 if it
  didn't place). Recorded at run end; timestamps supplied by the shell.
- **Lifetime totals** accumulate in `payout`: `totalKills`, `totalBossKills`,
  `totalShards` (earned, post-salvage).
- **Achievements** (`config.js: ACHIEVEMENTS`, logic `state.js: evalAchievements`):
  pure predicates over `(meta, finalRunState?)`, evaluated after every meta change
  (run end, tech purchase); once unlocked, an id stays in `meta.ach` forever —
  re-evaluation never re-awards. The list (config is the single home): First Blood
  (a kill) · Regicide (a boss) · Meet the Nobility / Double Digits / Deep Geometry /
  The Recirculation (waves 5/10/20/40) · Shape Crime (500 lifetime kills) · Hoarder
  (500 lifetime shards) · Investor (10 tech nodes) · Full Garrison (all towers) ·
  Field Guide (all shapes seen) · Complete Taxonomy (bestiary full) · Specialist
  (max a weapon in one run) · Overqualified (reach level 12 in one run).
