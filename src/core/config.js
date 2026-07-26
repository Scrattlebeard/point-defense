// All content tables. This file is the single home of tuning data (core.md carries
// the intent); balance *curves* live in balance.js. No logic beyond stat formulas.

// ---------- Enemies ----------
// sides: 0 = circle. Contact with the Point deals dmg and the enemy dies (kamikaze);
// the boss rams, knocks back, returns.
export const ENEMIES = {
  grunt:    { name: 'Circle Grunt',    sides: 0, hp: 16,  spd: 44, r: 12, dmg: 8,  cost: 1,   minWave: 1,  color: '#ff5c6c', intro: 'slow and direct', lore: 'A circle with commitment issues — it commits to exactly one direction.' },
  dart:     { name: 'Triangle Dart',     sides: 3, hp: 9,  spd: 96, r: 10, dmg: 6,  cost: 1.5, minWave: 2,  color: '#ffb84d', intro: 'fast and fragile', lore: 'An acute problem. Arrives fast, leaves faster.' },
  tank:     { name: 'Square Tank',     sides: 4, hp: 60,  spd: 29, r: 15, dmg: 16,  cost: 3,   minWave: 4,  color: '#c06bff', intro: 'slow, heavily built', lore: 'Four right angles, zero right of way.' },
  splitter: { name: 'Pentagon Splitter', sides: 5, hp: 43,  spd: 37, r: 14, dmg: 10,  cost: 4,   minWave: 8,  color: '#59ff9c', intro: 'splits when destroyed', lore: 'The whole is worse than the sum of its parts.' },
  elite:    { name: 'Hexagon Elite',    sides: 6, hp: 138, spd: 33, r: 18, dmg: 20, cost: 8,   minWave: 14, color: '#59d5ff', intro: 'fast, tough, mean', lore: 'Six sides, all of them rude.' },
  boss:     { name: 'Nonagon Boss',     sides: 9, hp: 500, spd: 24, r: 34, dmg: 26, cost: 0,   minWave: 5,  color: '#ff3df0', intro: '', lore: 'Nonagon nobility. They have names, and they will introduce themselves.' },
};

// Splitter children: 2 darts at 60% hp.
export const SPLIT = { child: 'dart', count: 2, hpMult: 0.6 };

// Boss names, cycled by boss index. Yes, these are load-bearing.
export const BOSS_NAMES = [
  'SIR CUMFERENCE',
  'LORD RHOMBUS',
  'THE OBTUSE ONE',
  'GRANDMASTER HEXLEY',
  'POLYGOTHRA, DEVOURER OF VERTICES',
  'MARQUIS DE SIDES',
  'THE FINAL VERTEX',
];

// Boss signature moves (core.md Enemies). The move belongs to the NAME, so a
// recirculated noble brings its signature back. Decisions here, execution in
// enemies.js (pillar 5). Moves fire only from a boss's SECOND appearance — the
// wave-5 noble stays the clean onboarding wall the calibrate band is tuned to.
export const BOSS_MOVES = {
  'SIR CUMFERENCE': { id: 'adds', every: 6, count: 2, child: 'dart' },
  'THE OBTUSE ONE': { id: 'surge', belowHp: 0.35, spdMult: 1.6 },
  // Attention displaced in SPACE: there is another target you must deal with.
  'MARQUIS DE SIDES': { id: 'sunder', belowHp: 0.55, count: 4, child: 'dart', guard: 0.25 },
  // Attention displaced in TIME: there is a window in which this is the wrong
  // target. The boss also stops — the window is a trade, not extra punishment.
  'THE FINAL VERTEX': { id: 'bulwark', every: 9, dur: 3, guard: 0.25 },
  // Attention displaced in DISTANCE: the margin you were banking is spent in a
  // second. The wind-up IS the move — it costs the boss tempo and hands the
  // player the decision, which is why `tell` is long and legible.
  // `interruptFrac` is a share of the boss's OWN max hp, never an absolute number:
  // an absolute threshold beside a scaling curve is this repo's most repeated
  // defect. `stun` buys tempo, not a damage window — a boss that becomes a free
  // hit is a boss you farm (core.md "Boss signature moves").
  'LORD RHOMBUS': { id: 'charge', every: 7, tell: 3.3, dur: 1.6, spdMult: 4, interruptFrac: 0.105, stun: 1.4 },
  // Attention displaced in RHYTHM, and the deliberate mirror of `surge`: this one
  // punishes commitment where the Obtuse One punishes chip. `floor` keeps it a
  // tax rather than a wall — sustained fire must always still work, just worse.
  'GRANDMASTER HEXLEY': { id: 'study', step: 0.85, floor: 0.55, forget: 2 },
  // Attention displaced in TARGET PRIORITY: the chaff you were rightly ignoring
  // is this one's larder. Heals a flat share of max HP, so it never outpaces a
  // player who clears the escort (core.md "Boss signature moves").
  'POLYGOTHRA, DEVOURER OF VERTICES': { id: 'devour', every: 5, range: 150, healPct: 0.04 },
};

