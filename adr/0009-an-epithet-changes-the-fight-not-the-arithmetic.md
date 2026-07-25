# ADR-0009: An epithet changes the fight, not the arithmetic

**Status:** ACCEPTED 2026-07-25 (Zephyr, same overnight session as ADR-0008; measured.
Daniel is the design authority on the feel — the numbers below are the receipts.)

**Resolves:** the "Boss variants inherit trash multipliers, unspec'd" pin, open since the
2026-07-25 audit. **Follows:** ADR-0008, which made the question urgent.

## Context

From boss #8 (wave 40) the name roster recirculates and every returning noble carries a
**guaranteed** variant, worn as an epithet — *"SIR CUMFERENCE, THE ARMORED"*. `enemies.js`
applied the ordinary trash multipliers to it unconditionally. Neither the GDD nor `core.md`
said whether it should; the pin recorded that "trash multipliers, deliberately" was a fine
answer written down and a bad one assumed.

ADR-0008 turned this from a curiosity into a defect. Once `bossHp` became **a share of the
whole wave's HP**, the trash *percentages* began compounding against a curve they were never
sized for.

## The measurement

Against a maxed budget-legal build with the field otherwise **empty** — the most generous
case a player ever gets — at wave 40 (`bossHp` 117,375):

| epithet | trash rule | boss %-killed when the player died |
|---------|-----------|-------------------------------------|
| plain | — | 18% |
| armored | ×2.5 hp → 293,436 | 7% |
| **regen** | **3%/s → 3,521 hp/s** | **0% — mathematically unkillable** |

The regen row is the defect. A boss healing 3% of a wave-share pool per second outheals a
maxed build's sustained damage outright, and the wave director will not advance until the
field is empty (`game.js`, phase `clear`). The reward for reaching wave 40 was a
one-in-five chance of an unwinnable dead end.

## Decision — bosses use a per-variant `boss` override, never the trash multipliers

`VARIANTS[id].boss` is merged over the trash definition at spawn time for bosses only.

| variant | trash | boss | rationale |
|---------|-------|------|-----------|
| swift | ×1.7 speed | ×1.35 | the reaction window is the real resource; a faster ram is already the scariest gain |
| armored | ×2.5 hp | ×1.35 | multiplies a pool that is already 31% of the wave — the epithet must not mean "wait longer" |
| regen | 3%/s | **0.5%/s** | the only variant that can make a boss *unkillable* rather than merely long; a DPS check, not a wall |
| shielded | 3 hits | 12 hits | a boss eats hits continuously — 3 charges are invisible on it |
| volatile | burst r70, heals 30% | unchanged | the burst heals nearby shapes by *their own* max hp, so it never scaled with the boss, and a noble dying into a crowd-heal is exactly the tactical event an epithet should be |

**The principle, which governs every future boss variant:** an epithet must change *how the
fight goes*, not *how much arithmetic it contains*. A modifier that only multiplies a number
already sized as a share of the wave is not difficulty, it is duration — and past some
multiple it stops being a fight at all.

## Validation, and what it says about ADR-0008's share

The same spike, run for a **fully-invested account** (every lattice node) — the audience wave
40+ is actually aimed at:

| | wave 40 | wave 50 |
|---|---------|---------|
| plain | killed in 26.5s | killed in 45.5s |
| armored | killed in 34.6s | player died at 52s, boss 86% dead |
| regen | killed in 29.8s | player died at 52s, boss 90% dead |

A 26–35 second boss fight at wave 40 and a knife-edge loss at wave 50 is a coherent curve,
and it independently supports ADR-0008's `BOSS_HP_SHARE = 0.31`. It also shows the meta layer
has real teeth: the identical build with **no tech** cannot dent any of these bosses (8–18%
at wave 40, 0–9% at wave 50). That gap is the lattice justifying its own existence, which is
GDD §6's whole claim.

*Caveat, stated because the spike is generous:* these fights are measured with **no trash on
the field**. A real wave-40 boss arrives alongside ~200 bodies, so live fights are harder than
the table. The numbers bound the boss in isolation; they do not predict the wave.

## Alternatives considered

1. **Keep trash multipliers, raise player power to compensate.** Rejected: it fixes one
   number by inflating every other fight, and the regen case is unkillable at *any* player
   power that the curve can reach — 3%/s of a growing pool outruns linear DPS growth forever.
2. **Give bosses no variants at all.** Rejected: recirculating epithets are GDD §5's named
   wave-40 regime change and the lategame's escalation story. The problem was the numbers,
   not the idea.
3. **Cap boss regen as a flat HP/s rather than a percentage.** Tempting and simpler to reason
   about, but it would make the epithet meaningless at depth as pools grow. A small percentage
   keeps the modifier scaling with the fight while staying beatable — the same reason the boss
   HP itself is a share rather than a constant.

## Consequences

- Boss epithets are now survivable at every wave a geared account can reach, and the guard is
  at the test tier: `test/epithets.test.mjs` pins that a near-dead regen boss actually dies
  under sustained fire, so the unkillable case cannot silently return.
- **Not addressed:** at wave 50 a no-tech build still cannot kill *any* boss, plain included.
  That is the boss share meeting an ungeared build, not a variant problem — and it is
  arguably correct (the lattice is supposed to matter). Flagged for playtest rather than
  tuned, because it is a feel call.
- The `boss` override slot is now the place any future boss-specific tuning lands, including
  the signature-move work the "Boss behaviors beyond the ram" pin describes.
