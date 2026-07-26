import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/core/balance.js';
import { ENEMIES, VARIANTS, WEAPONS } from '../src/core/config.js';
import { defaultMeta, newRun } from '../src/core/state.js';

test('enemyHpMult is 1 at wave 1 and strictly increasing', () => {
  assert.equal(B.enemyHpMult(1), 1);
  for (let w = 1; w < 50; w++) {
    assert.ok(B.enemyHpMult(w + 1) > B.enemyHpMult(w), `wave ${w}`);
  }
});

test('enemySpeedMult increases but is capped', () => {
  assert.ok(B.enemySpeedMult(2) > B.enemySpeedMult(1));
  for (let w = 1; w <= 200; w++) assert.ok(B.enemySpeedMult(w) <= 1.6);
});

test('waveBudget strictly increasing', () => {
  for (let w = 1; w < 60; w++) assert.ok(B.waveBudget(w + 1) > B.waveBudget(w));
});

test('spawnInterval bounded and non-increasing', () => {
  for (let w = 1; w < 60; w++) {
    const s = B.spawnInterval(w);
    assert.ok(s >= 0.22 && s <= 1.4, `wave ${w}: ${s}`);
    assert.ok(B.spawnInterval(w + 1) <= s);
  }
});

// DELETED 2026-07-26 (ADR-0015): 'xpForLevel is a positive-integer increasing
// curve'. The curve is gone — levels are granted per wave cleared, not bought with
// XP. Flagged as a LOOSENING (a case removed, not weakened); the replacement
// guarantee lives in test/state.test.mjs, which pins the exact level at every wave.
test('the opening draft is a small positive number of levels', () => {
  assert.ok(Number.isInteger(B.OPENING_LEVELS) && B.OPENING_LEVELS >= 1);
  assert.ok(B.OPENING_LEVELS <= 5, 'an opening draft bigger than the hand is a menu, not a choice');
});

// Daniel, playtesting 2026-07-26: "dial down triangle base hp so they die from a
// single bolt when introduced." They missed it by 0.03 HP — dart at wave 2 carried
// 17.03 effective HP against the bastion's opening bolt L2 at 17 damage, so the
// game's designated *fragile* shape needed two hits from the default gun on its
// debut wave. This is the repo's most repeated defect shape once more: an absolute
// number (base hp) sitting beside a scaling curve (enemyHpMult) with nothing
// keeping them in relation.
test('the fragile shape dies to one bolt on the wave it debuts', () => {
  const S = newRun(defaultMeta(), 'bastion'); // the free tower — a fresh account has no other
  const bolt = WEAPONS.bolt.stats(S.weapons.bolt);
  const dart = ENEMIES.dart;
  const hp = dart.hp * B.enemyHpMult(dart.minWave);
  assert.ok(hp <= bolt.dmg * S.dmgMult,
    `dart debuts with ${hp.toFixed(2)} hp against a ${bolt.dmg} bolt — two hits for the fragile one`);
});

test('the hp-bar gate stays meaningful as the HP curve climbs', () => {
  // the regression: an absolute `maxHp > 40` against a curve that multiplies every
  // enemy's HP — dead by wave 4, so every damaged shape carried a bar (app.md).
  // Same bug class as the pre-ADR-0008 bossHp and the pre-0009 boss variants.
  const hpOf = (id, w) => ENEMIES[id].hp * B.enemyHpMult(w);
  for (const w of [1, 4, 20, 40, 80]) {
    const t = B.hpBarThreshold(w);
    assert.ok(hpOf('grunt', w) < t, `chaff earns a bar at wave ${w} — the gate is dead again`);
    assert.ok(hpOf('dart', w) < t, `darts earn a bar at wave ${w}`);
    assert.ok(hpOf('tank', w) > t, `a tank should read as beefy at wave ${w}`);
    assert.ok(hpOf('elite', w) > t, `an elite should read as beefy at wave ${w}`);
  }
  // a variant that genuinely makes chaff tanky flips it — the rule working
  assert.ok(hpOf('grunt', 20) * VARIANTS.armored.hpMult > B.hpBarThreshold(20),
    'an armored grunt is beefy and should earn a bar');
});