// ---------- Variants: the color/highlight grammar ----------
// Shape says what it is; highlight says what's special (README pillar 3).
// Debut order (minWave): mechanically simplest first; volatile last — its lesson
// costs the most to learn (core.md Variants).
// `boss`: the override a BOSS uses instead of the trash multipliers (core.md
// "Boss variants"). A boss's HP is a share of the whole wave, so trash
// percentages compound against a curve they were never sized for — measured, a
// regen boss on the trash 3%/s was mathematically unkillable.
export const VARIANTS = {
  swift:    { name: 'Swift',    highlight: 'glow',    color: '#ffffff', minWave: 7,  spdMult: 1.7, boss: { spdMult: 1.35 }, desc: '×1.7 speed', lore: 'White-hot and in a hurry.' },
  armored:  { name: 'Armored',  highlight: 'outline', color: '#b8c4d4', minWave: 11, hpMult: 2.5, boss: { hpMult: 1.35 }, desc: '×2.5 HP', lore: 'Wears the outline like a promise.' },
  regen:    { name: 'Regen',    highlight: 'plus',    color: '#4dff88', minWave: 17, regenPct: 0.03, boss: { regenPct: 0.005 }, desc: 'heals 3% max HP per second', lore: 'Time is on its side.' },
  shielded: { name: 'Shielded', highlight: 'shield',  color: '#7fd8ff', minWave: 21, shield: 3, boss: { shield: 12 }, desc: 'blocks the first 3 hits', lore: 'Three polite refusals, then it listens.' },
  volatile: { name: 'Volatile', highlight: 'core',    color: '#ff8630', minWave: 23, explode: { r: 70, healPct: 0.3 }, boss: {}, desc: 'bursts on death — heals nearby shapes, harms the Point if close', lore: 'Do not pop it in a crowd. Or near yourself.' },
};

// ---------- Weapons ----------
// Two axes per weapon (ADR-0006): `input` = how the player drives it (aim/hold/
// swipe/none — the card chip is chipOf(input), never stored); `category` = what
// it costs the build (gun/hold/swipe/auto — the load-bearing field, priced by
// SLOT_BUDGET). `formOf` marks a demoted form-pilot: offered only once its base
// weapon is maxed (core.md "Aim-input ordnance").
// descs[l] describes the upgrade *to* level l+1 (descs[0] = what you get at level 1).
// stats(l) is only ever called with l >= 1.

/** A run fields at most `total` weapons; gun/hold/swipe are ceilings, autos fill
 *  the rest (ADR-0006 Decision 3). Tower-bent someday, never bought (Decision 5). */
export const SLOT_BUDGET = { total: 6, gun: 2, hold: 1, swipe: 1 };

