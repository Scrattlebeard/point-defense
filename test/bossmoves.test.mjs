// Boss signature moves (core.md Enemies "Boss signature moves"). Law·Bosses says
// a boss is a focus-forcer; a threat that only rams differs from the last one by
// an HP number. Decisions live in the BOSS_MOVES table, execution in the shell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_MOVES, BOSS_NAMES } from '../src/core/config.js';
import { defaultMeta, newRun } from '../src/core/state.js';
import { makeFx } from '../src/app/fx.js';
import { resetWeapons } from '../src/app/weapons/index.js';
import { resetWaveDirector, updateGame } from '../src/app/game.js';
import { spawnEnemy, damageEnemy } from '../src/app/enemies.js';
import { dist } from '../src/core/geom.js';
import { seedRandom } from './seed.mjs';

function makeG(wave) {
  seedRandom(); // deterministic sim (test/seed.mjs)
  const meta = defaultMeta();
  const G = { W: 430, H: 900, cx: 215, cy: 450, S: newRun(meta, 'bastion'), fx: makeFx(), meta };
  resetWeapons(G);
  resetWaveDirector(G);
  G.S.weapons.bolt = 0;   // nothing shoots back; the boss is the subject
  G.wd.phase = 'clear';   // no wave traffic
  G.S.wave = wave;
  G.S.maxHp = G.S.hp = 1e9; // the player is not the subject
  return G;
}
const step = (G, secs) => { for (let i = 0; i < secs * 60; i++) updateGame(G, 1 / 60); };

const bossOf = G => G.S.enemies.find(e => e.kind === 'boss' && !e.dead);

function spawnBossWithMove(wave, name) {
  const G = makeG(wave);
  spawnEnemy(G, 'boss');
  const b = bossOf(G);
  b.moveId = BOSS_MOVES[name].id;
  return { G, b };
}

// STRENGTHENED 2026-07-25 (called out per CLAUDE.md review protocol). This used to
// assert moves were the MINORITY — a placeholder guard keeping the unbuilt ones
// honestly unbuilt. The roster is complete now, so the honest assertion is the
// design law itself: Law·Bosses says a boss is a focus-forcer, so a NAME without a
// move is a difficulty step wearing a character's clothes.
test('every noble carries a signature move, and every move names a real boss', () => {
  for (const name of Object.keys(BOSS_MOVES)) {
    assert.ok(BOSS_NAMES.includes(name), `${name} is not a boss`);
  }
  for (const name of BOSS_NAMES) {
    assert.ok(BOSS_MOVES[name], `${name} has no signature move — it is an HP number with a title`);
  }
});

// Each move must pose a DIFFERENT question. Seven nobles with seven flavours of
// "an attack happens" is a difficulty curve with names on it (core.md table).
test('no two nobles share a move', () => {
  const ids = BOSS_NAMES.map(n => BOSS_MOVES[n].id);
  assert.equal(new Set(ids).size, ids.length, `duplicate dilemmas: ${ids.join(', ')}`);
});

test('charge: Lord Rhombus telegraphs, THEN crosses — a charge you cannot see is a dice roll', () => {
  const { G, b } = spawnBossWithMove(10, 'LORD RHOMBUS');
  const mv = BOSS_MOVES['LORD RHOMBUS'];
  const startD = dist(b.x, b.y, G.cx, G.cy);

  // the wind-up: the boss must STOP, and be marked, before anything fast happens
  let sawTell = false, movedDuringTell = false;
  // +1s of slack: the cycle resolves on the very last frame of its own budget,
  // and a test sized exactly to the thing it measures fails for arithmetic
  // reasons rather than behavioural ones.
  for (let i = 0; i < 60 * (mv.every + mv.tell + 1); i++) {
    const d0 = dist(b.x, b.y, G.cx, G.cy);
    updateGame(G, 1 / 60);
    if (b.winding) {
      sawTell = true;
      if (dist(b.x, b.y, G.cx, G.cy) < d0 - 0.01) movedDuringTell = true;
    }
    if (b.charging) break;
  }
  assert.ok(sawTell, 'the charge never telegraphed');
  assert.ok(!movedDuringTell, 'the boss advanced during its own wind-up — the tell must cost it tempo');
  assert.ok(b.charging, 'the wind-up never resolved into a charge');

  // and the charge itself must actually be fast
  const dBefore = dist(b.x, b.y, G.cx, G.cy);
  step(G, 0.5);
  const closed = dBefore - dist(b.x, b.y, G.cx, G.cy);
  assert.ok(closed > b.baseSpd * 0.5 * 2,
    `charging boss closed ${closed.toFixed(0)}px in 0.5s — barely faster than walking`);
  assert.ok(startD > 0);
});

