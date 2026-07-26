# ADR-0016 — The run opens at level one

**Status:** ACCEPTED (2026-07-26). Supersedes ADR-0015's section *"Why the opening three
move to run start rather than wave-1 clear"*. The rest of ADR-0015 — levels come from
waves, XP removed, the retirements — stands unchanged.

## Context

ADR-0015 opened every run with a **draft of three levels** before the first shape spawned,
and argued for it on time-to-first-agency: the deleted XP economy handed out its first
level about five seconds into wave 1, so granting the opening three at wave-1 *clear* would
have pushed the first build choice out to ~35 seconds, and *"a phone roguelite's opening
agency is not a place to spend 30 seconds of nothing."*

That argument optimised the wrong thing. It treated the old system's *timing* as the
property worth preserving, when the property actually worth preserving is that **the player
starts at the bottom and climbs**. Opening at level 3 with three cards already banked hands
the player a built loadout before they have seen a single shape — the first meaningful
decision of the run is made with zero information about the run.

Daniel: *"let's start at level 1, not 3."*

## Decision

**`OPENING_LEVELS = 3` → `1`.** A run begins at level 1 with no banked picks. The first
level — and the first card — arrives on clearing wave 1, and one arrives per wave after
that.

The level curve becomes **level at the start of wave N = N**, down from N+2.

Head Start and Running Start are unaffected in kind: they still stack a free pick each on
top of the opening, so they now open the run at level 2 and 3 respectively — which is
exactly what Head Start's card has always claimed.

## Consequences

- **This is a real difficulty increase, and it takes calibrate out of band.** Fresh-run
  median death wave is **4** against a [5, 10] floor — measured twice at 200 trials, both
  reading 4, so it is not instrument noise. **The gate is red and prod is blocked.** Landed
  anyway, consistent with the same-day precedent (ADR-0015): the change is right, the
  measurement is recorded, and a revert is one commit.
- **The band broke on the stack, not on this change alone.** Four difficulty changes landed
  on 2026-07-26 and the fresh-run median walked down with each: **7** after the wave-5 boss
  gained 47% HP (`BOSS_TTK_FIRST` 15→22), **5** after the bolt capstone moved the second
  stream to MAX (ADR-0014), **5** after in-run XP was removed (ADR-0015), **4** here.
  Nobody has played any two of them together, let alone all four. **The honest fix is the
  early difficulty curve — `enemyHpMult`, or giving back some of `BOSS_TTK_FIRST` — not
  walking any of the four back**, and it should be tuned once against the finished stack
  rather than four times against moving parts.
- **Wave 1 is now a genuine tutorial beat** — you meet the game with the tower's starting
  weapon and nothing else, and the reward for clearing it is your first choice. The old
  three-card opening was a menu before a meal.
- **Law·Delegation is unaffected.** This was already measured: while diagnosing ADR-0015's
  0/11 break, `OPENING_LEVELS = 1` was probed directly and left the conductor equally broken
  (×1.000, parked deaths 0/11). So this change neither causes nor cures that break, and the
  pin stands untouched.
- `test/state.test.mjs` pins the curve in **literals** rather than in terms of
  `OPENING_LEVELS`, deliberately — assertions written in terms of the constant are
  tautologies that pass for any value, which is exactly how a wrong opening survived a green
  suite once already. The literals move from `[4,5,6,…]` to `[2,3,4,…]`.
