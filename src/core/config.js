// All content tables. This file is the single home of tuning data (core.md carries
// the intent); balance *curves* live in balance.js. No logic beyond stat formulas.

// ---------- Enemies ----------
// sides: 0 = circle. Contact with the Point deals dmg and the enemy dies (kamikaze);
// the boss rams, knocks back, returns.
export const ENEMIES = {
  grunt:    { name: 'Grunt',    sides: 0, hp: 12,  spd: 40, r: 12, dmg: 8,  xp: 2,  cost: 1,   minWave: 1, color: '#ff5c6c' },
  dart:     { name: 'Dart',     sides: 3, hp: 8,   spd: 88, r: 10, dmg: 6,  xp: 2,  cost: 1.5, minWave: 2, color: '#ffb84d' },
  tank:     { name: 'Tank',     sides: 4, hp: 48,  spd: 26, r: 15, dmg: 16, xp: 5,  cost: 3,   minWave: 3, color: '#c06bff' },
  splitter: { name: 'Splitter', sides: 5, hp: 34,  spd: 34, r: 14, dmg: 10, xp: 6,  cost: 4,   minWave: 5, color: '#59ff9c' },
  elite:    { name: 'Elite',    sides: 6, hp: 110, spd: 30, r: 18, dmg: 20, xp: 12, cost: 8,   minWave: 8, color: '#59d5ff' },
  boss:     { name: 'Boss',     sides: 9, hp: 500, spd: 22, r: 34, dmg: 26, xp: 80, cost: 0,   minWave: 5, color: '#ff3df0' },
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

// ---------- Variants: the color/highlight grammar ----------
// Shape says what it is; highlight says what's special (README pillar 3).
export const VARIANTS = {
  swift:    { name: 'Swift',    highlight: 'glow',    color: '#ffffff', hpMult: 0.8, spdMult: 1.7, xpMult: 1.3 },
  armored:  { name: 'Armored',  highlight: 'outline', color: '#b8c4d4', hpMult: 2.5, spdMult: 0.8, xpMult: 1.6 },
  volatile: { name: 'Volatile', highlight: 'core',    color: '#ff8630', xpMult: 1.4, explode: { r: 70, dmgMult: 2 } },
  regen:    { name: 'Regen',    highlight: 'ring',    color: '#4dff88', xpMult: 1.5, regenPct: 0.03 },
  shielded: { name: 'Shielded', highlight: 'shield',  color: '#7fd8ff', xpMult: 1.6, shield: 3 },
};

// ---------- Weapons ----------
// descs[l] describes the upgrade *to* level l+1 (descs[0] = what you get at level 1).
// stats(l) is only ever called with l >= 1.
export const WEAPONS = {
  bolt: {
    name: 'Bolt', kind: 'manual', gesture: 'aim', max: 6, tag: 'AIM',
    descs: ['Auto-fires toward your aim', '+damage', 'Fires 2 bolts', 'Bolts pierce one extra shape', 'Fires 3 bolts', 'MAX: second volley targets the nearest shape'],
    stats: l => ({ dmg: 9 + 4 * l, count: l >= 5 ? 3 : l >= 3 ? 2 : 1, pierce: l >= 4 ? 1 : 0, cd: 0.34 - 0.02 * l, twin: l >= 6 }),
  },
  shockwave: {
    name: 'Shockwave', kind: 'manual', gesture: 'swipe', max: 5, tag: 'SWIPE',
    descs: ['Swipe to unleash a knockback wave', '+damage & width', 'Faster recharge', '+knockback & damage', 'MAX: double damage'],
    stats: l => ({ dmg: (16 + 7 * l) * (l >= 5 ? 2 : 1), width: 55 + 9 * l, knock: 170 + 25 * l, cd: Math.max(0.6, 1.7 - 0.18 * l) }),
  },
  beam: {
    name: 'Lance Beam', kind: 'manual', gesture: 'hold', max: 5, tag: 'HOLD',
    descs: ['Hold to channel a beam', '+damage', '+width, runs cooler', '+damage', 'MAX: never overheats'],
    stats: l => ({ dps: 26 + 16 * l, width: 9 + 2.5 * l, heatRate: l >= 5 ? 0 : (l >= 3 ? 0.22 : 0.29) }),
  },
  orbit: {
    name: 'Orbitals', kind: 'auto', max: 5, tag: 'AUTO',
    descs: ['A blade orbits the Point', '+1 blade', '+damage & radius', '+1 blade', 'MAX: 5 blades'],
    stats: l => ({ n: [0, 1, 2, 2, 3, 5][l], dmg: 9 + 5 * l, radius: 64 + 8 * l, speed: 2.3 + 0.18 * l }),
  },
  nova: {
    name: 'Nova', kind: 'auto', max: 5, tag: 'AUTO',
    descs: ['The Point pulses a damaging ring', '+damage', 'Faster pulse', '+range & damage', 'MAX: fast and huge'],
    stats: l => ({ dmg: 14 + 7 * l, cd: Math.max(1.8, 5.2 - 0.6 * l), radius: 120 + 26 * l }),
  },
  frost: {
    name: 'Frost Aura', kind: 'auto', max: 5, tag: 'AUTO',
    descs: ['An aura that slows shapes', '+radius', '+slow', '+radius', 'MAX: glacial'],
    stats: l => ({ radius: 100 + 26 * l, slow: [0, 0.22, 0.28, 0.33, 0.38, 0.45][l] }),
  },
  tesla: {
    name: 'Tesla Coil', kind: 'auto', max: 5, tag: 'AUTO', techLock: true,
    descs: ['Lightning chains between shapes', '+1 chain', '+damage', '+chain & range', 'MAX: 6 chains'],
    stats: l => ({ chains: [0, 2, 3, 3, 4, 6][l], dmg: 11 + 6 * l, cd: Math.max(0.9, 2.3 - 0.22 * l), range: 170 + 18 * l }),
  },
  seek: {
    name: 'Seekers', kind: 'auto', max: 5, tag: 'AUTO', techLock: true,
    descs: ['Homing missiles with a small blast', '+damage', '+1 seeker', 'Faster volleys', 'MAX: 3 seekers'],
    stats: l => ({ n: [0, 1, 1, 2, 2, 3][l], dmg: 18 + 9 * l, cd: Math.max(0.9, 2.6 - 0.3 * l), blast: 40, speed: 260 }),
  },
  turret: {
    name: 'Turrets', kind: 'auto', max: 5, tag: 'AUTO', techLock: true,
    descs: ['A mini-turret orbits and shoots', 'Faster fire', '+1 turret', '+damage', 'MAX: 3 turrets'],
    stats: l => ({ n: [0, 1, 1, 2, 2, 3][l], dmg: 7 + 3.5 * l, cd: Math.max(0.35, 1.0 - 0.09 * l), range: 260 }),
  },
};

// Generic level-up cards (always eligible; repair gated by hp in state.js).
export const GENERICS = {
  repair:    { name: 'Repair',    desc: 'Restore 40% max HP' },
  bulkhead:  { name: 'Bulkhead',  desc: '+25 max HP, healed on the spot' },
  overclock: { name: 'Overclock', desc: '+10% damage this run' },
  coolant:   { name: 'Coolant',   desc: '−5% cooldowns this run' },
};

// ---------- Towers ----------
// Every tower taps bolt (README pillar 1); identity = stat profile + extra starter.
export const TOWERS = {
  bastion: {
    name: 'Bastion', color: '#4de8ff', hpMult: 1.0, dmgMult: 1.0, xpMult: 1.0,
    start: { bolt: 2 },
    blurb: 'The original Point. Sharper bolt, no gimmicks.',
  },
  tempest: {
    name: 'Tempest', color: '#c06bff', hpMult: 0.8, dmgMult: 1.0, xpMult: 1.1,
    start: { bolt: 1, tesla: 1 },
    blurb: 'Fragile, brilliant. Arrives with a Tesla Coil humming.',
  },
  warden: {
    name: 'Warden', color: '#ffb84d', hpMult: 1.3, dmgMult: 0.9, xpMult: 1.0,
    start: { bolt: 1, nova: 1 },
    blurb: 'Thick plating and a Nova heartbeat. Let them come.',
  },
  lance: {
    name: 'Lance', color: '#ff5c6c', hpMult: 0.85, dmgMult: 1.1, xpMult: 1.0,
    start: { bolt: 1, beam: 1 },
    blurb: 'Glass and fury. Holds the line by holding the screen.',
  },
};

// ---------- Tech tree ----------
// Explicit reqs; structure pinned by test/tech.test.mjs.
export const TECH = [
  // Hull
  { id: 'vit1',   branch: 'Hull', name: 'Vitality I',   desc: '+20 max HP',        cost: 15,  req: [],          effect: { hpBonus: 20 } },
  { id: 'vit2',   branch: 'Hull', name: 'Vitality II',  desc: '+20 max HP',        cost: 30,  req: ['vit1'],    effect: { hpBonus: 20 } },
  { id: 'vit3',   branch: 'Hull', name: 'Vitality III', desc: '+20 max HP',        cost: 60,  req: ['vit2'],    effect: { hpBonus: 20 } },
  { id: 'plate1', branch: 'Hull', name: 'Plating I',    desc: '−8% damage taken',  cost: 40,  req: ['vit1'],    effect: { dmgTakenAdd: -0.08 } },
  { id: 'plate2', branch: 'Hull', name: 'Plating II',   desc: '−8% damage taken',  cost: 80,  req: ['plate1'],  effect: { dmgTakenAdd: -0.08 } },
  { id: 'nano1',  branch: 'Hull', name: 'Nanites I',    desc: '+0.5 HP/s regen',   cost: 35,  req: ['vit1'],    effect: { regen: 0.5 } },
  { id: 'nano2',  branch: 'Hull', name: 'Nanites II',   desc: '+0.5 HP/s regen',   cost: 70,  req: ['nano1'],   effect: { regen: 0.5 } },
  // Arms
  { id: 'over1',  branch: 'Arms', name: 'Overcharge I',   desc: '+8% damage',      cost: 15,  req: [],          effect: { dmgAdd: 0.08 } },
  { id: 'over2',  branch: 'Arms', name: 'Overcharge II',  desc: '+8% damage',      cost: 30,  req: ['over1'],   effect: { dmgAdd: 0.08 } },
  { id: 'over3',  branch: 'Arms', name: 'Overcharge III', desc: '+8% damage',      cost: 60,  req: ['over2'],   effect: { dmgAdd: 0.08 } },
  { id: 'prec',   branch: 'Arms', name: 'Precision',      desc: '10% crit chance (×2)', cost: 50, req: ['over2'], effect: { critChance: 0.1 } },
  { id: 'haste1', branch: 'Arms', name: 'Haste I',        desc: '−6% cooldowns',   cost: 40,  req: ['over1'],   effect: { cdAdd: -0.06 } },
  { id: 'haste2', branch: 'Arms', name: 'Haste II',       desc: '−6% cooldowns',   cost: 80,  req: ['haste1'],  effect: { cdAdd: -0.06 } },
  // Mind
  { id: 'study1', branch: 'Mind', name: 'Quick Study I',  desc: '+10% XP',         cost: 15,  req: [],          effect: { xpAdd: 0.1 } },
  { id: 'study2', branch: 'Mind', name: 'Quick Study II', desc: '+10% XP',         cost: 35,  req: ['study1'],  effect: { xpAdd: 0.1 } },
  { id: 'head',   branch: 'Mind', name: 'Head Start',     desc: 'Start at level 2 with a free pick', cost: 45, req: ['study1'], effect: { startLevelAdd: 1 } },
  { id: 'salv1',  branch: 'Mind', name: 'Salvage I',      desc: '+20% shards',     cost: 30,  req: ['study1'],  effect: { salvageAdd: 0.2 } },
  { id: 'salv2',  branch: 'Mind', name: 'Salvage II',     desc: '+20% shards',     cost: 60,  req: ['salv1'],   effect: { salvageAdd: 0.2 } },
  // Arsenal
  { id: 'tesla',  branch: 'Arsenal', name: 'Tesla Coil', desc: 'Adds Tesla Coil to the level-up pool', cost: 25, req: [],        effect: { unlockWeapon: 'tesla' } },
  { id: 'seek',   branch: 'Arsenal', name: 'Seekers',    desc: 'Adds Seekers to the level-up pool',    cost: 45, req: ['tesla'], effect: { unlockWeapon: 'seek' } },
  { id: 'turret', branch: 'Arsenal', name: 'Turrets',    desc: 'Adds Turrets to the level-up pool',    cost: 70, req: ['seek'],  effect: { unlockWeapon: 'turret' } },
  // Towers
  { id: 'tower_tempest', branch: 'Towers', name: 'Tempest', desc: 'Unlock the Tempest tower', cost: 40,  req: [],                effect: { unlockTower: 'tempest' } },
  { id: 'tower_warden',  branch: 'Towers', name: 'Warden',  desc: 'Unlock the Warden tower',  cost: 75,  req: ['tower_tempest'], effect: { unlockTower: 'warden' } },
  { id: 'tower_lance',   branch: 'Towers', name: 'Lance',   desc: 'Unlock the Lance tower',   cost: 120, req: ['tower_warden'],  effect: { unlockTower: 'lance' } },
];