test('study: Grandmaster Hexley hardens under sustained fire and forgets when you stop', () => {
  const { G, b } = spawnBossWithMove(20, 'GRANDMASTER HEXLEY');
  const mv = BOSS_MOVES['GRANDMASTER HEXLEY'];
  b.spd = 0;
  const chip = () => damageEnemy(G, b, 1, { noMult: true, src: 'bolt' });

  b.hp = b.maxHp = 1e9; // the boss is the subject, not its health bar
  for (let i = 0; i < 60 * 3; i++) { chip(); updateGame(G, 1 / 60); }
  const hardened = b.guard;
  assert.ok(hardened < 1, `three seconds of sustained fire did not harden it (guard ${hardened})`);
  assert.ok(hardened >= mv.floor, `guard fell through its floor (${hardened} < ${mv.floor})`);

  // stop hitting it: it forgets
  step(G, mv.forget + 0.5);
  assert.equal(b.guard, 1, 'it never forgot — the dilemma is rhythm, not a permanent tax');
});

test('study reads attention, not damage: autos never feed the clock', () => {
  // The load-bearing rule (core.md). Without it the clock never resets in any run
  // fielding a single auto, the boss sits at its floor forever, and the "let it
  // forget" half of the dilemma is unreachable — a flat tax wearing a move's name.
  const { G, b } = spawnBossWithMove(20, 'GRANDMASTER HEXLEY');
  b.spd = 0;
  b.hp = b.maxHp = 1e9;

  // an auto grinding away at it, forever
  for (let i = 0; i < 60 * 4; i++) {
    damageEnemy(G, b, 1, { noMult: true, src: 'turret' });
    updateGame(G, 1 / 60);
  }
  assert.equal(b.guard, 1, 'auto fire hardened it — the study clock must ignore delegated damage');

  // the same grind, by hand
  for (let i = 0; i < 60 * 4; i++) {
    damageEnemy(G, b, 1, { noMult: true, src: 'bolt' });
    updateGame(G, 1 / 60);
  }
  assert.ok(b.guard < 1, 'hand fire did not harden it');
});

test('study counts every hand, not just the gun — hold and swipe are attention too', () => {
  for (const src of ['beam', 'blades']) {
    const { G, b } = spawnBossWithMove(20, 'GRANDMASTER HEXLEY');
    b.spd = 0;
    b.hp = b.maxHp = 1e9;
    for (let i = 0; i < 60 * 3; i++) {
      damageEnemy(G, b, 1, { noMult: true, src });
      updateGame(G, 1 / 60);
    }
    assert.ok(b.guard < 1, `${src} is a hand and must feed the study clock`);
  }
});

// The guard ADR-0009 wrote for epithets, extended to moves — `study` is exactly
// the shape that produced the original bug: a boss whose effective HP multiplies
// while the wave director refuses to advance until the field is empty. A guard
// floor is an HP multiplier wearing a verb.
//
// Measured as a RATIO against a moveless control, deliberately. The first draft of
// this test asserted "dead within 45 seconds" — an absolute threshold sitting next
// to a scaling curve, which is the single most repeated defect in this codebase
// (bossHp linear vs quartic, boss variants vs a wave-share pool, the hp-bar gate at
// maxHp > 40). Time-to-kill here is dominated by how much tech the rig has, so
// seconds are meaningless and the multiplier is the whole finding.
const TTK_CEILING = 2.2;

