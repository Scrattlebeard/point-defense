// Entry point: boot, mode state machine, frame loop. Wires core decisions to
// shell modules via plain calls + the ui hooks object. Mode transitions all
// happen here — no other module changes G.mode.
import { newRun, levelChoices, applyChoice, payout, defaultMeta, addScore, evalAchievements } from '../core/state.js';
import { buy } from '../core/tech.js';
import { WEAPONS, FORMS } from '../core/config.js';
import { loadMeta, saveMeta } from './meta.js';
import { makeFx, updateFx, settleFx, announce } from './fx.js';
import { setMuted, setHaptics, sfx, haptic } from './audio.js';
import { resetWeapons } from './weapons/index.js';
import { nearestEnemy, spawnEnemy } from './enemies.js';
import { resetWaveDirector, updateGame } from './game.js';
import { initInput, updateInput, clearInput } from './input.js';
import { renderFrame } from './render.js';
import { makePerf, samplePerf } from '../core/perf.js';
import { drawPerfHud } from './perfhud.js';
import * as ui from './ui.js';

const canvas = document.getElementById('field');
const G = {
  canvas, ctx: canvas.getContext('2d'),
  W: 0, H: 0, cx: 0, cy: 0,
  mode: 'menu',
  meta: loadMeta(),
  S: null, fx: makeFx(), wt: null, wd: null,
  traces: new Map(),
};
setMuted(!G.meta.sound);
setHaptics(G.meta.haptics !== false);

// Dev hatch: ?perf turns on the frame-time overlay (app.md, core/perf.md).
// Off by default and costs nothing when off — `G.perf` stays null and the
// sampler is never called, so the instrument cannot tax normal play.
if (location.search.includes('perf')) G.perf = makePerf();

const PHONE_ZOOM = 0.75; // app.md "Phone zoom (out)" — more arena on small screens
const MAX_FIELD = { w: 1400, h: 1000 }; // app.md "Field size cap" — screen size must not be a difficulty setting

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const zoom = Math.min(window.innerWidth, window.innerHeight) < 600
    ? PHONE_ZOOM
    : Math.max(1, window.innerWidth / MAX_FIELD.w, window.innerHeight / MAX_FIELD.h);
  G.zoom = zoom;
  G.W = window.innerWidth / zoom; G.H = window.innerHeight / zoom;
  G.cx = G.W / 2; G.cy = G.H / 2;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  G.ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0);
  G.hudScale = dpr; // the perf overlay pins to device pixels (perfhud.js)
}
window.addEventListener('resize', resize);
resize();

// ---------- run lifecycle ----------
function startRun() {
  G.S = newRun(G.meta, G.meta.tower);
  G.fx = makeFx();
  G.hudCache = null;
  resetWeapons(G);
  resetWaveDirector(G);
  clearInput(G);
  G.mode = 'play';
  ui.showOnly(null);
  ui.updateHUD(G);
  announce(G.fx, 'DEFEND THE POINT', '#4de8ff');
}

function openLevelUp() {
  G.mode = 'levelup';
  G.currentChoices = levelChoices(G.S, Math.random);
  ui.renderLevelUp(G, G.currentChoices);
  ui.showOnly('levelup');
  sfx('levelup');
}

function finishRun() {
  const { meta: paid, earned } = payout(G.S, G.meta);
  const { meta: scored, rank } = addScore(paid, {
    wave: G.S.wave, kills: G.S.kills, tower: G.S.towerId, ts: Date.now(),
  });
  G.meta = scored;
  announceAchievements(G.S);
  saveMeta(G.meta);
  G.mode = 'over';
  clearInput(G);
  sfx('gameover');
  haptic('gameover');
  ui.renderGameOver(G, earned, rank);
  ui.showOnly('over');
}

/** Evaluate achievements after any meta change; toast the new ones. */
function announceAchievements(S = null) {
  const { meta, unlocked } = evalAchievements(G.meta, S);
  G.meta = meta;
  for (const a of unlocked) {
    ui.toast(`🏆 <b>${a.name}</b> — ${a.desc}`);
    sfx('discover');
  }
}

function pauseGame() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  clearInput(G);
  ui.renderPause(G);
  ui.showOnly('pause');
}

