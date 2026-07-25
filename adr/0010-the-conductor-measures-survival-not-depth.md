# ADR-0010: The conductor measures survival, not depth

**Status:** ACCEPTED 2026-07-25 (Zephyr; measured). **Amends** the conductor gate built
earlier the same day (PINS `[phase 2]` → `scripts/conductor.mjs`). The law it enforces —
GDD §3 Law·Delegation — is unchanged; only the unit it is proven in changes.

## Context

Law·Delegation says *power is delegation; skill is prioritization*, and the prose under it
commits to a falsifiable claim: **autos are deliberately insufficient on their own.** The
conductor gate proves that claim in CI — same-seed pairs of 40-sim-minute headless runs on
the strongest slot-budget-legal delegation build, one with the aim parked at `t=0` and never
touched, one with a 0.2s-retargeting robot — and asserted

    median(robot.wave − parked.wave) ≥ 3

Two independent problems with that metric surfaced within hours of it landing. Neither makes
the gate's current verdict wrong; both make it unable to grow.

### Problem 1 — wave-reached is rate-sensitive, so it punishes good play

Found by the swipe census. Placing Force Walls took runs from **wave 25 to wave 13 in the
same 900 seconds** — monotonically "worse" the more walls were placed — while **nobody died
in any configuration, 0 deaths of 3 including the baseline.** The wall does not shorten runs;
it roughly halves the rate waves arrive at, at no survival cost. That is time purchased, and
it is precisely what GDD §4 asks a hold/swipe weapon to do: *"seconds purchased and setups
created — not DPS."*

So a player using walls well posts a **lower** wave number while being no worse off. The
gate's robot does not swipe, so the gate is not currently reporting a falsehood — but it can
never be taught to swipe or hold without the metric inverting. It measures the **aim**
dimension of hands, and structurally cannot measure the other two.

### Problem 2 — wave-reached is quantized to 5, and the band was 3

Deaths land on boss waves. Across three independent 11-pair sets, **63 deaths, every one at
wave 30, 35, 40 or 45.** The only non-multiples observed (47, 48) are runs still alive at the
cap, caught mid-wave.

`robot.wave − parked.wave` therefore has a resolution of **5**, while its band was **3** — a
band below one quantum. The gate could only ever answer one question: *did the median robot
reach the next boss wave?* It is a one-bit gate wearing a number's clothes, and a ratchet
that cannot be raised by less than a whole boss wave is not a ratchet.

## The measurement

Three independent 11-pair sets (seed offsets 0 / 20000 / 40000), cap 2400s, build
`bolt6 orbit5 nova5 frost5 tesla5 turret5`:

| set | Δwave median | Δtime median | **survival ratio median** | parked deaths | robot deaths |
|-----|--------------|--------------|---------------------------|---------------|--------------|
| 0     | 5 | 326s | **1.176** | 11/11 | 10/11 |
| 20000 | 5 | 319s | **1.204** | 11/11 | 10/11 |
| 40000 | 5 | 314s | **1.194** | 11/11 | 10/11 |

The wave column reports **5, 5, 5** — the metric cannot distinguish these three sets at all.
The ratio column reports a real, tight distribution the clock can see.

The load-bearing enabler: **the robot dies too** (10 of 11). Survival time is therefore
uncensored in the overwhelming majority of pairs, which is what makes a survival comparison
available at this cap in the first place.

## Decision 1 — the gate scores the median survival-time ratio

    median(robot.time / parked.time) ≥ 1.12

Time survived is rate-invariant: a wall that slows the wave clock raises survival time, so
the metric rewards it in the correct direction instead of penalising it.

## Decision 2 — a ratio, not absolute seconds

Absolute Δseconds (326/319/314s above) works today and is simpler. It is rejected because it
is not scale-invariant: this project tunes global difficulty routinely (`enemyHpMult` moved
twice this week), and any change that makes *all* runs shorter shrinks Δseconds even when
hands are worth exactly as much proportionally. That would trip the gate for a reason with
nothing to do with delegation. The ratio moves only when the **relative** worth of hands
moves, which is the thing the law is about.