function timeToKill(moveId) {
  const G = makeG(40);
  for (const [id, l] of Object.entries({ bolt: 6, orbit: 5, nova: 5, frost: 5, tesla: 5, turret: 5 })) {
    G.S.weapons[id] = l; G.S.pool.add(id);
  }
  resetWeapons(G);
  const boss = spawnEnemy(G, 'boss', 'armored'); // the tankiest epithet
  boss.moveId = moveId;
  // 15%, and the fraction is load-bearing: `study` ramps in over ~4s, so a fight
  // short enough to end during the ramp dilutes the very thing being measured.
  // At 8% this test passed at EVERY floor including the broken one — it was
  // theatre until the start point was measured rather than guessed.
  boss.hp = boss.maxHp * 0.15;  // a scale, not a bar: both arms start here
  G.S.hp = G.S.maxHp = 1e9;     // the player is not the subject
  let t = 0;
  for (let i = 0; i < 60 * 240 && !boss.dead; i++) {
    G.aim = { x: boss.x, y: boss.y }; // focused fire, every frame
    updateGame(G, 1 / 60);
    t += 1 / 60;
  }
  return boss.dead ? t : Infinity;
}

test('no signature move makes a boss unkillable, even wearing an epithet', () => {
  const control = timeToKill(null);
  assert.ok(Number.isFinite(control), 'the control boss must die, or this test proves nothing');
  for (const name of BOSS_NAMES) {
    const t = timeToKill(BOSS_MOVES[name].id);
    const ratio = t / control;
    assert.ok(ratio <= TTK_CEILING,
      `${name} (${BOSS_MOVES[name].id}, armored) multiplies time-to-kill ×${ratio.toFixed(2)} ` +
      `under focused fire (ceiling ×${TTK_CEILING}). Past double, a punishment for playing ` +
      `badly stops reading as a dilemma and starts reading as a boss that does not work — ` +
      `and the wave director never advances while it lives.`);
  }
});

test('study is the mirror of surge: chip-and-rotate beats commitment, and vice versa', () => {
  // The design claim in core.md, made checkable: the two nobles must reward
  // opposite play. Surge punishes NOT committing; study punishes committing.
  assert.equal(BOSS_MOVES['THE OBTUSE ONE'].id, 'surge');
  assert.equal(BOSS_MOVES['GRANDMASTER HEXLEY'].id, 'study');
  assert.ok(BOSS_MOVES['GRANDMASTER HEXLEY'].floor > 0,
    'a study boss must stay killable by sustained fire — it is a tax, not a wall');
});

test('devour: Polygothra eats its escort and grows, so the chaff is the fight', () => {
  const { G, b } = spawnBossWithMove(25, 'POLYGOTHRA, DEVOURER OF VERTICES');
  const mv = BOSS_MOVES['POLYGOTHRA, DEVOURER OF VERTICES'];
  b.spd = 0;
  b.hp = b.maxHp * 0.5;
  const hp0 = b.hp;

  // an escort well inside its reach
  spawnEnemy(G, 'dart', null, b.x + mv.range * 0.4, b.y);
  const meal = G.S.enemies[G.S.enemies.length - 1];
  meal.spd = 0;

  step(G, mv.every + 0.5);
  assert.ok(!G.S.enemies.includes(meal), 'the escort was not eaten');
  assert.ok(b.hp > hp0, `devouring did not heal it (${hp0} → ${b.hp})`);
});

test('devour cannot reach past its range, and never eats another boss', () => {
  const { G, b } = spawnBossWithMove(25, 'POLYGOTHRA, DEVOURER OF VERTICES');
  const mv = BOSS_MOVES['POLYGOTHRA, DEVOURER OF VERTICES'];
  b.spd = 0;
  b.hp = b.maxHp * 0.5;
  const hp0 = b.hp;
  spawnEnemy(G, 'dart', null, b.x + mv.range * 2, b.y); // out of reach
  const far = G.S.enemies[G.S.enemies.length - 1];
  far.spd = 0;
  step(G, mv.every + 0.5);
  assert.ok(G.S.enemies.includes(far), 'it ate a shape outside its range');
  assert.equal(b.hp, hp0, 'and healed anyway');
});