// REWRITTEN 2026-07-25 (ADR-0012), and CALLED OUT as a loosening of the drift
// clause. This used to assert the boss share was near-CONSTANT (spread < 5%)
// because ADR-0008 defined bossHp as a fixed share. ADR-0012 sizes the boss in
// SECONDS instead, so the share is now an output and legitimately varies — the
// old assertion would forbid the fix. What survives is the property the original
// regression actually violated: the boss must never decay into the crowd.
test('a boss never decays into the crowd, at any depth', () => {
  // The regression this guards: bossHp linear against a quartic wave curve — 31%
  // of wave HP at wave 5, 4.9% by wave 45, Law·Bosses dissolving into one chunky
  // elite among forty-four. The presence FLOOR is what makes that impossible now.
  const share = w => B.bossHp(w) / (B.bossHp(w) + B.waveTrashHp(w));
  for (const w of [5, 10, 15, 20, 30, 40, 50, 60, 80, 120]) {
    const s = share(w);
    assert.ok(s >= B.BOSS_HP_SHARE - 0.001,
      `wave ${w}: boss is ${(100 * s).toFixed(1)}% of its wave, under the presence floor`);
    assert.ok(s < 0.45, `wave ${w}: boss is ${(100 * s).toFixed(1)}% of its wave — that is the wave`);
  }
});

test('a boss is sized in seconds, and the target ramps then holds', () => {
  // Daniel, 2026-07-25: "around 60s events as the default". The ramp is deliberate:
  // the first boss is short because it is the onboarding wall and ~45% of fresh
  // runs end there — lengthening it moves the calibrate band.
  assert.ok(B.bossTargetTtk(5) < B.BOSS_TTK_TARGET, 'the first boss must be shorter');
  assert.equal(B.bossTargetTtk(B.BOSS_TTK_WAVE), B.BOSS_TTK_TARGET);
  assert.equal(B.bossTargetTtk(120), B.BOSS_TTK_TARGET, 'and it holds, rather than growing');
  // monotone: no wave should be a shorter designed fight than an earlier one
  for (let w = 5; w < 60; w += 5) {
    assert.ok(B.bossTargetTtk(w + 5) >= B.bossTargetTtk(w), `target dipped at wave ${w + 5}`);
  }
});

test('bossHp grows across boss waves', () => {
  assert.ok(B.bossHp(10) > B.bossHp(5));
  assert.ok(B.bossHp(15) > B.bossHp(10));
});

test('enemyMass: 1 at spawn, grows with age, caps at 3', () => {
  assert.equal(B.enemyMass(0), 1);
  assert.ok(B.enemyMass(10) > B.enemyMass(1));
  for (const a of [30, 60, 500]) assert.ok(B.enemyMass(a) <= 3);
  assert.ok(Math.abs(B.enemyMass(60) - 3) < 1e-9);
});

test('shardPayout: losing always buys something, and deeper runs pay more', () => {
  assert.ok(B.shardPayout(0, 0, 0) >= 1);
  assert.ok(B.shardPayout(1, 0, 0) >= 1);
  assert.ok(B.shardPayout(10, 100, 2) > B.shardPayout(3, 20, 0));
  // superlinear in wave (ADR-0003: deep lattice rings need deep runs to pay)
  const w10 = B.shardPayout(10, 0, 0), w20 = B.shardPayout(20, 0, 0), w30 = B.shardPayout(30, 0, 0);
  assert.ok(w30 - w20 > w20 - w10, 'payout must accelerate with wave');
});

test('variantChance: none before wave 6, capped at 0.35, non-decreasing', () => {
  for (let w = 1; w <= 5; w++) assert.equal(B.variantChance(w), 0);
  for (let w = 1; w <= 100; w++) {
    assert.ok(B.variantChance(w) <= 0.35);
    assert.ok(B.variantChance(w + 1) >= B.variantChance(w));
  }
  assert.ok(B.variantChance(10) > 0);
});