/** Card chip = display of input (ADR-0006 Decision 1). */
export function chipOf(w) {
  return w.input === 'none' ? 'AUTO' : w.input.toUpperCase();
}
export const WEAPONS = {
  bolt: {
    name: 'Bolt', input: 'aim', category: 'gun', max: 6,
    descs: ['Auto-fires toward your aim', '+damage', 'Bolts pierce one extra shape', 'Bolts ricochet to another shape', 'Bolts ricochet twice', 'MAX: a second bolt picks its own target'],
    // ONE bolt per stream — the fan moved out of this ladder and became the Fan
    // form (ADR-0006 Decision 8, core.md bolt row). The second stream is the
    // CAPSTONE (ADR-0014): it was L3's gift and the ladder's steepest rung, so
    // it moved to MAX and pierce/ricochet each shifted down one. L5/L6 damage
    // is the old ladder's EMISSION collapsed into one bolt (L5 was 2x29, L6 was
    // 3x33) and stays pinned to the level, not to the grants that moved.
    stats: l => ({ dmg: l >= 6 ? 99 : l >= 5 ? 58 : 9 + 4 * l, volley: 1, auto: l >= 6 ? 1 : 0, pierce: l >= 3 ? 1 : 0, ricochet: l >= 5 ? 2 : l >= 4 ? 1 : 0, cd: 0.38 - 0.02 * l }),
  },
  wall: {
    name: 'Force Wall', input: 'swipe', category: 'swipe', max: 5,
    descs: ['Swipe a wall into being — shapes must break through it', '+length & wall HP', '+push & damage', '+wall HP & length', 'MAX: two walls'],
    stats: l => ({ len: 150 + 40 * l, hp: 80 + 40 * l, dur: 5, push: 100 + 25 * l, dmg: 5 + 2 * l, tick: 0.4, maxWalls: l >= 5 ? 2 : 1, cd: 0.4 }),
  },
  beam: {
    name: 'Lance Beam', input: 'hold', category: 'hold', max: 5,
    descs: ['Hold to channel a beam — damage ramps as it cooks a target', '+damage', '+width, runs cooler', '+damage', 'MAX: always on, aims itself at your reticle'],
    stats: l => ({
      dps: 34 + 20 * l, width: 9 + 2.5 * l, heatRate: l >= 5 ? 0 : (l >= 3 ? 0.22 : 0.29), alwaysOn: l >= 5,
      tick: 0.25, rampMax: 2.5, rampUp: 2.0, rampDown: 1.5,
    }),
  },
  orbit: {
    name: 'Orbitals', input: 'none', category: 'auto', max: 5,
    descs: ['Two curved blades circle the Point, grinding shapes they touch', '+1 blade', '+1 blade, longer reach', '+1 blade, +damage', 'MAX: six blades'],
    // ADR-0020: the ring is a constant, every level adds a blade, and the blades
    // lengthen along the arc. Radius growth used to be the per-level grant; it was
    // a coverage nerf in an upgrade's clothes that walked them out of the frost
    // aura. `bite` is the per-shape cooldown — the ceiling control.
    stats: l => ({
      n: [0, 2, 3, 4, 5, 6][l], dmg: 17 + 9 * l,
      radius: 138, reach: 13, len: [0, 8, 14, 22, 30, 38][l],
      speed: 2.3 + 0.18 * l, bite: [0, 0.5, 0.46, 0.42, 0.36, 0.3][l],
    }),
  },
  nova: {
    name: 'Nova', input: 'none', category: 'auto', max: 5,
    descs: ['The Point pulses a damaging ring', '+damage', 'Faster pulse', '+range & damage', 'MAX: fast and huge'],
    // radius re-sloped twice 2026-07-24: "even more" first pulse (core.md nova row)
    stats: l => ({ dmg: 16 + 8 * l, cd: Math.max(1.7, 5.0 - 0.6 * l), radius: 195 + 15 * l }),
  },
  frost: {
    name: 'Frost Aura', input: 'none', category: 'auto', max: 5,
    descs: ['An aura that slows shapes', '+radius', '+slow', '+radius', 'MAX: glacial'],
    stats: l => ({ radius: 100 + 26 * l, slow: [0, 0.22, 0.28, 0.33, 0.38, 0.45][l] }),
  },
  tesla: {
    name: 'Tesla Coil', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['Lightning chains between shapes', '+1 chain', '+damage', '+chain & range', 'MAX: 6 chains'],
    stats: l => ({ chains: [0, 2, 3, 3, 4, 6][l], dmg: 12 + 7 * l, cd: Math.max(0.9, 2.3 - 0.22 * l), range: 170 + 18 * l }),
  },
  seek: {
    name: 'Seekers', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['Homing missiles with a small blast', '+damage', '+1 seeker', 'Faster volleys', 'MAX: 3 seekers'],
    stats: l => ({ n: [0, 1, 1, 2, 2, 3][l], dmg: 20 + 10 * l, cd: Math.max(0.9, 2.6 - 0.3 * l), blast: 40, speed: 260 }),
  },
  turret: {
    name: 'Turrets', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['A mini-turret orbits and shoots', 'Faster fire', '+1 turret', '+damage', 'MAX: 3 turrets'],
    stats: l => ({ n: [0, 1, 1, 2, 2, 3][l], dmg: 8 + 4 * l, cd: Math.max(0.35, 1.0 - 0.09 * l), range: 260 }),
  },
  mine: {
    name: 'Mines', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['Seeds proximity mines around the Point', '+1 mine & damage', '+blast radius', '+1 mine, faster seeding', 'MAX: 6 mines'],
    stats: l => ({ cap: [0, 2, 3, 4, 5, 6][l], dmg: 24 + 12 * l, blast: 62 + 6 * l, trigger: 44, cd: Math.max(1.2, 2.6 - 0.25 * l), arm: 0.5 }),
  },
  mortar: {
    name: 'Mortar', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['Lobs arcing shells at distant shapes', '+damage', '+blast, faster volleys', '+damage', 'MAX: twin shells'],
    stats: l => ({ dmg: 30 + 14 * l, blast: 68 + 8 * l, cd: Math.max(1.6, 3.4 - 0.3 * l), shells: l >= 5 ? 2 : 1, flight: 1.1, scatter: 30 }),
  },
  // ---- Field exotics (ADR-0004 wave C) ----
  catapult: {
    name: 'Catapult', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['Hurls a boulder that tramples everything it rolls over', '+damage', '+damage & size', 'Faster volleys', 'MAX: twin boulders'],
    stats: l => ({ dmg: 20 + 9 * l, cd: 4.5 - 0.35 * l, speed: 130, r: 14 + l, n: l >= 5 ? 2 : 1, tick: 0.5, knock: 260 }),
  },
  caltrop: {
    name: 'Caltrops', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['Scatters spikes that prick and slow', '+damage & bigger field', '+damage', 'Faster scattering', 'MAX: a carpet of spikes'],
    stats: l => ({ dmg: 6 + 3 * l, cd: 3.0 - 0.2 * l, cluster: 5, patchR: 55, cap: 12 + 3 * l, life: 14, slow: 0.45, slowDur: 1.2 }),
  },
  cascade: {
    name: 'Cascade', input: 'none', category: 'auto', max: 5, techLock: true,
    descs: ['A spark primes a shape to explode — and spread', '+damage', 'Faster sparks', '+damage', 'MAX: twin sparks'],
    stats: l => ({ dmg: 22 + 10 * l, cd: 5.5 - 0.4 * l, n: l >= 5 ? 2 : 1, fuse: 0.6, blast: 70, decay: 0.75, minDmg: 8, maxGen: 8, speed: 340 }),
  },
  // ---- Aim ordnance (ADR-0004 wave A): auto-fires toward the standing aim ----
  scatter: {
    name: 'Scattergun', input: 'aim', category: 'gun', max: 5, techLock: true,
    descs: ['A slow volley of overlapping pellets toward your aim', '+1 pellet & damage', '+1 pellet, faster volleys', '+1 pellet & damage', 'MAX: an 11-pellet wall'],
    stats: l => ({ pellets: 6 + l, dmg: 6 + 2 * l, spread: 0.26, speed: 470, jitter: 70, cd: 1.7 - 0.1 * l }),
  },
  heavy: {
    name: 'Howitzer', input: 'aim', category: 'gun', max: 5, techLock: true,
    descs: ['Three quick rounds, a beat, one heavy piercing shell', '+damage', '+damage, faster cycle', '+damage', 'MAX: the shell hits like a noble'],
    stats: l => ({ lightDmg: 6 + 2 * l, heavyDmg: 24 + 11 * l, lightGap: 0.11, pause: 0.45, pierce: 2, lightSpeed: 520, heavySpeed: 380, cd: 1.2 - 0.08 * l }),
  },
  boomer: {
    name: 'Boomerang', input: 'aim', category: 'auto', max: 5, techLock: true,
    descs: ['A returning blade — bites going out and coming back', '+damage', 'Faster throws', '+damage', 'MAX: twin blades'],
    stats: l => ({ dmg: 13 + 6 * l, cd: 2.6 - 0.2 * l, speed: 440, decel: 200, retAccel: 1100, retSpeed: 560, r: 11, n: l >= 5 ? 2 : 1 }),
  },
  // ---- Gesture-slot variants (ADR-0004 wave B) ----
  flame: {
    name: 'Flamethrower', input: 'hold', category: 'hold', max: 5, techLock: true,
    descs: ['Hold to sweep a cone of fire — burns stack and linger', '+burn damage', '+range, runs cooler', '+burn damage & hotter ground', 'MAX: never overheats, aims itself'],
    stats: l => ({
      range: 230 + 18 * l, arc: 0.3, tick: 0.3, direct: 4 + 1.5 * l,
      burnDps: 3 + 1.5 * l, burnDur: 2.5, maxStacks: 5,
      patchEvery: 0.35, patchR: 26, patchLife: 2.2, patchDps: 6 + 3 * l,
      heatRate: l >= 5 ? 0 : (l >= 3 ? 0.16 : 0.22), alwaysOn: l >= 5,
    }),
  },
  meteor: {
    name: 'Meteor', input: 'hold', category: 'hold', max: 5, techLock: true,
    descs: ['Hold to grow a meteor, release to drop it on your aim', '+damage', '+blast radius', '+damage, faster cycle', 'MAX: cataclysm'],
    stats: l => ({
      chargeTime: 1.5, dmg: 24 + 12 * l, blast: 60 + 8 * l,
      minDmgFrac: 0.45, minBlastFrac: 0.55, knock: 220, fall: 0.45,
      cd: 0.9 - 0.05 * l, scorchDps: 8, scorchLife: 2.0,
    }),
  },
  blades: {
    name: 'Force Blades', input: 'swipe', category: 'swipe', max: 5, techLock: true,
    descs: ['Swipe to hurl piercing crescents outward', '+1 blade', '+damage', '+1 blade', 'MAX: 5 blades'],
    stats: l => ({ n: [0, 2, 3, 3, 4, 5][l], dmg: 15 + 7 * l, speed: 400, r: 12, len: 200, cd: 0.45 }),
  },
};

