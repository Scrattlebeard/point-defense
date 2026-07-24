# ADR-0006: Weapon taxonomy — slots, categories, bases and forms

**Status:** ACCEPTED 2026-07-25 (Daniel: design authority, ratified live across the
taxonomy conversation of 2026-07-24/25; Zephyr: audit, drafting, the assignments)

**Supersedes in part:** ADR-0004 Decision 1 (gesture slots) — the slot model is
replaced by a budget-with-ceilings, and "AIM is deliberately NOT a slot" is reversed.
**Amends:** README design pillars 1 and 2 (see Decision 4 and Consequences).

## Context

Point Defense grew as a prototype; the GDD (`gdd/index.html`, 2026-07-24) was written
*out of playing it*, and is therefore aspirational in places. An audit against the GDD
on 2026-07-25 measured the distance. The finding that forced this ADR:

> A full-gear run with the aim point set once at t=0 and never touched again survived
> **40 minutes to wave 58 at 100% HP, with zero enemies ever reaching the rim.** Twice.
> Against a robot retargeting every 0.2s, hands were worth **one wave**.

The GDD's delegation law ("power is delegation; skill is prioritization — progress
automates the bottom of your kill chain, never your attention") does not hold, and the
proximate cause is that nothing is scarce: `levelChoices` caps HOLD and SWIPE at one
weapon each and caps nothing else, so a run can own all fifteen `kind:'auto'` weapons at
once. Fifteen autos play the game without you.

The GDD's answer — "1 gun · 1 hold · 1 swipe · up to 3 autos" — could not be implemented
as written, because the codebase had no notion of a *gun*: `scatter`/`burst`/`heavy`/
`boomer` are `kind:'auto'` carrying an AIM chip. Assigning a category to every weapon is
therefore the decision, not an implementation detail of one, and it surfaced a second
question: several ADR-0004 weapons look like *variations of* an existing weapon rather
than new ones — the GDD's own canonical wave-30 draft names "the burst" as a **form of
the gun**, while ADR-0004 shipped Repeater as a separate base weapon. The same thing,
built twice, under two systems, only one of which is in the spec.

## Decision 1 — two axes: input and category

Every weapon carries two orthogonal facts.

| axis | values | what it governs |
|------|--------|-----------------|
| **input** | `aim` · `hold` · `swipe` · `none` | how the player drives it; the card chip is a *display* of this |
| **category** | `gun` · `hold` · `swipe` · `auto` | what it costs the build — **the load-bearing field** |

They are not the same axis wearing two names. A beam is input `hold` and category `hold`;
a bolt is input `aim` and category `gun`; a boomerang is category `auto` while still
*sampling* the aim. The pre-existing `kind` / `slot` / chip triple collapses into these
two, with the chip derived from `input` rather than stored.

## Decision 2 — the gun/auto test: attention-scaling

> **A gun's output scales with your attention; an auto's does not.**

This is the GDD §4 class table's "judged by" column promoted to a rule (guns are judged
by damage per second-of-focus; autos by throughput). Point a howitzer better and it hits
harder. Point a boomerang better and it still sweeps out and back on its own geometry —
so the boomerang is infrastructure that happens to read the aim, and it is an auto.

*Cost, accepted:* this creates the category "auto that reads the aim," which slightly
muddies the tidy story that input predicts category. The alternative — every aim-reading
weapon is a gun — is worse: it makes "gun" mean "not a gesture," which is a statement
about the control scheme rather than about the focus economy.

## Decision 3 — the slot budget: ≤ 6 total, ≤ 1 gun, ≤ 1 hold, ≤ 1 swipe

A run fields **at most six weapons**, of which at most one gun, one hold and one swipe.
**Autos have no cap of their own** — they fill whatever the budget leaves.

- "Up to 3 autos" (GDD §4) becomes *emergent*: it is the maximally-diverse build. Skip
  the hold and you field a fourth auto instead. That is an identity axis a flat auto cap
  cannot express, and it costs one integer.