// The early ramp was raised 2026-07-26 (Daniel: the wave-5 noble had "too little HP
// to be meaningful", wave 10 wanted "10-15% extra"). Raising the ramp's FLOOR is the
// whole change — the complaint was about the shape of the early curve, not about two
// waves, and the mid/late curve nobody complained about must stay put.
// ADR-0020. The three laws the orbit ladder broke, one test each. All three are
// about the same defect — a fixed blade beside a growing ring — seen from the
// player's side, the designer's side and the neighbouring weapon's side.
test('every orbit level grants something a player can name', () => {
  const st = l => WEAPONS.orbit.stats(l);
  for (let l = 2; l <= WEAPONS.orbit.max; l++) {
    const a = st(l - 1), b = st(l);
    assert.ok(b.n > a.n || b.outer > a.outer,
      `L${l} grants no blade and no reach — the +damage tick is not an upgrade, it is a rounding error`);
    assert.ok(b.dmg > a.dmg, `L${l} does not even tick damage`);
  }
});

test('the blades are rooted at a fixed radius and grow outward from it', () => {
  // ADR-0022 replaces ADR-0020's constant-ring law with the same idea one level up:
  // what must not drift is where the blades are ROOTED. Levelling extends the tip.
  // Daniel's complaint — "I don't like that we keep increasing the radius per
  // default" — is answered by the root holding still, not the whole weapon.
  const st = l => WEAPONS.orbit.stats(l);
  for (let l = 2; l <= WEAPONS.orbit.max; l++) {
    assert.equal(st(l).inner, st(1).inner,
      `L${l} moved the blade root — that is the ring drifting outward under a new name`);
    assert.ok(st(l).outer > st(l - 1).outer, `L${l} reaches no further than L${l - 1}`);
  }
});

// LOOSENED 2026-07-26 at Daniel's call: the hub-gap assertion
// (`inner - reach > 60`) is DELETED, not weakened. ADR-0022 argued a gap kept the
// weapon from swallowing the tower; Daniel asked for the blades mounted on the
// Point instead — "attaching them physically" — and a rule cannot outrank the
// design authority who set it. The replacement guarantee is in render.test.mjs,
// which now pins the roots INSIDE the hull rather than clear of it. The
// screen-width half of the old test survives here unchanged.
test('the blades stay on a phone screen', () => {
  // Reaching past a 430px screen's half-width puts the tips off-canvas at the
  // sides, paying fill rate for blade that bites nothing the player can see. The
  // pre-ADR-0022 218px ring was doing exactly that and nobody had noticed.
  for (let l = 1; l <= WEAPONS.orbit.max; l++) {
    const s = WEAPONS.orbit.stats(l);
    assert.ok(s.outer + s.reach < 215, `L${l} reaches ${s.outer}, past a phone's half-width`);
  }
});

test('the blades stay inside the frost aura at every level of both weapons', () => {
  // Daniel, 2026-07-26: "taking it out of the slow aura is a huge nerf actually."
  // The weakest aura is frost L1; the blade's root must still sit inside it, or the
  // grind-and-slow pair expires exactly when both are most invested in.
  const aura = WEAPONS.frost.stats(1).radius;
  for (let l = 1; l <= WEAPONS.orbit.max; l++) {
    const s = WEAPONS.orbit.stats(l);
    assert.ok(s.inner - s.reach <= aura,
      `orbit L${l} roots at ${s.inner - s.reach}, outside the frost L1 aura at ${aura}`);
  }
});

test('raising the early ramp lifts waves 5 and 10 and leaves the late curve alone', () => {
  const ttk = B.bossTargetTtk;
  assert.ok(ttk(5) >= 20, `the first boss is ${ttk(5)}s — too short to be meaningful`);
  // wave 10 sits inside the band Daniel asked for, measured against the old floor of 15
  const oldAt = w => 15 + (B.BOSS_TTK_TARGET - 15) * Math.min(1, Math.max(0, (w - 5) / 20));
  const lift = w => ttk(w) / oldAt(w) - 1;
  assert.ok(lift(10) >= 0.10 && lift(10) <= 0.15,
    `wave 10 moved ${(lift(10) * 100).toFixed(1)}%, outside the requested 10-15%`);
  assert.ok(lift(20) < 0.05, `wave 20 moved ${(lift(20) * 100).toFixed(1)}% — the late curve should barely notice`);
  assert.equal(ttk(30), B.BOSS_TTK_TARGET, 'and past the ramp nothing changed at all');
});