// Weapon FORMS (core.md "Forms", ADR-0006 Decisions 6-8). A form regroups a
// weapon's output in TIME and never changes the output — power-neutral by
// construction, which is what stops a "form" from being a stat wearing a name.
// `req` is the lattice node that unlocks it; mastery trees take that job in
// ADR-0003 stage 2. Forms cost no weapon slot.
export const FORMS = {
  fan: {
    of: 'bolt', name: 'Fan', req: 'fan',
    desc: 'Every bolt becomes a center-true spread — coverage instead of concentration',
    spread: 3,     // bolts per shot; each carries 1/spread of the damage
  },
  burst: {
    of: 'bolt', name: 'Burst', req: 'burst',
    desc: 'Bolt fires in fast salvos with a beat between — ratatatata, not bang-pause-bang',
    salvo: 4,      // volleys per salvo
    gapFrac: 0.4,  // gap between them, as a fraction of bolt's own cadence
  },
};

// Generic level-up cards. The pool is AUTHORED BY THE LATTICE (core.md "Generic
// cards", GDD section 6): `techLock: true` keeps a card out until some node's
// `effect.unlockGeneric` names it — the same contract `techLock` weapons have
// with `unlockWeapon`. Repair is additionally gated by hp in state.js.
export const GENERICS = {
  repair:    { name: 'Repair',    desc: 'Restore 40% max HP' },
  bulkhead:  { name: 'Bulkhead',  desc: '+25 max HP, healed on the spot' },
  overclock: { name: 'Overclock', desc: '+10% damage this run' },
  coolant:   { name: 'Coolant',   desc: '−5% cooldowns this run' },
  crit:      { name: 'Critical Systems', desc: '+10% critical hit chance', techLock: true },
};

