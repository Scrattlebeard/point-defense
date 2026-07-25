# ADR-0012 — A boss is sized in seconds, and its undelegatability is a separate mechanism

**Status:** ACCEPTED 2026-07-25. Supersedes **ADR-0008 Decision 2** (boss HP as a fixed share
of wave HP). ADR-0008's Decisions 1, 3 and 4 stand; so does its *finding*, which this ADR
extends rather than contradicts.

**Triggered by:** Daniel, playing — *"I'd have died to hp sponge bosses much earlier if I
couldn't cheese them by spawning force walls inside them"*, then, asked what a boss fight
should be: *"around 60s events as the default"* and *"I don't think maxed weapons is the
right measurement — that depends on how deep into waves we are whether that's realistic"*,
and *"move the boss timing up so it spawns during the high-intensity part, not as one of the
last enemies."*

## Context — what was wrong with a share

ADR-0008 defined `bossHp(w) = share/(1−share) · waveTrashHp(w)` to fix a real bug: `bossHp`
had been **linear against a quartic wave curve**, decaying from 31% of its wave at wave 5 to
4.9% by wave 45. Making it a share made that decay structurally impossible. That much was
right and is preserved below.

**But a share normalises the boss against the *enemy* budget, and the property we care about
— is this a focus-forcer or a sponge? — is time-to-kill, which depends on *player damage*.
Player damage appears nowhere in the formula.** Measured, with the build a player actually
holds at that wave (natural level-ups, fresh account, boss alive-time during a real wave):

| | w5 | w10 | w15 | w20 | w25 | w30 | w35 | w40 | w45 |
|---|---|---|---|---|---|---|---|---|---|
| fresh account | 19s | 43s | 41s | 64s | 74s | 106s | 160s | 175s | **212s** |
| full lattice | 6s | 11s | 26s | 48s | 40s | 41s | 40s | 34s | 31s |

The fresh-account fight **diverges**; only the tech tree keeps up. The cause, fitted from
the same data: **`bossHp` grew as w^2.19 while natural player dps grows as w^1.15.** Two
curves that were never compared. Daniel's "HP sponge" was not a feeling, it was that gap.

There was already a tell. ADR-0008's own Decision 3 had to bolt on *"any future increase to
`BOSS_HP_SHARE` must re-check time-to-kill, not just the share."* **A lever that requires
manually checking a different quantity every time it moves is a proxy, not a control.**

## Decision 1 — boss HP is derived from a target fight length

```
bossHp(w) = max( bossTargetTtk(w) · referenceDps(w),   // the fight is an EVENT with a length
                 presenceFloor(w) )                     // …and never a rounding error
```

- `bossTargetTtk(w)` ramps **15s → target by wave 25**, then holds. The first boss stays
  short deliberately: it is the onboarding wall where ~45% of fresh runs end, so lengthening
  it moves the calibrate band. Sizing it in seconds *preserved* the band (median 8, in band)
  where a flat target would have wrecked it.
- `referenceDps(w) = 8.0 · w^1.15`, **fitted to measurement**, not derived — player power
  comes from level-ups, weapon ladders and build luck, none of which has a closed form. The
  reference account is the **fresh one playing naturally**, per Daniel's correction: a maxed
  loadout is not what anyone has at wave 20. A fitted constant rots when weapons change;
  `scripts/bosstime.mjs` exists to make it rot *loudly*.
- The **presence floor** is the surviving half of ADR-0008: `BOSS_HP_SHARE = 0.10` as a
  *floor*, not a definition, so a boss can never decay into one chunky elite among forty.
  It binds past roughly wave 55, where a fresh account's dps has plateaued and only tech can
  keep the fight bounded — which is the tech tree doing its job, and is recorded as the
  reason the floor exists rather than an accident.

## Decision 2 — the boss enters during the crunch

`composeWave` appended `'boss'` to the end of the spawn queue, so it arrived once the wave
had effectively been cleared: **a solo duel against an empty field, which is the opposite of
a focus-forcer** — there is nothing to be torn between. The boss now enters at
`BOSS_ENTRY = 0.33` of the queue, leaving two thirds of the wave still landing during the
fight. The guaranteed-debut index had to become a non-boss *position* rather than a count,
since it is an index into a list that no longer ends with the boss.

