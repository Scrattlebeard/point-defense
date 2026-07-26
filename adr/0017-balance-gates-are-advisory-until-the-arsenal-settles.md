# ADR-0017 — Balance gates are advisory until the arsenal settles

**Status:** ACCEPTED (2026-07-26). Suspends the *blocking* half of ADR-0003 guardrail 4
(calibrate) and ADR-0007/0010 (the conductor gate). Both keep running and reporting. The
`npm test` and perf gates are unaffected and stay hard.

## Context

Daniel: *"We're still too early in iteration to really need gates. Most of our weapons still
require a proper pass."*

The day this was said is the argument for it. Four difficulty changes landed, and the
balance gates produced, in order:

- a **stale red banner** that stood for part of a day because the gate was never re-run
  after the change that fixed it;
- an **out-of-band calibrate reading** that turned out to be substantially the instrument —
  the robot cannot hold or swipe, so it drafts beam/walls/flame/blades and burns the pick;
  filtering those moves the median 4 → 5, back in band;
- a pin, written by me, recommending an `enemyHpMult` pass to bring the median back — i.e.
  **tuning the game to fit a broken ruler**, deleted before anyone acted on it.

None of that was the gates catching a regression. It was the gates being trusted past their
evidence, and it cost a working day's attention.

The deeper point is Daniel's: **a gate encodes a target, and the target is still moving.**
Most weapons have not had a balance pass. An aggregate like "fresh-run median death wave" or
"hands buy ≥1.12× survival" is a measurement of a system that is not finished, held against
a threshold picked when it was even less finished. Precision against a moving target is
false precision, and acting on it is worse than ignoring it.

## Decision

**Calibrate and the conductor become advisory: they run, they print, they never fail a
build.** In `.github/workflows/pages.yml` both gates gain `|| echo "::warning::…"` on the
prod and beta channels. Nothing else changes — same scripts, same thresholds, same output.

**They are not deleted, disabled, or made optional to run.** The distinction is between a
gate's *reading* and a gate's *authority*: the reading stays, the authority is suspended.

Hard gates that remain: `npm test`, and `scripts/perf.mjs`. Both measure code, not design
target — a broken test or an O(n²) landing is wrong at any stage of iteration, and neither
threshold moves when the arsenal does.

## Why the conductor keeps running, even though it is the noisier one

Because it earned its keep today and playtest cannot replace it. Removing in-run XP
(ADR-0015) made the do-nothing run **unkillable** — parked at t=0, wave 49, 100% HP — and
that is invisible to a human playtest for the obvious reason that a human plays with their
hands on. It is the one instrument here that asks a question no session can ask.

That is the case for keeping the *reading*. It is not a case for keeping the *authority*:
the conductor is red right now for a reason we understand and have chosen, and a red build
adds nothing to that understanding.

Its own robot has the same handicap as calibrate's — aim-only, no hold, no swipe — which is
one more reason not to let it fail a build until someone decides what it should be measuring
(pinned).

## When to re-arm

Not on a date — on a condition. **Re-arm when the arsenal stops moving**: when the weapons
have had the balance pass Daniel names above, and a session can pass without a weapon's
numbers changing. At that point re-derive both bands against the settled content *before*
turning them back on, because today's thresholds were fitted to a different game and to a
robot whose limitations were accidental rather than chosen.

Concretely, the re-arming session should: fix or deliberately keep the robots' aim-only
handicap (pinned, needs its own ADR since it moves what the numbers mean), re-derive the
calibrate band and the conductor ratio, and only then restore the hard failure.

## Alternatives considered

1. **Delete the gates.** Rejected: the conductor's XP finding is exactly the class of bug
   nothing else catches, and re-writing a gate later costs more than leaving it printing.
2. **Keep them blocking and fix the robots first.** Rejected on Daniel's own argument — that
   is more investment in gate fidelity during the phase where the target moves weekly. The
   instrument fix is pinned, not scheduled.
3. **Keep calibrate blocking, drop only the conductor.** Backwards. Calibrate is the one that
   misled us today; the conductor is the one that found something real.
4. **Raise the bands so they pass.** Rejected outright — that is the "tune to fit the ruler"
   move this ADR exists to stop, with the added harm of destroying the historical series.

## Consequences

- **Prod is unblocked.** Both README banners lose their "prod is blocked" language and become
  what they should have been: current readings, with the reason they are red and the note
  that neither is authoritative right now.
- **The delegation break stays pinned at full severity.** Suspending a gate's authority is
  not a verdict on the finding it made. Parked-unkillable is still the biggest open item.
- **Watch for the failure mode this introduces:** an advisory gate is one nobody reads. The
  mitigation is that both still print in CI and both are named in PINS with their current
  numbers, so a session that wants them has them — but if the next few sessions never mention
  them, that is the signal that they have gone quiet rather than green.
