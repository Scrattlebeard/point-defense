# src/app/weapons — weapon executors

Purpose: execute every weapon's per-frame behavior. Stats come from
`core/config.js` (never defined here); every cooldown is scaled by `S.cdMult`;
damage flows through `enemies.js: damageEnemy`; projectiles live in `S` entity
arrays so a run is one object. No tuning constants beyond projectile plumbing
(speeds/lifetimes of visuals). Split from a single `weapons.js` when it passed
~900 lines and ADR-0003 stage 2 (per-weapon aspects) loomed.

## Modules — one file per weapon family

| File | Owns |
|------|------|
| `index.js` | **The only public seam**: `resetWeapons`, `updateWeapons`, plus re-exports (`fireWall`, `fireBlades`, `releaseHold`, `BEAM_REARM`). The orchestrator's **call order is behavior-load-bearing and lives nowhere else** — see below |
| `shared.js` | Cross-family plumbing: `EDGE`, `outside`, `wallFlare`, `wallBounce`, `fireBullet`, `aoe`, `swipeSegment`, `lvl`, `stats` |
| `aim.js` | Everything that fires toward the standing aim: bolt (+fan), scattergun, repeater, howitzer, boomerang, and the shared bullet pool update |
| `swipe.js` | The swipe slot: force wall (+siege), force blades |
| `hold.js` | The hold slot: beam, flamethrower, meteor (+`releaseHold`, heat/overheat — heat belongs to whichever hold weapon channels it) |
| `auto.js` | The classic autos: frost aura, orbitals, nova, tesla, seekers, turrets |
| `field.js` | Ground/field ordnance: mines, mortar (+shell pool, meteor impacts ride it), catapult, caltrops, cascade, burning-ground patches |

## Ordering (the invariant `index.js` encodes)

Within a frame: swipe → fires → bolt → hold → auto → field → aim ordnance →
bullet pool. Two hard rules, the rest is inherited convention frozen for
determinism:

1. **The bullet pool updates after every spawn site** — a bullet fired this
   frame moves and can connect this frame, for every gun equally.
2. **The frost aura is assigned before `enemies.js` reads it** (any position
   inside `updateWeapons` satisfies this; it must not move out).

Reordering families changes which shapes are dead when later families scan —
allowed only as a deliberate, tested change, not as a side effect of an edit.

## State

Per-run weapon timers/state live in the single `G.wt` bag, reset by
`resetWeapons` in `index.js` — deliberately centralized (one glance = whole
arsenal state; the bag is small and flat). Entity arrays live on `S`
(`state.js`); per-enemy weapon state (burn, prick-slow, primed, beam ramp)
lives on the enemy and is documented in the core.md weapon rows.
