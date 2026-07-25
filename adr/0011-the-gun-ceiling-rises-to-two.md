# ADR-0011 — The gun ceiling rises to two

**Status:** ACCEPTED (2026-07-25). Supersedes the `gun: 1` half of ADR-0006 Decision 3;
the `hold: 1` / `swipe: 1` ceilings and the `total: 6` budget stand unchanged.

## Context

ADR-0006 gave every weapon a `category` and priced the build with
`SLOT_BUDGET = { total: 6, gun: 1, hold: 1, swipe: 1 }`, enforced in `levelChoices`: a
category already held by a *different* owned weapon locks its rivals out of the draft.

Measured 2026-07-25 over 60 mature-account runs, this produced dead content rather than
scarcity:

- **Scattergun offered in 0% of runs. Howitzer 0%. Not rare — never.**
- All six slots fill by level ~8.6 of ~37, in 60 runs of 60.
- Distinct weapons ever offered as new: 10.8 of 21.

The cause is structural, and it is two individually-correct decisions composing badly:
the category ceiling is right, and **every one of the four towers starts with bolt**. So
the gun slot is occupied at t=0 in every run that has ever been played, and no gun base
can be drawn by anyone. ADR-0006 anticipated *dilution*; nobody anticipated *lockout*.
ADR-0006 Decision 4 had already said the quiet part — *"the gun slot is only interesting
if something can occupy it besides bolt"* — without noticing that nothing ever could.

## Decision

**`SLOT_BUDGET.gun = 2`.** A run may field two guns. `total: 6` is unchanged, so the
second gun is bought with an auto slot: a real trade, not a gift.

Enforcement generalises from "is this category taken" to "how many of this category are
owned" — `levelChoices` counts per category and compares against the ceiling, so the
budget is now uniformly a set of counts and a total.

## Why guns, and why this is not just "the cheapest thing that unlocked them"

The ceiling of 1 was inherited from ADR-0004, whose rationale was **gesture ambiguity**:
a gesture must mean exactly one thing mid-fight. That argument is airtight for hold and
swipe — with two hold weapons, a hold is a question; with two swipe weapons, a swipe is a
question. **It was never true of guns.** Guns do not consume a gesture at all: they
auto-fire toward the *standing aim point*, which is shared, singular, and updated by every
tap and swipe. Two guns firing at the same aim is not ambiguous, it is just two guns.

So the ceiling on guns was a generalisation carried over from a rule about gestures, applied
to the one category that has no gesture. Raising it corrects a category error rather than
merely loosening a constraint — which is also why this ADR raises **only** the gun ceiling
and leaves hold and swipe at 1.

## Alternatives considered

1. **Tower loadout diversity** — give an unlockable tower a different starting gun. Cheapest
   in code, and it converts dead content into tower identity, which is what towers are for.
   **Deferred, not rejected** (Daniel: *"We'll deal with other towers and stuff later"*). It
   composes with this decision rather than competing: once a tower can open with a Howitzer,
   a ceiling of 2 lets that tower still draft a second gun.
2. **A pre-run weapon-priority surface** (GDD §7) — fixes slot identity so the draft offers
   *your* gun. Still wanted; it addresses the level-8.6 lock-in that this ADR does not touch.
3. **Rival guns as a REPLACEMENT card** (swap, not add) — the only route that lets a build
   change its mind mid-run. Most expensive; a new mechanic. Still open.
4. **Leave it and accept three dead weapons.** Rejected: ADR-0006's own Decision 4 argues
   against it, and shipping content nobody can ever see is worse than not shipping it.

## Consequences

- Scattergun, Howitzer and Boomerang become reachable for the first time. Whether they are
  *worth* reaching is a separate, already-measured problem: the Armory census puts Scattergun
  at 5.3% and Howitzer at 4.5% of a pair's damage, the two weakest non-dead weapons, against
  a bolt doing 55–70%. **Unlocking them exposes a balance question that was previously
  hidden behind an unreachable door**, and that is progress, not a regression.
- The second gun costs an auto slot, so the interesting decision is now real: is a second
  gun worth more than a fifth auto? That question could not previously be asked.
- Law·Focus is unaffected in kind — 6 slots is still the scarcity. The build space widens;
  it does not inflate.
- **Not addressed here:** all six slots still fill by level ~8.6, so the *timing* of build
  commitment is untouched. That is alternative 2/3's job and stays pinned.
- `test/taxonomy.test.mjs` already asserts ceilings generically against `SLOT_BUDGET`, so it
  follows the table. The one test that hard-coded the old rule — "owning any gun locks the
  other guns out" — is rewritten to the new ceiling and **called out as a loosening**, since
  it is exactly the kind of change the review protocol says must not ride in quietly.