test('Sir Cumference shakes adds out of his sides (GDD §3, verbatim)', () => {
  const G = makeG(40);            // recirculated: moves are live
  const boss = spawnEnemy(G, 'boss', null);
  boss.moveId = 'adds';
  boss.spd = 0;
  const before = G.S.enemies.length;
  step(G, 8);
  const after = G.S.enemies.filter(e => !e.dead).length;
  assert.ok(after > before, `no adds spawned (${before} → ${after})`);
});

test('The Obtuse One surges when wounded — a hurt boss is a faster boss', () => {
  const G = makeG(40);
  const boss = spawnEnemy(G, 'boss', null);
  boss.moveId = 'surge';
  const healthy = boss.spd;
  step(G, 0.5);
  assert.ok(Math.abs(boss.spd - healthy) < 1, 'a healthy boss must not be surging');
  boss.hp = boss.maxHp * 0.2;     // below the threshold
  step(G, 0.5);
  assert.ok(boss.spd > healthy * 1.3, `wounded boss did not surge (${healthy} → ${boss.spd})`);
});

test('the wave-5 noble stays a clean ram — one thing at a time', () => {
  // A PACING choice, not a balance one: measured, moves from the first appearance
  // leave the fresh-run median at 8, in band. The first boss fight teaches what a
  // boss IS; every one after it teaches what a boss can DO.
  const G = makeG(5);
  const boss = spawnEnemy(G, 'boss', null);
  boss.spd = 0;
  const before = G.S.enemies.length;
  step(G, 10);
  assert.equal(G.S.enemies.filter(e => !e.dead).length, before,
    'the first boss spawned adds — signature moves start at wave 10');
});

// 2026-07-25, Daniel's first playtest: waves 30 and 35 are bossIdx 5 and 6 —
// Marquis de Sides and The Final Vertex, the two names furthest down the unbuilt
// list. "A single boss attack racing against their hp bar" was a correct report
// of a structural gap, not a tuning complaint.
test('the two bosses Daniel fought at waves 30 and 35 now have moves', () => {
  // The mapping is the finding: bossIdx = wave/5 - 1, and both were ram-only.
  assert.equal(BOSS_NAMES[5], 'MARQUIS DE SIDES');
  assert.equal(BOSS_NAMES[6], 'THE FINAL VERTEX');
  assert.ok(BOSS_MOVES['MARQUIS DE SIDES'], 'wave 30 boss has a move');
  assert.ok(BOSS_MOVES['THE FINAL VERTEX'], 'wave 35 boss has a move');
});

test('sunder: shards appear at the threshold and the boss is guarded while they live', () => {
  const { G, b } = spawnBossWithMove(30, 'MARQUIS DE SIDES');
  const before = G.S.enemies.length;
  step(G, 1);
  assert.equal(b.guard ?? 1, 1, 'unwounded boss takes full damage');
  assert.equal(G.S.enemies.length, before, 'and has not shed anything yet');

  b.hp = b.maxHp * 0.5; // cross the threshold
  step(G, 0.5);
  const shards = G.S.enemies.filter(e => e.wardOf === b.wardToken && !e.dead);
  assert.ok(shards.length > 0, 'crossing 55% sheds shards');
  assert.ok(b.guard < 1, 'and the boss is guarded while they live');

  for (const s of shards) s.dead = true;
  step(G, 0.5);
  assert.equal(b.guard, 1, 'clearing the shards re-opens the boss');
});

test('sunder fires once, not every time the boss dips', () => {
  const { G, b } = spawnBossWithMove(30, 'MARQUIS DE SIDES');
  b.hp = b.maxHp * 0.5;
  step(G, 0.5);
  const n = G.S.enemies.filter(e => e.wardOf === b.wardToken).length;
  for (const e of G.S.enemies) if (e.wardOf === b.wardToken) e.dead = true;
  b.hp = b.maxHp * 0.2;
  step(G, 2);
  const again = G.S.enemies.filter(e => e.wardOf === b.wardToken && !e.dead).length;
  assert.equal(again, 0, `sunder must not re-trigger (shed ${n} once)`);
});