// ---------- Haptics (core.md "Haptics") ----------
// A buzz means "this happened to you", never "you did a thing". The channel is
// deliberately tiny: shoot fires from five call sites and death fires on every
// kill, and a phone that buzzes for those is unusable — but the real argument is
// that if everything buzzes, nothing does. Law·Legibility, applied to touch.
export const HAPTICS = {
  hurt: 18,              // a chip: GDD §2 calls it a signal, and touch reaches the
                         // player even when their eyes are on the far rim
  boss: [0, 45, 70, 45], // a named boss, arriving off-screen more often than not
  gameover: 220,         // the run ended
};

/** Minimum ms between buzzes. A surrounded tower takes a strike every 0.9s PER
 *  besieger; without this a pile-up machine-guns the motor instead of rumbling. */
export const HAPTIC_MIN_GAP = 120;

/** Ceiling on any single pattern's total duration — test-pinned so no future
 *  event can turn the channel into a punishment. */
export const HAPTIC_MAX_MS = 400;

// ---------- Achievements ----------
// Pure predicates over (meta, finalRunState|null); S-dependent ones unlock only at
// run end (core.md "Records"). This list is the single home.
export const ACHIEVEMENTS = [
  { id: 'first',      name: 'First Blood',       desc: 'Disassemble your first shape', test: m => m.totalKills >= 1 },
  { id: 'regicide',   name: 'Regicide',          desc: 'Fell a named boss', test: m => m.totalBossKills >= 1 },
  { id: 'wave5',      name: 'Meet the Nobility', desc: 'Reach wave 5', test: m => m.best >= 5 },
  { id: 'wave10',     name: 'Double Digits',     desc: 'Reach wave 10', test: m => m.best >= 10 },
  { id: 'wave20',     name: 'Deep Geometry',     desc: 'Reach wave 20', test: m => m.best >= 20 },
  { id: 'wave40',     name: 'The Recirculation', desc: 'Reach wave 40 — the nobles return changed', test: m => m.best >= 40 },
  { id: 'kills500',   name: 'Shape Crime',       desc: '500 lifetime kills', test: m => m.totalKills >= 500 },
  { id: 'hoarder',    name: 'Hoarder',           desc: 'Earn 500 lifetime shards', test: m => m.totalShards >= 500 },
  { id: 'investor',   name: 'Investor',          desc: 'Own 10 tech nodes', test: m => m.tech.length >= 10 },
  { id: 'garrison',   name: 'Full Garrison',     desc: 'Unlock every tower', test: m => ['tower_tempest', 'tower_warden', 'tower_lance'].every(t => m.tech.includes(t)) },
  { id: 'guide',      name: 'Field Guide',       desc: 'Sight every shape', test: m => m.seen.enemies.length >= Object.keys(ENEMIES).length },
  { id: 'taxonomy',   name: 'Complete Taxonomy', desc: 'Fill the bestiary', test: m => m.seen.enemies.length >= Object.keys(ENEMIES).length && m.seen.variants.length >= Object.keys(VARIANTS).length },
  { id: 'specialist', name: 'Specialist',        desc: 'Max out a weapon in one run', test: (m, S) => !!S && Object.entries(S.weapons).some(([id, l]) => l >= WEAPONS[id].max) },
  { id: 'overqual',   name: 'Overqualified',     desc: 'Reach level 12 in one run', test: (m, S) => !!S && S.lvl >= 12 },
];

// ---------- Towers ----------
// Bolt is the default weapon, not a guaranteed gun (ADR-0007) — a loadout may
// skip it. Identity = stat profile + starters, within SLOT_BUDGET (test-pinned).
export const TOWERS = {
  bastion: {
    name: 'Bastion', color: '#4de8ff', hpMult: 1.0, dmgMult: 1.0,
    start: { bolt: 2 },
    blurb: 'The original Point. Sharper bolt, no gimmicks.',
  },
  tempest: {
    name: 'Tempest', color: '#c06bff', hpMult: 0.8, dmgMult: 1.0,
    start: { bolt: 1, tesla: 1 },
    blurb: 'Fragile, brilliant. Arrives with a Tesla Coil humming.',
  },
  warden: {
    name: 'Warden', color: '#ffb84d', hpMult: 1.3, dmgMult: 0.9,
    start: { bolt: 1, nova: 1 },
    blurb: 'Thick plating and a Nova heartbeat. Let them come.',
  },
  lance: {
    name: 'Lance', color: '#ff5c6c', hpMult: 0.85, dmgMult: 1.1,
    start: { bolt: 1, beam: 1 },
    blurb: 'Glass and fury. Holds the line by holding the screen.',
  },
};

