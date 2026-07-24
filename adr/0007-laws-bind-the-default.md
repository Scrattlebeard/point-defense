# ADR-0007: Bolt is the default weapon, not a guaranteed gun — and laws bind the default, not the chassis

**Status:** ACCEPTED 2026-07-25 (Daniel, correcting ADR-0006 within the hour it landed)
**Supersedes:** ADR-0006 Decision 4.

## Context

ADR-0006 Decision 4 read: *"every tower starts with a gun, and bolt is the default one."*
That overstated the design authority's position. The correction, verbatim:

> "Not every run starts with a gun, it's just the default weapon. A different tower may
> open with a weapon that's not a gun at all. And we may eventually introduce towers/builds
> that challenge the conductor model. Rules and assumptions are made for breaking."

Two decisions fall out — one narrow, one that governs how every other rule in this repo
should be read.

## Decision 1 — bolt is the default *weapon*, not a guaranteed gun

A run starts with whatever its tower's loadout says. Bolt is the default that loadout
reaches for, nothing more. **A tower may open with no gun at all** — a chassis whose
identity is "you start holding a beam and you find your gun later," or that never wants a
gun, is legitimate.

Consequences for ADR-0006, which otherwise stands:

- The gun slot may be **empty**, in a run or permanently. The slot budget already permits
  empty slots; no mechanism changes, only the invariant.
- **No test may pin "every tower has a gun."** The invariant worth pinning is the budget
  and its ceilings — that no loadout exceeds ≤6 / ≤1 gun / ≤1 hold / ≤1 swipe.
- The aim vocabulary no longer teaches itself from second one in every run. That is a real
  cost, accepted: a gunless chassis must be a *deliberate* unlock, never the first tower a
  new player meets. Onboarding is the Bastion's job.

## Decision 2 — laws bind the default; a chassis may break one by design

The seven-plus laws in the GDD are **defaults, not physics.** A tower, build or future
system may deliberately break one, and that is design rather than violation. A tower whose
whole identity is "actually, you *can* park and turtle" is a legitimate future even though
it contradicts Law·Delegation head-on.

**The qualifier, and it is load-bearing:** a break must be **named, recorded, and legible
to the player as an identity.** A law that anything may quietly violate constrains nothing,
and the difference between an exception and a loophole is entirely whether someone wrote it
down on purpose. So:

- Breaks are declared at the GDD tier, on the law they break, saying which chassis breaks it
  and what the player gets for it.
- The break must read as a *choice the player made* — picking the turtle chassis — never as
  an emergent consequence of stacking upgrades nobody planned. The parked-aim run that
  prompted ADR-0006 was a loophole, not an exception; that is the distinction.
- Anything unrecorded is still a bug, and the tier discipline is unchanged: fix it at the
  highest tier it touches.

## Consequences

- **The conductor gate (GDD §11 phase 2) measures the default chassis.** N is a property of
  the Bastion and the standard slot budget. A law-breaking tower does not get an exemption
  from the gate — it gets its **own band**, declared with the tower. "This chassis is
  expected to be worth ~0 waves of hands, and here is what it pays for that" is a spec; a
  skipped assertion is not.
- This ADR is why `README.md` and `gdd/index.html` say "default," not "always." A future
  session reading a law should reach for this file before concluding a design that breaks
  one is wrong.