// ---------- ui hooks ----------
ui.initUI(G, {
  onStart: () => startRun(),
  onPause: () => pauseGame(),
  onResume: () => { if (G.mode === 'pause') { G.mode = 'play'; ui.showOnly(null); } },
  onAbandon: () => finishRun(),
  onChoice: c => {
    applyChoice(G.S, c);
    G.S.pendingLevels--;
    if (G.S.pendingLevels > 0) openLevelUp();
    else { G.mode = 'play'; ui.showOnly(null); }
  },
  onBuy: id => {
    G.meta = buy(id, G.meta);
    announceAchievements();
    saveMeta(G.meta);
  },
  onMute: () => {
    G.meta.sound = !G.meta.sound;
    setMuted(!G.meta.sound);
    saveMeta(G.meta);
    ui.renderMenu(G);
  },
  onHaptics: () => {
    G.meta.haptics = G.meta.haptics === false;
    setHaptics(G.meta.haptics);
    saveMeta(G.meta);
    ui.renderMenu(G);
  },
  // Fullscreen must be requested inside the user gesture that asked for it, so
  // this stays a direct click handler. The promise rejects when the browser
  // declines (iOS Safari has no API at all — ui.js hides the button there);
  // swallow it and re-render, because the label reads document.fullscreenElement.
  onFullscreen: () => {
    const done = () => ui.renderMenu(G);
    if (document.fullscreenElement) document.exitFullscreen().then(done, done);
    else document.documentElement.requestFullscreen().then(done, done);
  },
  onMetaChanged: () => saveMeta(G.meta),
  onReset: () => {
    G.meta = defaultMeta();
    saveMeta(G.meta);
    ui.renderMenu(G);
  },
});

initInput(G, canvas);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// The button's label is derived from document.fullscreenElement, and fullscreen
// can end without the button (Esc, the system back gesture) — so re-render on the
// event, not only on our own click, or the label lies.
document.addEventListener('fullscreenchange', () => {
  if (G.mode === 'menu') ui.renderMenu(G);
});

// ---------- frame loop ----------
let last = performance.now();
function loop(now) {
  // clamp BOTH ends: rAF timestamps can run backward vs performance.now()
  // (seen in headless Firefox), and negative dt turns every "decay toward
  // zero" (enemy flash, cooldowns) into a generator. Sim time never rewinds.
  const dt = Math.max(0, Math.min(0.033, (now - last) / 1000));
  // Frame time is measured as the gap between rAF callbacks, NOT as the time our
  // own work takes: the browser's compositing and rasterisation happen after we
  // return, and those are exactly where a canvas game on a phone spends its
  // budget. Timing only our JS would report a comfortable number while the player
  // watches judder (core/perf.md "What this cannot tell you").
  const frameMs = now - last;
  last = now;
  const workT0 = G.perf ? performance.now() : 0;
  if (G.mode === 'play' && !G.frozen) {
    updateInput(G);
    const sig = updateGame(G, dt);
    updateFx(G.fx, dt);
    ui.updateHUD(G);
    if (sig === 'over') finishRun();
    else if (sig === 'levelup') openLevelUp();
  } else {
    // Sim is frozen behind an overlay, but camera juice still settles —
    // a paused field must not keep shaking (fx.js settleFx, app.md).
    settleFx(G.fx, dt);
  }
  renderFrame(G);
  if (G.perf) {
    samplePerf(G.perf, frameMs, {
      wave: G.S ? G.S.wave : 0,
      ents: G.S ? G.S.enemies.length : 0,
      parts: G.fx ? G.fx.parts.length : 0,
      // measured BEFORE the HUD draws itself: an instrument must not bill the
      // player for its own overlay (core/perf.md)
      work: performance.now() - workT0,
    });
    drawPerfHud(G);
  }
  requestAnimationFrame(loop);
}

ui.renderMenu(G);
ui.showOnly('menu');
// Dev/smoke hatch: ?lattice opens the Lattice directly; &shards=N fakes a
// balance (in-memory only) so node states are photographable.
if (location.search.includes('lattice')) {
  const sm = location.search.match(/shards=(\d+)/);
  if (sm) G.meta.shards = Number(sm[1]);
  ui.renderTech(G);
  ui.showOnly('tech');
}
// Dev/smoke hatch: ?bestiary opens a fully-revealed bestiary (in-memory only).
if (location.search.includes('bestiary')) {
  import('../core/config.js').then(({ ENEMIES, VARIANTS }) => {
    G.meta.seen = { enemies: Object.keys(ENEMIES), variants: Object.keys(VARIANTS) };
    ui.renderBestiary(G);
    ui.showOnly('bestiary');
  });
}
// Dev hatches: ?over and ?records photograph the two remaining click-gated
// screens. Both are IN-MEMORY ONLY — they never call saveMeta, because a dev
// hatch that clobbers a real save is a worse bug than the ones it finds.
if (location.search.includes('over')) {
  startRun();
  Object.assign(G.S, { wave: 23, kills: 1147, bossKills: 4 });
  // a plausible ledger so the breakdown is photographable
  G.S.dmgBy = { bolt: 41200, nova: 18400, frost: 900, tesla: 12100, orbit: 7300, other: 2600 };
  const { earned } = payout(G.S, G.meta);
  G.meta = { ...G.meta, shards: G.meta.shards + earned, best: Math.max(G.meta.best, 23) };
  ui.renderGameOver(G, earned, 2);
  ui.showOnly('over');
  G.frozen = true;
}
if (location.search.includes('records')) {
  G.meta = {
    ...G.meta,
    scores: [
      { wave: 31, kills: 1810, tower: 'lance', ts: 0 },
      { wave: 23, kills: 1147, tower: 'bastion', ts: 0 },
      { wave: 12, kills: 402, tower: 'warden', ts: 0 },
    ],
    ach: ['first', 'regicide', 'wave5', 'wave10', 'wave20', 'kills500'],
  };
  ui.renderRecords(G);
  ui.showOnly('records');
  G.frozen = true;
}