## Decision 3 — undelegatability is its own mechanism, not a side effect of HP

This is the load-bearing one, and it was forced by a measurement that broke the build.

Sizing the boss at 60s **broke the conductor gate outright**: hands worth **×1.000**, parked
deaths **1/11** — "the do-nothing run has become unkillable." The reason is worth stating
plainly, because it was invisible while HP was the lever: **Law·Delegation was being enforced
almost entirely by boss health bars.** Take the HP away and autos suffice.

So `BOSS_AUTO_RESIST = 0.5`: **delegated damage lands at half on a boss.** Aim, hold and
swipe all count as hands. This separates two concerns that were welded together —

- **HP says how long the fight is.**
- **Auto resistance says whether hands are required.**

— and it is why `bossHp` is now free to encode Daniel's design intent at all.

## Decision 4 — the target is 100s, and the gap to 60s is recorded, not hidden

Daniel asked for ~60s. **Measured, 60s is not currently reachable without abandoning
Law·Delegation.** The conductor, swept against the target (11 pairs, band ≥1.12):

| target | hands buy | parked deaths | verdict |
|--------|-----------|---------------|---------|
| 60s | ×1.109 | 5/7 | **fails** |
| 90s | ×1.125 | 8/11 | passes by 0.4% — a coin-flip margin, refused |
| **100s** | **×1.227** | **11/11** | **holds, ~10% margin** |
| 120s | ×3.046 | 7/7 | holds easily |

`BOSS_TTK_TARGET = 100` ships, **labelled in the source as a compromise** with 60 recorded as
the intent. Result: fresh-account boss events go from a 142s median (19→212s) to **104s
(14→134s)**; full lattice from 40s to 20s.

Note the jump between 90 and 120 — the same threshold shape ADR-0008 found at the 0.31 share:
somewhere in there the boss crosses from "the autos grind it down eventually" to "you must
point at it." That crossing is Law·Bosses, and it still has a number.

## Alternatives considered

1. **Keep the share, tune the constant.** Rejected by measurement: no constant works, because
   the share grows as w^2.19 and player dps as w^1.15. Any value is right at exactly one wave.
2. **Ship 60s and lower the conductor band.** Refused *as an assistant decision* — the band is
   a law's enforcement, and weakening a gate to make a change fit is how laws rot. It remains
   available to Daniel, and is the fastest route to his stated target.
3. **Boss auto-resistance alone, HP unchanged.** Tested: it restores parked *deaths* (4–5 of
   7) but not the *ratio* (×1.086–1.109), because the conductor's parked arm still carries an
   aimed bolt, so the gate measures aim accuracy rather than hands-vs-autos. Necessary, not
   sufficient.
4. **Target the geared account instead of the fresh one.** Rejected: a fresh account would
   then face ~300s bosses. The 5× dps spread between fresh and full-lattice means **no single
   HP curve gives 60s to both**, which is a lattice-power finding (ADR-0003 economy, still
   provisional) rather than a boss-HP one. Pinned.

## Consequences

- **`BOSS_HP_SHARE` still exists but means something different** — a presence floor, not the
  definition. Anyone reading ADR-0008 for its meaning will be wrong; that is why this ADR
  supersedes rather than edits.
- **The 60s target remains open, and the route to it is not more tuning.** It needs
  undelegatable pressure that is not a boss health bar — the successor lever ADR-0008 already
  named (modifiers, regen especially) and which is still unbuilt. Pinned with these numbers.
- Geared bosses are now **20s**, which is not a 60s event either. Whether the lattice should
  compress boss fights fivefold is a real question this ADR deliberately does not answer.
- `test/balance.test.mjs`'s share test was **rewritten and its drift clause loosened** — it
  asserted the share was near-constant, which the new formula legitimately violates. What
  survives is the property the original regression actually broke: no decay into the crowd.
