# ADR-0004: The Armory — gesture slots + nine new weapons

**Status:** ACCEPTED 2026-07-24 (Daniel: overnight mandate — "implement as many as
you want, add your own twists"; Zephyr: design + implementation)
**Context:** Daniel's weapon list, verbatim shape: bolt variants (buckshot, burst
fire, heavy-and-sidearm), a beam variation (flamethrower with stacking DoT +
burning ground), meteor (hold-to-grow, release, auto-release at max), boomerang,
force blades from swipes, catapult (trampling, pushing boulder), caltrops, and
"something slow-firing that sets up a spreading chain reaction."

## Decision 1 — gesture slots: HOLD and SWIPE are exclusive

A run owns **at most one weapon per gesture**. HOLD is a slot (beam |
flamethrower | meteor); SWIPE is a slot (force wall | force blades). Once a
slot is occupied, `levelChoices` never offers the slot's other weapons that run.

- *Why:* gestures are weapon classes (README pillar 1). A gesture must mean
  exactly one thing mid-fight; two hold weapons would demand a mode switch — a
  menu in a game whose whole pitch is that the fingers never leave the fight.
- **AIM is deliberately NOT a slot.** The aim point is a standing *input*, not a
  trigger; aim-tag ordnance (bolt, scattergun, repeater, howitzer, boomerang)
  auto-fires toward it and stacks like any auto weapon. Exclusivity guards
  gesture *meaning*; the aim point has one meaning no matter how many guns
  follow it.
- Towers keep starting loadouts as-is; no tower starts with two same-slot
  weapons, and the invariant is test-pinned.

## Decision 2 — nine new weapons, all tech-locked

| Daniel's idea | ships as | class |
|---------------|----------|-------|
| Buckshot | **Scattergun** (`scatter`) — slow overlapping semi-random pellet volleys | aim |
| Burst fire | **Repeater** (`burst`) — salvos of quick bolts, pauses between | aim |
| Heavy + sidearm | **Howitzer** (`heavy`) — three quick pistol rounds, a beat, one piercing shell | aim |
| Boomerang | **Boomerang** (`boomer`) — out and back, hits on both legs, bounces off the arena wall | aim |
| Flamethrower | **Flamethrower** (`flame`) — cone, stacking burn DoT, burning ground patches | hold |
| Meteor | **Meteor** (`meteor`) — hold to grow, release to strike the aim point; auto-releases at max | hold |
| Force blades | **Force Blades** (`blades`) — the swipe hurls crescents outward along its cut | swipe |
| Catapult | **Catapult** (`catapult`) — slow boulder that tramples through and shoves aside | auto |
| Caltrops | **Caltrops** (`caltrop`) — scattered ground spikes: prick + brief slow, one prick each | auto |
| Chain reaction | **Cascade** (`cascade`) — primes a shape; detonation primes neighbors at decaying power | auto |

All nine are `techLock: true`. *Why:* the onboarding band (ADR-0003 guardrail,
`scripts/calibrate`) is measured on fresh no-tech runs; tech-locked weapons
cannot move it, so the whole armory lands without re-litigating the early
curve. In-run balance of the new weapons is explicitly provisional until
Daniel plays.

## Decision 3 — a seventh lattice sector: Armory

Manual/aim weapon unlocks get their own sector (**Armory**) rather than
overloading Arsenal (which would grow to ~17 nodes and crowd its wedge, and
whose identity is *auto* ordnance). The three auto field weapons join
Arsenal's existing chains (mine → caltrops → catapult → cascade territory).
Layout is computed, so a new sector is config + one color; the sector list is
pinned in tests and extended deliberately there.

## Alternatives considered

- **Ship these as ADR-0003 stage-2 weapon aspects** (buckshot as a bolt
  aspect, flamethrower as a beam aspect): tempting mapping, but aspects
  re-flavor a weapon you already own — these wanted to be *picks*, new pool
  entries with their own level ladders. Stage 2 (use-earned mastery) remains
  unbuilt and unblocked; if a variant later graduates into an aspect, the
  executor code moves with it. Rejected for now.
- **Multi-hold mode switching** (own beam AND flamethrower, toggle somewhere):
  rejected — see Decision 1.
- **New weapons unlocked by default:** rejected — calibration band, and the
  drip-feed is the game's teaching style.

## Consequences

- `WEAPONS` gains a `slot` field on gesture weapons; `levelChoices` filters by
  occupied slot (test-pinned).
- Hold plumbing generalizes (`holdOwner`/`holdAim`, a `releaseHold` seam for
  meteor's release-to-fire).
- Enemies gain a temp-slow field (caltrops) and a burn stack field
  (flamethrower) — both sim-side, both mass-resisted like every other CC.
- New entity arrays on `S` (boomers, blades, boulders, caltrops, fires,
  sparks); render registers documented in app.md, one per weapon family, none
  reusing nova's ring or the enemy wireframe registers.