// Dev hatch: ?pause opens the pause panel on a furnished run — the other loadout
// surface that needs a click to reach, so it had never been photographed either.
if (location.search.includes('pause')) {
  startRun();
  Object.assign(G.S.weapons, { bolt: WEAPONS.bolt.max, beam: 3, orbit: 2, frost: 4 });
  G.S.forms.bolt = 'fan';   // a worn form must show here too (core.md Forms)
  G.S.wave = 12; G.S.lvl = 14; G.S.kills = 233;
  ui.renderPause(G);
  ui.showOnly('pause');
  G.frozen = true;
}

// Dev hatch: ?cards opens the level-up screen showing one of EVERY card type at
// once — a new weapon, an upgrade, a generic, and a form. Card markup is otherwise
// only reachable by playing to a level-up with the right run state (a form card
// needs a maxed base weapon AND an unlocked-but-unworn form), which is why these
// had never been looked at (app.md "Level-up cards").
if (location.search.includes('cards')) {
  startRun();
  const S = G.S;
  S.weapons.bolt = WEAPONS.bolt.max;   // so the form is eligible
  S.formPool.add('fan');               // unlocked, deliberately NOT worn
  S.hp = S.maxHp * 0.4;                // so Repair is offered rather than filtered
  ui.renderLevelUp(G, [
    { type: 'weapon', id: 'orbit', lvl: 0 },   // NEW
    { type: 'weapon', id: 'bolt', lvl: 4 },    // upgrade
    { type: 'form', id: 'fan', of: 'bolt' },   // form
    { type: 'generic', id: 'repair' },         // passive
  ]);
  ui.showOnly('levelup');
  // cards deal in with a staggered animation and `backwards` fill, so an
  // unmodified screenshot catches them before their turn and photographs an
  // empty row. A plate has to be static to be a plate.
  document.getElementById('levelup').classList.remove('dealing');
  for (const el of document.querySelectorAll('#cardRow .card')) el.style.animation = 'none';
  G.frozen = true;
}