- At 6/6, `levelChoices` stops offering new weapons; upgrades to owned weapons and
  generic cards continue as now. No new mechanism.
- Category ceilings are enforced the way ADR-0004's slot filter already works, generalised.

## Decision 4 — every run starts with a gun; bolt is the *default*, not the universal

README pillar 1 said "every tower has it [the bolt]". Amended: **every tower starts with
a gun, and bolt is the default one.** A chassis that opens with a Howitzer is a legible
identity, and the gun slot is only interesting if something can occupy it besides bolt.
Never gunless, so the aim vocabulary still teaches itself from the first second.

## Decision 5 — slot count is tower-bent, never bought

No lattice node may grant weapon slots. A "+1 slot" purchase would instantly be the best
node in the game and would un-scarce precisely the thing scarcity is holding up. Towers
bend the grammar instead — the gunslinger's 2 guns + 2 autos (GDD §7) is a chassis, not
a shop item. This is a standing constraint on all future lattice content.

## Decision 6 — base vs form

> **A base is a different answer to *what this weapon is for*. A form is a different
> answer to *how it feels doing it*.**

Bases trade in the focus economy — range, target selection, what they can and cannot
kill. Forms trade in the hands — cadence, delivery, sound. Operational test: if you would
choose between two candidates based on *what else is in your build*, they are bases; if
you would choose based on *what you want to be holding*, they are forms. A "form" that is
only bigger-slower-more is a stat wearing a name, and is rejected.

**Forms belong to the weapons you hold** — gun, hold, swipe — and not to autos, at least
until every held weapon has its own. The mastery payoff is supposed to be audible and
felt (GDD §4, "rhythm is loot"); an orbital's cadence is not in the player's hands. Autos
deepen through levels and the lattice. Depth otherwise follows universality: every run
holds a gun, so the gun slot carries the most content.

## Decision 7 — the roster: 9 bases, 13 forms

| category | base | the job it buys | forms |
|---|---|---|---|
| gun | **Bolt** | generalist chip, always-on (*bang-pause-bang*) | **Burst** *(exists, demoted from base)* · **Fan** |
| gun | **Howitzer** | elite-cracker; rewards committing to a line | **Double** |
| gun | **Scattergun** | the rim sweep; crowd control at knife range | **Autoloader** · **Dragonsbreath** |
| gun | **Rail** *(new)* | interdiction — kill it *before* it arrives | **Fork** |
| hold | **Beam** | sustained single-target with a ramp; the scalpel | **Pulse** · **Lance** |
| hold | **Flame** | paint the crowd, walk away, let it cook | **Backdraft** |
| hold | **Meteor** | charged placement: you choose *where*, not *what* | **Cluster** |
| swipe | **Wall** | deny ground, buy seconds | **Spikewall** · **Repulsor** |
| swipe | **Blades** | the gesture inverted; offense along the line | **Cyclone** |

Autos (category `auto`, no forms this stage): orbit, nova, frost, tesla, seek, turret,
mine, mortar, catapult, caltrop, cascade, **boomer**.

**The Rail** is the one new base. Nothing in the game currently rewards killing at
distance — every gun is range-indifferent — while the GDD's canonical ninety seconds
requires it outright: *"elites with armor or regen will easily make their way to the
tower if I don't focus them from further out."* A long-charge, punishing-to-miss gun
makes "further out" a real axis and gives the armored and regen modifiers a counter-play
that is not simply "more DPS."

**Rejected candidates, recorded because the rejections are the rule working:**

- *Breach* (Howitzer, impact blast instead of pierce) — anti-crowd vs anti-elite is a
  role change. It is a base if it is anything, and four guns is enough.
- *Siege* (Howitzer), *Napalm* (Flame), *Comet* (Meteor), *Overpenetrator* (Rail) —
  sliders. Bigger, slower, more ground. Disqualified by Decision 6.
