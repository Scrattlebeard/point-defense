# GDD staging notes — ratified in the 2026-07-24 vision talk

Decision log for the forthcoming `gdd/index.html`. Terse on purpose: each line is a
*ratified* design truth (Daniel = design authority), not a proposal. The GDD will
carry the prose; this file exists so the talk-through survives a session cut.

## Tier framing
- The GDD sits **above** README/core.md: it is the experience spec; core.md is the
  current mechanical cut; ADRs carry why cuts changed. Divergence = bug, resolved at
  GDD altitude. Living HTML doc, cross-linked anchors, served readable from a phone.

## Vision
- **Fantasy: Last Stand power fantasy.** Weapons tear through the horde; it keeps
  coming; odds grim; "new bullshit keeps happening." !FUN! meets power fantasy —
  immovable object vs ever-increasing unstoppable force.
- **Visual language** (separate from fantasy): radiation/radials as motif
  (pin: lattice probably back to radial) + Tron/cyber simple shiny geometry.
- **Core resource: focus/prioritization.** Where weapons point, which upgrades,
  which weapons you lean on. Triage and tradeoffs.
- **Law (ratified with "should"):** there should always be more worth doing than you
  can do, and ≥2 defensible answers to "what now?" A no-brainer choice is a design bug.
- **Legibility is law:** shape = species, highlight = modifier, fill = allegiance.
  Hectic is the plan; unclear is the enemy.
- **Audience: household artifact, for now.** Grind tuned for two named people, not
  retention. "For now" = explicit revisit trigger (shipping reopens onboarding/difficulty).

## Death & damage shape
- **Drowning is a valid death** (clear-rate loses the race, visibly). **Chipping is
  not** (death by slow bookkeeping while winning every visible fight). Death should
  trace to a felt moment of being outpaced.
- **Chips are signals:** recoverable HP; a chip = legible "your line has a hole,"
  not meaningful attrition. (No mechanical fix needed now — watch the siege rework.)

## The endgame player (canonical 90-second narration exists — GDD §Focus Economy)
- **Power is delegation, skill is prioritization** (replaces "idle power fantasy").
  Autos absorb the bottom of the kill chain, never your attention; deliberately
  insufficient alone. Manual weapons are the scalpel; hands never retire.
- **Aim-time is the endgame currency**; threats are competing bids for it.
- **Field/gesture weapons are tempo, not damage** — judged in seconds-purchased and
  combos created (wall pins cluster in orbital path).
- **Bosses: slowable, never displaceable.** Frost works on them (counter-boss tool);
  knockback ÷6 kills the exponential CC lock. Bosses are focus-forcers; the
  boss-behaviors pin is load-bearing (adds, epithets), not flavor.
- Default-tower narration; towers bend the archetype (tower identity = "how does
  this tower change the ninety seconds").

## Run & account structure
- **A run can be won:** escalation → end boss around wave 50–100 (placed by content
  density) → the stand holds → **endless mode as encore** (death resumes its job).
- **Account arc is finite:** deep grind (lattice, towers, masteries), then afterlife =
  challenge achievements + build chasing. **Replayability bar deliberately unset (OPEN).**

## Content doctrine
- **Escalating composition is the default bullshit generator** + growing modifier
  pool. Run-random events/curveballs = named future organ, not designed now.
- **Wave ~40 is the compounding regime change:** bosses take epithets AND mobs start
  rolling **stacked multi-variants** (armor+fast+regen). Legibility survives via the
  five distinct highlight channels (outline/glow/inner glyph/ring/core).

## Builds (three layers; the workshop authors, the battle drafts)
1. **In-battle powerups** (level-up draft) — deep-dive still owed (next topic).
2. **Loadout (pre-run):** tower; starting weapon *form* when unlocked (e.g. bolt tree
   → start as "burst" or "buckshot"); **weapon priority** when unlocked (biases the
   in-run draft toward what you're grinding); possibly more.
3. **Progression (shards + weapon/tower exp):** lattice passives, tower-tree special
   abilities, weapon trees fed by *use-earned* exp. **Respecs free, at least for now.**
- **Slot grammar:** max 1 "gun" + 1 hold + 1 swipe + up to 3 autos (numbers are
  tower-bendable — "gunslinger" tower: 2 guns + 2 autos). Slot caps are the focus
  law applied to builds: you cannot own everything; identity is forced.
- **Mature-tree start:** enough invested → start directly at ~level 20 / wave 20 and
  click through banked picks — veterans skip the solved early game; the pre-run
  draft becomes part of the loadout ritual.
- Build = lattice passives + tower abilities + selected weapons + their upgrades.

## GDD skeleton (approved with amendment)
Vision · The Run · Focus Economy · Combat Grammar · Threat Design · **The Meta Loop**
· **Builds** (both promoted to inner-loop weight) · Visual & Audio Language ·
Onboarding · Futures (co-op, events, endless design — non-commitments).
Form: single self-contained `gdd/index.html`, game's own visual language, stable
anchor ids per concept, Laws index up top.

## Open threads
- In-run powerup system deep-dive (Daniel flagged: "we should dive into this").
- Draft randomness for veterans (asked, unanswered at time of writing).
- Replayability bar; radial lattice pin; events design; tower archetype roster.

## Addendum (same session, later)
- **Priority semantics (TENTATIVE — "not thought through yet"):** deterministic slot
  resolution. You don't control *when* a slot-type offer appears; when it does, it's
  your prioritized weapon. The run says "not yet," never "no." Unlocked per slot type.
- **RULE: no meta-acceleration.** Nothing purchasable speeds meta-progression (no
  +shards, no mastery-exp boosters) — the power-vs-rewards tradeoff is not fun.
  In-run xp mults stay legal. (Salvage income line outlawed — see PINS.md.)
- **RULE: QoL is milestone-granted, never bought.** Auto-unlocks at total-investment
  thresholds (third hold weapon → hold-priority). QoL never competes with power.
- **The draft (wave-30 level-up, canonical narration exists):** time stops; 3 cards
  (4th card / reroll = named maybes); ~10% heal per level-up (number tentative; note:
  stretching xp curve → rarifying heals = built-in late-run doom clock).
- **META'S ORGANIZING PRINCIPLE: the account authors the draft.** Lattice unlocks
  inject card types into the in-run pool (crit cards exist only after the crit node);
  mastery trees inject form cards; priority fixes slot identity; loadout sets starting
  forms. Meta-progression's payout = richer future decks, not (only) bigger numbers.
- **Form cards:** offered only when a weapon is max-level and the form is
  mastery-unlocked; forms change *rhythm and texture*, not just stats
  ("ratatatata-pause-ratatatata" — the mastery reward is audible).