test('bulwark: the boss cycles between open and planted, and stops while planted', () => {
  const { G, b } = spawnBossWithMove(35, 'THE FINAL VERTEX');
  const seen = new Set();
  let stoppedWhileGuarded = true;
  for (let i = 0; i < 60 * 25; i++) {
    updateGame(G, 1 / 60);
    if (b.dead) break;
    const guarded = (b.guard ?? 1) < 1;
    seen.add(guarded);
    if (guarded && b.spd !== 0) stoppedWhileGuarded = false;
  }
  assert.ok(seen.has(true), 'it plants at some point');
  assert.ok(seen.has(false), 'and it re-opens — the window is not permanent');
  assert.ok(stoppedWhileGuarded, 'a planted boss does not advance: the window is a trade, not a punishment');
});

test('a guarded boss takes reduced damage, and the ledger records what landed', () => {
  const { G, b } = spawnBossWithMove(35, 'THE FINAL VERTEX');
  b.guard = 0.25;
  const hp0 = b.hp;
  const dealt = damageEnemy(G, b, 1000, { noMult: true, src: 'bolt' });
  assert.ok(dealt < 1000, 'the guard bites');
  assert.equal(Math.round(hp0 - b.hp), Math.round(dealt), 'hp lost equals damage reported');
  assert.equal(Math.round(G.S.dmgBy.bolt), Math.round(dealt),
    'attribution records the damage actually dealt, not the damage attempted');
});

// ---- the charge is interruptible (core.md, Daniel's design, 2026-07-26) ----
// "Level 10 was brutal on a fresh account. I think we need some counterplay on the
// boss-charge-rush-thing. A charge up where it can be delayed by damage, like a
// timer that ticks up but gets reduced by damage taken, brief stun if you get it
// to zero."

const CH = BOSS_MOVES['LORD RHOMBUS'];

/** Run until the boss starts winding up, then return the rig mid-wind. */
function windingRhombus(wave = 10) {
  const { G, b } = spawnBossWithMove(wave, 'LORD RHOMBUS');
  b.spd = 0;
  for (let i = 0; i < 60 * (CH.every + CH.tell + 2) && !b.winding; i++) updateGame(G, 1 / 60);
  assert.ok(b.winding, 'setup: the boss never entered its wind-up');
  return { G, b };
}

test('damage pushes the wind-up back — shooting it is doing something', () => {
  const { G, b } = windingRhombus();
  const before = b.moveT;   // seconds remaining until the charge fires
  damageEnemy(G, b, b.maxHp * CH.interruptFrac * 0.4, { noMult: true, src: 'bolt' });
  assert.ok(b.moveT > before + 0.1,
    `charge is still ${b.moveT.toFixed(2)}s away vs ${before.toFixed(2)}s before a 40% ` +
    'interrupt hit — damage must visibly push the charge back, or there is nothing to see');
  assert.ok(b.winding, 'a partial interrupt must not cancel the charge');
});

test('emptying the timer staggers the boss instead of charging it', () => {
  const { G, b } = windingRhombus();
  damageEnemy(G, b, b.maxHp * CH.interruptFrac * 1.2, { noMult: true, src: 'bolt' });
  assert.ok(!b.winding, 'the wind-up survived a full interrupt');
  assert.ok(!b.charging, 'the boss charged anyway — the interrupt bought nothing');
  assert.ok(b.stun > 0, 'no stagger');

  // and the stagger is real: it does not advance while stunned
  b.spd = 100;
  const d0 = dist(b.x, b.y, G.cx, G.cy);
  step(G, CH.stun * 0.5);
  assert.ok(Math.abs(dist(b.x, b.y, G.cx, G.cy) - d0) < 1, 'a staggered boss kept walking');
});

test('the stagger ends, and the boss goes back to work', () => {
  const { G, b } = windingRhombus();
  damageEnemy(G, b, b.maxHp * CH.interruptFrac * 1.2, { noMult: true, src: 'bolt' });
  step(G, CH.stun + 0.5);
  assert.equal(b.stun, 0, 'the stagger never ended — that is a permanent lock, not counterplay');
  assert.ok(b.spd > 0, 'the boss never resumed moving');
  // and it must not chain straight back into a wind-up: the full cycle restarts,
  // or an interrupt just buys the stagger and hands the charge straight back
  assert.ok(!b.winding, 'the boss re-entered its wind-up the moment the stagger ended');
  assert.ok(b.moveT > CH.tell, `next charge is only ${b.moveT.toFixed(2)}s away`);
});