// ---------- The Lattice (ADR-0003 stage 1) ----------
// Radial web: six sectors × five rings, ring = cost band (core.md "The Lattice").
// Legacy ids preserved verbatim so pre-lattice saves keep purchases. reqMode:'any'
// marks web cross-links. Structure pinned by test/tech.test.mjs; content = tuning.
// Band order (top to bottom in the Lattice view) — SEMANTIC since ADR-0005:
// cross-sector requisites may only reference an adjacent sector in this order
// (core.md "The Lattice"; enforced by tech.test 'adjacent lanes').
// Band order is SEMANTIC (ADR-0005): a cross-sector requisite may only reference
// an adjacent sector. 'Salvage' was retired 2026-07-25 with its income line — the
// law took its content and an empty band reads as a bug, not a design. Re-adding a
// sector is cheap when one earns a theme (PINS: the deck sector).
export const SECTORS = ['Hull', 'Arms', 'Mind', 'Arsenal', 'Armory', 'Towers'];

/** Nodes removed from the lattice, with what they cost, so a save holding one can
 *  be refunded exactly once at load (core.md "Retired nodes refund on load").
 *  Silently ignoring unknown ids would strand shards with no way to notice. */
export const RETIRED_NODES = {
  // The Salvage income line: 1255◆ for ×2.35 shard income. Retired 2026-07-25 for
  // breaking Law·No-meta-accel (nothing purchasable may speed meta-progression) —
  // and Law·Focus, since an income node is an optimiser's no-brainer first buy.
  salv1: 15, salv2: 40, salv3: 100, salv4: 250, goldrush: 600, quartermaster: 250,
  // The Quick Study xp line: 1105◆ for +70% levelling speed. Retired 2026-07-26
  // (ADR-0015) with the in-run XP economy itself — measurement showed XP was paying
  // exactly one level per wave regardless, so these nodes were buying a rate that
  // could not move. Levels now come from waves.
  study1: 15, study2: 40, study3: 100, study4: 250, enlighten: 600, scholarsoldier: 100,
};