- *Flechette* (Scattergun, tight cone and long reach) — converges on the Rail's job.
  Two bases converging is worse than one form fewer.
- *Beacon* (a third swipe base: a decoy dropped along the swipe that pulls the horde off
  the line) — a good idea and genuinely a different way to buy seconds; descoped by
  Daniel to keep the phase bounded. Not dead, not scheduled.

## Decision 8 — bolt's ladder gives ricochet; the fan is a form

Bolt's current level ladder grants fan volleys at L5/L6. Those move **out** of the ladder
and become the **Fan** form; the ladder gains **ricochet** (each bolt kicks to a second
shape) in their place. They compose: max bolt in fan form throws a spread of bolts that
each ricochet.

*Why:* a form must not sell at mastery what levelling already gives away — the same
objection that killed *Overpenetrator*, applied to our own first draft. Composition also
beats exclusivity here; the max-bolt picture is better for it.

## Decision 9 — Buckshot is retired as a name

The GDD named *buckshot* twice as a bolt form. Buckshot-as-a-form and Scattergun-as-a-base
are the same weapon, and the base is worth more — it carries a distinct job (close-range
rim sweep) that nothing else covers. Both GDD passages now name the **Fan** instead.
Scattergun keeps the spread.

## Alternatives considered

1. **Flat "up to 3 autos" as its own cap** (the GDD's literal wording). Rejected: a total
   budget with ceilings expresses the same maximum while making auto-count an outcome of
   build shape. Strictly more expressive, one integer cheaper.
2. **Aim ordnance stay autos** (ADR-0004's position). Rejected: it leaves the gun slot as
   a slot only bolt can ever occupy, and it is what let a parked aim field five aim
   weapons at once.
3. **Collapse all guns into forms of one gun** — i.e. Scattergun and Howitzer become bolt
   forms, and the gun slot has one occupant with rhythms. Rejected by Daniel: it buys
   mastery diversity at the cost of build diversity, and every run's gun would start as
   the same weapon. Both kinds of content are wanted; hence bases *and* forms.
4. **Keep Burst as a base.** Rejected: the GDD's canonical draft already names it a form,
   and it is the cheapest possible pilot for the form system (it is fully built — it only
   has to move from "a card you can draw" to "a card you draw at max level").
5. **Discuss weapon purposes before building the cap.** Deferred deliberately: a weapon's
   purpose in a six-slot world is a different question than in an unlimited one, and
   neither of us has played the former. Taxonomy now, purposes after a playtest under the
   cap.

## Consequences

- **README pillar 1** is amended (Decision 4). **README pillar 2** — *"attention early,
  idle power fantasy late — the Vampire Survivors curve"* — directly contradicts GDD §3
  and loses: GDD outranks README, and the parked-aim measurement is what the pillar
  produces when taken seriously. Pillar 2 is rewritten to the conductor model.
- **ADR-0004 Decision 1** is superseded in part; the nine weapons it shipped survive
  almost intact — one reclassified (boomer → auto), one demoted (burst → form of bolt),
  seven unchanged.
- **Pool dilution gets worse, and that is the point of a follow-up.** Six slots against
  ~20 unlocked weapons means the specific weapon you want may never be offered. The cap
  does not create this problem; it reveals it. GDD §7's **weapon priority** moves from
  TENTATIVE to urgent, and is the natural next spec change.
- **ADR-0003 stage 2** (weapon mastery) is now partly specified: the per-weapon trees it
  describes are the trees that unlock the forms in Decision 7.
- **A conductor gate is owed** (GDD §11, phase 2): a headless run with a static aim
  measured against a retargeting robot, asserting hands are worth ≥ N waves, in CI —
  the same trick `scripts/calibrate` plays for the onboarding band. Without it, this ADR
  is a paragraph that a future weapon can quietly undo.
- Expect the cap to read as a nerf for exactly one playtest. Respecs are free; being
  wrong here is cheap.