## Decision 3 — a run alive at the cap counts at the cap, and that is deliberately conservative

A robot surviving to 2400s scores `2400 / parked.time`, understating hands by however long it
would have lived. For a **≥ floor** that error only ever runs one way: it can produce a false
BROKEN, never a false HOLDS. A gate that errs toward accusing itself is the right kind of
wrong.

The mirror case needs no special handling and is correct as it falls out: if a *parked* run
survives the cap, the ratio is ≤ 1 and the gate trips — a do-nothing build that lives forty
minutes **is** the law broken. The `parkedDeaths` clause says so independently, and is kept
unchanged for exactly that redundancy.

## Decision 4 — Δwave stays printed, ungated, labelled with its resolution

"The robot reached one more boss wave" is a legible sentence and worth seeing. Printing it
next to its own quantum is how the next person avoids re-adopting it as a gate, which is a
mistake this ADR exists because it was already made once.

## Band: ≥ 1.12, a ratchet

Observed floor 1.176 across the three sets; the band sits one step under it, the same
convention the original gate used (measured medians 4/7/10 → band 3). Set-to-set spread is
only 0.03, so the margin is sized against code-change drift rather than sampling noise.
Raise on re-measure; **never lower it quietly to make a new weapon fit.** A law-breaking
chassis gets its own declared band, not an exemption (ADR-0007).

## Alternatives considered

1. **Keep Δwave, raise the band to 5.** Rejected: still rate-sensitive, still one-bit, and a
   band equal to the quantum means one unlucky pair flips the median a whole step.
2. **Compare death *rates* rather than death *times*.** Rejected: the robot dies 10 of 11 and
   the parked run 11 of 11, so the rates are nearly equal at this cap. The signal is *when*,
   not *whether* — which is the same fact that makes Decision 1 possible.
3. **Lower the cap until nobody survives.** Rejected: at 15 minutes both modes ride the
   wave-pace ceiling untouched and the delta vanishes. The signal lives at the wave-45+ crack,
   which is why the cap is 40 minutes.

## Consequences

- The gate can now be taught to swipe and hold without its metric inverting. **That work is
  not done here** — the robot still only aims, so the gate's coverage of Law·Delegation is
  still one of three input dimensions. That is now a *coverage gap* with a clear route, rather
  than a design flaw with none.
- `scoreConductor` is extracted as a pure function and unit-tested, so the scoring rule is
  enforceable at test speed without running 22 forty-minute sims. The sims themselves remain
  gate-only.
- **The new unit paid for itself immediately.** ADR-0008's `BOSS_HP_SHARE` threshold was
  argued in wave-deltas — *"at 0.22 the robot dies at the same wave, so hands buy nothing."*
  Re-run in survival units: 0.22 → **×1.084** (parked deaths 8/11), 0.26 → **×1.189**, 0.31 →
  **×1.176**. The conclusion survives — 0.31 clears the band, 0.22 does not — but the
  reasoning sharpens: at 0.22 hands are not worth *nothing*, they are worth 8% and that is
  simply not enough. "Same wave" was the metric's resolution limit being read as a finding.
  Also newly visible: 0.26 and 0.31 are indistinguishable at this sample size, so 0.31 is
  above the threshold rather than measurably optimal within it. `core.md` updated; ADR-0008
  keeps its original numbers, being the story rather than the spec.
- Spec drift caught while re-measuring: `README.md` and GDD §3 both claimed parked deaths
  **7–9 of 11**. Re-measured on current `main`: **11/11**, in all three sets. Corrected in the
  same landing.
- **Standing lesson, and the second time this week the same one landed:** the wall pin already
  said "wave-reached is rate-sensitive" in words, and it read as a caveat to note rather than a
  defect to fix. It took *printing the raw values* — `0,0,5,5,5,5,5,10,10,10,12` — to see that
  the metric was also quantized. Look at the distribution, not the summary statistic.