export const LATTICE = [
  // ---- Hull (survival) ----
  { id: 'vit1',       sector: 'Hull', ring: 1, name: 'Vitality I',    desc: '+20 max HP',       cost: 15,  req: [],           effect: { hpBonus: 20 } },
  { id: 'vit2',       sector: 'Hull', ring: 2, name: 'Vitality II',   desc: '+20 max HP',       cost: 40,  req: ['vit1'],     effect: { hpBonus: 20 } },
  { id: 'vit3',       sector: 'Hull', ring: 3, name: 'Vitality III',  desc: '+25 max HP',       cost: 100, req: ['vit2'],     effect: { hpBonus: 25 } },
  { id: 'vit4',       sector: 'Hull', ring: 4, name: 'Vitality IV',   desc: '+30 max HP',       cost: 250, req: ['vit3'],     effect: { hpBonus: 30 } },
  { id: 'plate1',     sector: 'Hull', ring: 2, name: 'Plating I',     desc: '−8% damage taken', cost: 40,  req: ['vit1'],     effect: { dmgTakenAdd: -0.08 } },
  { id: 'plate2',     sector: 'Hull', ring: 3, name: 'Plating II',    desc: '−8% damage taken', cost: 100, req: ['plate1'],   effect: { dmgTakenAdd: -0.08 } },
  { id: 'plate3',     sector: 'Hull', ring: 4, name: 'Plating III',   desc: '−8% damage taken', cost: 250, req: ['plate2'],   effect: { dmgTakenAdd: -0.08 } },
  { id: 'nano1',      sector: 'Hull', ring: 2, name: 'Nanites I',     desc: '+0.5 HP/s regen',  cost: 40,  req: ['vit1'],     effect: { regen: 0.5 } },
  { id: 'nano2',      sector: 'Hull', ring: 3, name: 'Nanites II',    desc: '+0.5 HP/s regen',  cost: 100, req: ['nano1'],    effect: { regen: 0.5 } },
  { id: 'nano3',      sector: 'Hull', ring: 4, name: 'Nanites III',   desc: '+0.8 HP/s regen',  cost: 250, req: ['nano2'],    effect: { regen: 0.8 } },
  { id: 'bulwark',    sector: 'Hull', ring: 5, name: 'Bulwark Core',  desc: '+80 max HP',       cost: 600, req: ['vit4'],     effect: { hpBonus: 80 } },
  { id: 'aegis',      sector: 'Hull', ring: 5, name: 'Aegis Field',   desc: '−12% damage taken', cost: 600, req: ['plate3'],  effect: { dmgTakenAdd: -0.12 } },
  { id: 'lifespring', sector: 'Hull', ring: 5, name: 'Lifespring',    desc: '+1.2 HP/s regen',  cost: 600, req: ['nano3'],    effect: { regen: 1.2 } },
  // ---- Arms (offense) ----
  { id: 'over1',      sector: 'Arms', ring: 1, name: 'Overcharge I',   desc: '+8% damage',      cost: 15,  req: [],           effect: { dmgAdd: 0.08 } },
  { id: 'over2',      sector: 'Arms', ring: 2, name: 'Overcharge II',  desc: '+8% damage',      cost: 40,  req: ['over1'],    effect: { dmgAdd: 0.08 } },
  { id: 'over3',      sector: 'Arms', ring: 3, name: 'Overcharge III', desc: '+8% damage',      cost: 100, req: ['over2'],    effect: { dmgAdd: 0.08 } },
  { id: 'over4',      sector: 'Arms', ring: 4, name: 'Overcharge IV',  desc: '+10% damage',     cost: 250, req: ['over3'],    effect: { dmgAdd: 0.10 } },
  { id: 'prec',       sector: 'Arms', ring: 2, name: 'Precision',      desc: 'Crit cards join your level-up pool', cost: 50, req: ['over1'], effect: { unlockGeneric: 'crit' } },
  { id: 'prec2',      sector: 'Arms', ring: 3, name: 'Precision II',   desc: '+10% crit chance', cost: 110, req: ['prec'],    effect: { critChance: 0.1 } },
  { id: 'deadeye',    sector: 'Arms', ring: 4, name: 'Deadeye',        desc: '+10% crit chance', cost: 260, req: ['prec2'],   effect: { critChance: 0.1 } },
  { id: 'haste1',     sector: 'Arms', ring: 2, name: 'Haste I',        desc: '−6% cooldowns',   cost: 40,  req: ['over1'],    effect: { cdAdd: -0.06 } },
  { id: 'haste2',     sector: 'Arms', ring: 3, name: 'Haste II',       desc: '−6% cooldowns',   cost: 100, req: ['haste1'],   effect: { cdAdd: -0.06 } },
  { id: 'haste3',     sector: 'Arms', ring: 4, name: 'Haste III',      desc: '−6% cooldowns',   cost: 250, req: ['haste2'],   effect: { cdAdd: -0.06 } },
  { id: 'annihilator', sector: 'Arms', ring: 5, name: 'Annihilator',   desc: '+15% damage',     cost: 600, req: ['over4'],    effect: { dmgAdd: 0.15 } },
  { id: 'flashstep',  sector: 'Arms', ring: 5, name: 'Flashstep',      desc: '−10% cooldowns',  cost: 600, req: ['haste3'],   effect: { cdAdd: -0.10 } },
  // ---- Mind (experience) ----
  { id: 'head',       sector: 'Mind', ring: 2, name: 'Head Start',      desc: 'Start one level higher, with a free pick', cost: 45,  req: [], effect: { startLevelAdd: 1 } },
  { id: 'head2',      sector: 'Mind', ring: 4, name: 'Running Start',   desc: 'Start one level higher again',      cost: 250, req: ['head'],   effect: { startLevelAdd: 1 } },
  // ---- Arsenal (weapon unlocks + munitions) ----
  { id: 'tesla',      sector: 'Arsenal', ring: 1, name: 'Tesla Coil',  desc: 'Adds Tesla Coil to the level-up pool', cost: 25, req: [],        effect: { unlockWeapon: 'tesla' } },
  { id: 'seek',       sector: 'Arsenal', ring: 2, name: 'Seekers',     desc: 'Adds Seekers to the level-up pool',    cost: 45, req: ['tesla'], effect: { unlockWeapon: 'seek' } },
  { id: 'turret',     sector: 'Arsenal', ring: 3, name: 'Turrets',     desc: 'Adds Turrets to the level-up pool',    cost: 100, req: ['seek'], effect: { unlockWeapon: 'turret' } },
  { id: 'mine',       sector: 'Arsenal', ring: 1, name: 'Mines',       desc: 'Adds Mines to the level-up pool',      cost: 30, req: [],        effect: { unlockWeapon: 'mine' } },
  { id: 'mortar',     sector: 'Arsenal', ring: 2, name: 'Mortar',      desc: 'Adds the Mortar to the level-up pool', cost: 65, req: ['mine'],  effect: { unlockWeapon: 'mortar' } },
  { id: 'caltrop',    sector: 'Arsenal', ring: 2, name: 'Caltrops',     desc: 'Adds Caltrops to the level-up pool',     cost: 55,  req: ['mine'],    effect: { unlockWeapon: 'caltrop' } },
  { id: 'catapult',   sector: 'Arsenal', ring: 3, name: 'Catapult',     desc: 'Adds the Catapult to the level-up pool', cost: 110, req: ['mortar', 'caltrop'], reqMode: 'any', effect: { unlockWeapon: 'catapult' } },
  { id: 'cascade',    sector: 'Arsenal', ring: 4, name: 'Cascade',      desc: 'Adds the Cascade to the level-up pool',  cost: 260, req: ['catapult'], effect: { unlockWeapon: 'cascade' } },
  { id: 'mun1',       sector: 'Arsenal', ring: 3, name: 'Munitions I',  desc: '+5% damage',     cost: 100, req: ['seek', 'mortar'], reqMode: 'any', effect: { dmgAdd: 0.05 } },
  { id: 'mun2',       sector: 'Arsenal', ring: 4, name: 'Munitions II', desc: '+6% damage',     cost: 250, req: ['mun1'],     effect: { dmgAdd: 0.06 } },
  { id: 'arsmaster',  sector: 'Arsenal', ring: 5, name: 'Arsenal Master', desc: '+10% damage & −4% cooldowns', cost: 600, req: ['turret', 'mun2'], effect: { dmgAdd: 0.10, cdAdd: -0.04 } },
  // ---- Armory (manual/aim weapon unlocks — ADR-0004) ----
  { id: 'scatter',    sector: 'Armory', ring: 1, name: 'Scattergun', desc: 'Adds the Scattergun to the level-up pool', cost: 30,  req: [],          effect: { unlockWeapon: 'scatter' } },
  { id: 'burst',      sector: 'Armory', ring: 2, name: 'Burst Form',  desc: 'Unlocks the Burst form for a maxed Bolt',  cost: 55,  req: ['scatter'], effect: { unlockForm: 'burst' } },
  { id: 'fan',        sector: 'Armory', ring: 2, name: 'Fan Form',    desc: 'Unlocks the Fan form for a maxed Bolt',    cost: 55,  req: ['scatter'], effect: { unlockForm: 'fan' } },
  { id: 'heavy',      sector: 'Armory', ring: 3, name: 'Howitzer',   desc: 'Adds the Howitzer to the level-up pool',   cost: 110, req: ['burst'],   effect: { unlockWeapon: 'heavy' } },
  { id: 'boomer',     sector: 'Armory', ring: 2, name: 'Boomerang',  desc: 'Adds the Boomerang to the level-up pool',  cost: 60,  req: ['scatter'], effect: { unlockWeapon: 'boomer' } },
  { id: 'ballistics', sector: 'Armory', ring: 3, name: 'Ballistics', desc: '+6% damage', cost: 100, req: ['burst', 'mun1'], reqMode: 'any', effect: { dmgAdd: 0.06 } },
  { id: 'blades',     sector: 'Armory', ring: 1, name: 'Force Blades',  desc: 'Adds Force Blades to the level-up pool',    cost: 35,  req: [],         effect: { unlockWeapon: 'blades' } },
  { id: 'flame',      sector: 'Armory', ring: 2, name: 'Flamethrower',  desc: 'Adds the Flamethrower to the level-up pool', cost: 65, req: ['blades'], effect: { unlockWeapon: 'flame' } },
  { id: 'meteor',     sector: 'Armory', ring: 3, name: 'Meteor',        desc: 'Adds the Meteor to the level-up pool',      cost: 120, req: ['flame'],  effect: { unlockWeapon: 'meteor' } },
  { id: 'siegecraft', sector: 'Armory', ring: 4, name: 'Siegecraft',    desc: '+6% damage & −3% cooldowns', cost: 250, req: ['meteor'], effect: { dmgAdd: 0.06, cdAdd: -0.03 } },
  { id: 'masteratarms', sector: 'Armory', ring: 5, name: 'Master-at-Arms', desc: '+8% damage & −5% cooldowns', cost: 600, req: ['heavy', 'siegecraft'], reqMode: 'any', effect: { dmgAdd: 0.08, cdAdd: -0.05 } },
  // ---- Towers (unlocks + keel) ----
  { id: 'tower_tempest', sector: 'Towers', ring: 2, name: 'Tempest', desc: 'Unlock the Tempest tower', cost: 40,  req: [],                effect: { unlockTower: 'tempest' } },
  { id: 'tower_warden',  sector: 'Towers', ring: 3, name: 'Warden',  desc: 'Unlock the Warden tower',  cost: 75,  req: ['tower_tempest'], effect: { unlockTower: 'warden' } },
  { id: 'tower_lance',   sector: 'Towers', ring: 4, name: 'Lance',   desc: 'Unlock the Lance tower',   cost: 200, req: ['tower_warden'],  effect: { unlockTower: 'lance' } },
  { id: 'keel1',      sector: 'Towers', ring: 3, name: 'Reinforced Keel',  desc: '+15 max HP',  cost: 100, req: ['tower_tempest'], effect: { hpBonus: 15 } },
  { id: 'keel2',      sector: 'Towers', ring: 4, name: 'Resonant Core',    desc: '+5% damage',  cost: 250, req: ['keel1'],    effect: { dmgAdd: 0.05 } },
  { id: 'towermaster', sector: 'Towers', ring: 5, name: 'Master of Points', desc: '+40 max HP & +5% damage', cost: 600, req: ['tower_lance', 'keel2'], effect: { hpBonus: 40, dmgAdd: 0.05 } },
  // ---- Cross-links (reqMode any — the web strands between sectors) ----
  { id: 'fieldkit',   sector: 'Hull',    ring: 2, name: 'Field Kit',      desc: '+0.3 HP/s regen', cost: 40,  req: ['nano1', 'prec'],           reqMode: 'any', effect: { regen: 0.3 } },
  { id: 'warchest',   sector: 'Mind',    ring: 3, name: 'War Chest',      desc: '+8% damage',      cost: 100, req: ['mortar'],                                  effect: { dmgAdd: 0.08 } },
  { id: 'overseer',   sector: 'Towers',  ring: 3, name: 'Overseer',       desc: '−4% cooldowns',   cost: 100, req: ['ballistics', 'tower_tempest'], reqMode: 'any', effect: { cdAdd: -0.04 } },
  { id: 'reinforcedgrid', sector: 'Hull', ring: 4, name: 'Reinforced Grid', desc: '+25 max HP',    cost: 250, req: ['vit3', 'over3'],           reqMode: 'any', effect: { hpBonus: 25 } },
];