// The threshold must SCALE. An absolute damage number beside a growing HP curve is
// this codebase's most repeated defect (bossHp linear vs quartic; boss variants vs
// a wave-share pool; the hp-bar gate at maxHp > 40).
test('the interrupt costs the same SHARE of the boss at every depth', () => {
  const share = wave => {
    const { G, b } = windingRhombus(wave);
    let dealt = 0;
    while (b.winding && dealt < b.maxHp) {
      damageEnemy(G, b, b.maxHp * 0.01, { noMult: true, src: 'bolt' });
      dealt += b.maxHp * 0.01;
    }
    return dealt / b.maxHp;
  };
  const early = share(10), late = share(40);
  assert.ok(Math.abs(early - late) < 0.02,
    `interrupt costs ${(early * 100).toFixed(0)}% of the boss at wave 10 but ` +
    `${(late * 100).toFixed(0)}% at wave 40 — it must be a share, not a number`);
});

// LOOSENED 2026-07-26 (ADR-0013), called out per the review protocol. This used to
// assert that autos paid DOUBLE to interrupt, which was true only because
// BOSS_AUTO_RESIST halved delegated damage. That multiplier is gone, so the cost
// ratio it pinned no longer exists. What survives is the design decision that
// still holds: the interrupt is deliberately NOT hands-only (unlike `study`),
// because a hands-only interrupt would make the move harder — the opposite of the
// problem it was built to fix. The focus bias is now purely emergent: what aiming
// buys you is concentrating damage inside a ~1.1s window, not a damage-class rule.
test('autos can interrupt: this exists to make a fresh wave 10 survivable', () => {
  const { G, b } = windingRhombus();
  damageEnemy(G, b, b.maxHp * CH.interruptFrac * 1.2, { noMult: true, src: 'turret' });
  assert.ok(!b.winding && b.stun > 0, 'delegated damage must be able to interrupt');
});

test('no weapon class is secretly taxed on a boss (ADR-0013)', () => {
  // The regression guard for the removed hidden multiplier. Identical raw damage
  // from an auto and from a hand must remove identical HP — anything else is a
  // rule the player cannot see and, worse, one that corrupts every balance
  // measurement taken through it.
  const hit = src => {
    const { G, b } = spawnBossWithMove(20, 'LORD RHOMBUS');
    b.winding = false; b.stun = 0;
    const hp0 = b.hp;
    damageEnemy(G, b, 1000, { noMult: true, src });
    return hp0 - b.hp;
  };
  assert.equal(Math.round(hit('turret')), Math.round(hit('bolt')),
    'an auto and a hand dealt different damage for the same raw number');
  assert.equal(Math.round(hit('beam')), Math.round(hit('bolt')),
    'hold and aim must also agree — no weapon class carries a hidden coefficient');
});

test('an uninterrupted charge still fires — the move was not defanged', () => {
  const { G, b } = windingRhombus();
  step(G, CH.tell + 0.2);
  assert.ok(b.charging, 'nobody shot it and it still failed to charge');
});

// Tripled 2026-07-26. Daniel: "the charge-up is too quick, there's very little time
// to react if you're not already on the boss." Tripling the window AND the threshold
// together is the point — it holds the damage-per-second the interrupt demands
// roughly constant while tripling the time available to notice, decide and turn.
test('the wind-up is long enough to turn around in', () => {
  assert.ok(CH.tell >= 3, `a ${CH.tell}s window is a check on where your cursor already was`);
});

test('tripling the window did not make the interrupt cheaper per second', () => {
  // If the threshold had stayed put, a 3x longer window would have made interrupting
  // nearly automatic — the move would be gone rather than answerable.
  const dpsDemand = CH.interruptFrac / CH.tell;   // share of boss hp per second
  assert.ok(dpsDemand > 0.025 && dpsDemand < 0.038,
    `interrupt demands ${(dpsDemand * 100).toFixed(1)}% of boss hp per second — ` +
    'tripling the window without the threshold makes the charge a formality');
});
