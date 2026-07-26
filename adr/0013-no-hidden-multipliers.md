# ADR-0013 — No hidden multipliers: `BOSS_AUTO_RESIST` is removed

**Status:** ACCEPTED 2026-07-26. Supersedes **ADR-0012 Decision 3**. ADR-0012's Decisions 1,
2 and 4 stand — the boss is still sized in seconds and still enters mid-wave.

**Decided by:** Daniel. *"Wait we have a boss auto resist? I don't like that."* — then, given
the measured cost of removing it: *"Let's remove it now, then we can tweak numbers later —
and I won't be confused why changing HP numbers produce an outsized effect due to a hidden
multiplier."*

## Context

ADR-0012 introduced `BOSS_AUTO_RESIST = 0.5`: delegated (auto-weapon) damage landed at half
strength on a boss. It was added under pressure — sizing the boss in seconds had just broken
the conductor gate outright (hands ×1.000, parked deaths 1/11), and it restored the law by
separating *how long a fight is* (HP) from *whether hands are required* (the multiplier).

It was never swept. 0.5 was picked mid-breakage and shipped.

## The argument against, which is stronger than the argument for

Three objections, and the third is the decisive one:

1. **It has no tell.** `core.md` already states the principle, about `guard`: *"without a tell
   this reads as 'my weapons stopped working' — the player sees small numbers and blames the
   game."* `BOSS_AUTO_RESIST` was a permanent, invisible, global 50% tax with no feedback of
   any kind. The project had written the rule and then broken it.
2. **It silently taxed a legitimate build.** A player who invests in auto weapons was weakest
   on exactly the fights that decide a run, and nothing in the game said so.
3. **It made every other lever untrustworthy — Daniel's reason, and the one that generalises.**
   A hidden multiplier does not merely mislead the player; it corrupts *tuning*. Change boss
   HP and the observed effect is the HP change composed with an invisible factor, so the
   designer is reasoning about a curve they cannot see. **Every future balance measurement on
   this project would have carried that error**, and the sessions that produced ADR-0008,
   0010 and 0012 were *entirely* measurement-driven. This is the same class of defect as the
   three "constant beside a scaling curve" bugs, one level up: not a wrong number, an
   unobservable one.

Against that, one real argument: it works. The conductor gate reads ×1.661 with it and
×1.000 without.

## Decision

**Remove it.** Delegated damage lands in full on a boss, as it does on everything else.

**Law·Delegation is therefore knowingly unenforced at the boss, and the conductor gate is
RED**: hands buy ×1.000 (band ≥1.12); the parked-deaths clause still passes at 3/11. This is
recorded rather than hidden, and `scripts/promote` will refuse prod until it is resolved —
which is the gate working, not the gate broken.

**Accepting a red gate is a deliberate, time-boxed trade**, and the reasoning is worth
stating because it inverts the usual rule: an unenforced law is visible, argues with you
every time you run the gate, and is written down here. A hidden multiplier is none of those
things. **Given the choice between a law we know is failing and a law upheld by a mechanism
nobody can see, the failing one is safer**, because it is the only one that can be fixed by
someone who does not already know it is there.

## What replaces it

**An episodic, telegraphed guard.** The boss raises its guard on a cycle — visible, using the
`guard` scalar and telegraph vocabulary that already exist — and during that window delegated
damage is weak while aimed, hold and swipe damage gets through. Same law, but it becomes an
event that demands a response rather than a constant nobody learns about, which is what
Law·Bosses asks for in the first place. It also composes with the interruptible charge rather
than sitting underneath it.

Not built here, deliberately: the removal was asked for on its own, and bundling an unratified
design into it would be the same "decide it in code" move this ADR exists to reject.

## Consequences

- **Boss fights get shorter**, because autos now contribute fully. `BOSS_TTK_TARGET` was
  calibrated with the multiplier in place and is now measurably off — re-measure with
  `scripts/bosstime.mjs` before trusting it. **This is the first dividend of the removal:**
  the miscalibration was always there, and was previously invisible.
- The charge interrupt (`interruptFrac`) was tuned against halved auto damage, so autos now
  interrupt at half the effort. Its sweep is in `PINS.md` and should be re-run.
- `test/bossmoves.test.mjs`'s "autos pay double" case is rewritten — **called out as a
  loosening**: it asserted a cost ratio that no longer exists.
- Weapon damage attribution (`S.dmgBy`) and the Armory census become honest for boss fights
  for the first time; both previously recorded auto contributions post-tax without saying so.