// Dev hatch: ?specimen lays out stacked-variant specimens on a frozen field so
// the highlight grammar can be photographed (app.md "Stacked highlights"). This
// is the tool the legibility check is supposed to use — eyeballing a live wave-40
// fight is exactly how the channel collisions got shipped in the first place.
//   ?specimen           — every single + every pair (the collision-prone set)
//   ?specimen=triples   — every three-way stack
//   ?specimen=armored+regen,swift+volatile — explicit combos
//   &kind=dart          — silhouette to wear them (default dart: the smallest,
//                         so it is the worst case for outer-annulus crowding)
const specimenMatch = location.search.match(/specimen(?:=([\w+,]+))?/);
if (specimenMatch) {
  const V = ['swift', 'armored', 'regen', 'shielded', 'volatile'];
  const arg = specimenMatch[1];
  let combos;
  if (!arg) {
    combos = V.map(v => [v]);
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) combos.push([V[i], V[j]]);
  } else if (arg === 'triples') {
    combos = [];
    for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++)
      for (let k = j + 1; k < V.length; k++) combos.push([V[i], V[j], V[k]]);
  } else {
    combos = arg.split(',').map(c => c.split('+').filter(Boolean));
  }
  const kind = (location.search.match(/kind=(\w+)/) || [])[1] || 'dart';
  // ?specimen=siege — the strike telegraph staged around the rim, one shape per
  // phase of the 0.9s cadence plus one mid-strike. The tell is a ~0.25s window,
  // so a live screenshot almost always lands in the quiet part of the cycle;
  // this is the only way to actually look at it (app.md "A besieger telegraphs").
  startRun();
  G.S.wave = 45; // past the regime wave, so the stacks are honest ones
  // suppress the tutorial layer BEFORE spawning: intro banners and their dashed
  // rings would otherwise cover the plate we came here to read
  G.S.introduced.variants = new Set(V);
  G.S.introduced.enemies = new Set(['grunt', 'dart', 'tank', 'splitter', 'elite', 'boss']);
  G.S.introduced.stacked = true; // the regime beat too — this is a plate, not a run
  if (arg === 'siege') {
    // the strike telegraph staged around the rim: one shape per phase of the
    // 0.9s cadence, plus one caught mid-blow. The tell is a ~0.25s window, so a
    // live screenshot almost always lands in the quiet part of the cycle — this
    // is the only way to actually look at it (app.md "A besieger telegraphs").
    const phases = [0.9, 0.6, 0.35, 0.2, 0.1, 0];
    phases.forEach((cd, i) => {
      const a = -Math.PI / 2 + (i / phases.length) * Math.PI * 2;
      const e = spawnEnemy(G, kind, null, G.cx, G.cy - 200);
      e.spd = 0;
      const rim = e.r + 24;
      e.x = G.cx + Math.cos(a) * rim;
      e.y = G.cy + Math.sin(a) * rim;
      e.sieging = true;
      e.contactCd = cd;
      if (cd === 0) e.strike = 1;
    });
    G.frozen = true;
  } else {
  const cols = Math.ceil(Math.sqrt(combos.length * (G.W / G.H) * 1.6)) || 1;
  const rows = Math.ceil(combos.length / cols);
  combos.forEach((combo, i) => {
    const cx = ((i % cols) + 0.5) * (G.W / cols);
    const cy = ((Math.floor(i / cols)) + 0.7) * (G.H / rows);
    const e = spawnEnemy(G, kind, combo, cx, cy);
    e.hp = e.maxHp * 0.6; // damaged: the hp sliver joins the composition
    e.spd = 0;
  });
  G.frozen = true;
  }
}

// Dev/smoke-test hatches: ?autostart skips the menu; ?turbo pre-simulates ~40s
// (auto-picking level-ups) so a headless screenshot lands mid-battle; ?warp=N
// pre-simulates exactly N seconds instead.
const warpMatch = location.search.match(/warp=(\d+)/);
if (location.search.includes('autostart')) {
  startRun();
  // &gear=frost:4,orbit:2 — grant weapon levels for visual dev (README dev hatches)
  const gearMatch = location.search.match(/gear=([\w:,]+)/);
  if (gearMatch) for (const kv of gearMatch[1].split(',')) {
    const [id, l] = kv.split(':');
    if (WEAPONS[id]) G.S.weapons[id] = Math.min(WEAPONS[id].max, Number(l) || 1);
  }
  // &form=bolt:fan — wear a form without grinding to it. Forms need a maxed base
  // weapon, so without this the only way to photograph one is a full run.
  const formMatch = location.search.match(/form=([\w:,]+)/);
  if (formMatch) for (const kv of formMatch[1].split(',')) {
    const [of, id] = kv.split(':');
    if (FORMS[id] && FORMS[id].of === of) {
      G.S.weapons[of] = WEAPONS[of].max;
      G.S.formPool.add(id);
      G.S.forms[of] = id;
    }
  }
  if (location.search.includes('turbo') || warpMatch) {
    let tapT = 0;
    const bot = location.search.includes('turbo'); // warp alone = time passes, nobody aims
    const frames = warpMatch ? Number(warpMatch[1]) * 60 : 2400;
    for (let i = 0; i < frames; i++) {
      tapT -= 1 / 60;
      if (bot && tapT <= 0) {
        const e = nearestEnemy(G.S, G.cx, G.cy);
        if (e) { G.aim = { x: e.x, y: e.y }; tapT = 0.2; }
      }
      const sig = updateGame(G, 1 / 60);
      updateFx(G.fx, 1 / 60);
      // ?perf during a pre-sim: draw and time every frame, so the load event
      // fires with a full by-wave table already populated. This is the only way
      // to get a REAL-RASTERISER cost curve out of a headless screenshot, which
      // otherwise catches ~3 frames of startup. It measures draw cost, NOT frame
      // rate — there is no vsync or compositing here (core/perf.md).
      if (G.perf) {
        const t0 = performance.now();
        renderFrame(G);
        samplePerf(G.perf, performance.now() - t0, {
          wave: G.S.wave, ents: G.S.enemies.length, parts: G.fx.parts.length,
        });
      }
      if (sig === 'levelup') {
        while (G.S.pendingLevels > 0) {
          const cs = levelChoices(G.S, Math.random);
          applyChoice(G.S, cs[0]);
          G.S.pendingLevels--;
        }
      } else if (sig === 'over') break;
    }
  }
}
requestAnimationFrame(loop);
