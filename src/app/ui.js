// DOM overlays + HUD. Reads core tables directly; all game actions go through
// hooks injected by main.js (no circular imports, no rules in here).
import { TOWERS, TECH, WEAPONS, GENERICS, ENEMIES, VARIANTS, ACHIEVEMENTS } from '../core/config.js';
import { towerUnlocked } from '../core/state.js';
import { canBuy } from '../core/tech.js';
import { storageOk } from './meta.js';
import { poly } from './render.js';

const $ = id => document.getElementById(id);
const OVERLAYS = ['menu', 'tech', 'bestiary', 'records', 'levelup', 'pause', 'over'];
const BRANCHES = ['Hull', 'Arms', 'Mind', 'Arsenal', 'Towers'];

let H = null; // hooks

export function initUI(G, hooks) {
  H = hooks;
  $('startBtn').addEventListener('click', () => H.onStart());
  $('techBtn').addEventListener('click', () => { renderTech(G); showOnly('tech'); });
  $('bestBtn').addEventListener('click', () => { renderBestiary(G); showOnly('bestiary'); });
  $('bestBack').addEventListener('click', () => { renderMenu(G); showOnly('menu'); });
  $('recBtn').addEventListener('click', () => { renderRecords(G); showOnly('records'); });
  $('recBack').addEventListener('click', () => { renderMenu(G); showOnly('menu'); });
  $('techBack').addEventListener('click', () => { renderMenu(G); showOnly(G.returnTo || 'menu'); if (G.returnTo === 'over') renderGameOver(G, G.lastEarned); });
  $('muteBtn').addEventListener('click', () => H.onMute());
  // two-tap reset: arm, then confirm within 4s (app.md "Reset progress")
  let resetArmedUntil = 0;
  $('resetBtn').addEventListener('click', () => {
    if (Date.now() < resetArmedUntil) {
      resetArmedUntil = 0;
      $('resetBtn').textContent = 'RESET PROGRESS';
      H.onReset();
    } else {
      resetArmedUntil = Date.now() + 4000;
      $('resetBtn').textContent = 'REALLY? TAP AGAIN';
      setTimeout(() => {
        if (Date.now() >= resetArmedUntil) $('resetBtn').textContent = 'RESET PROGRESS';
      }, 4100);
    }
  });
  $('pauseBtn').addEventListener('click', () => H.onPause());
  $('resumeBtn').addEventListener('click', () => H.onResume());
  $('abandonBtn').addEventListener('click', () => H.onAbandon());
  $('againBtn').addEventListener('click', () => H.onStart());
  $('overTechBtn').addEventListener('click', () => { G.returnTo = 'over'; renderTech(G); showOnly('tech'); });
  $('overMenuBtn').addEventListener('click', () => { G.returnTo = 'menu'; renderMenu(G); showOnly('menu'); });
}

export function showOnly(name) {
  for (const id of OVERLAYS) $(id).classList.toggle('hidden', id !== name);
  $('hud').classList.toggle('hidden', name !== null && name !== 'pause');
}

export function renderMenu(G) {
  G.returnTo = 'menu';
  const m = G.meta;
  $('menuStats').innerHTML =
    `<span class="shards">◆ ${m.shards}</span> shards · best wave <b>${m.best}</b>`;
  $('muteBtn').textContent = m.sound ? '🔊 SOUND ON' : '🔇 SOUND OFF';
  $('storageWarn').classList.toggle('hidden', storageOk);
  if (!towerUnlocked(m, m.tower)) m.tower = 'bastion';

  const row = $('towerRow');
  row.innerHTML = '';
  for (const [id, t] of Object.entries(TOWERS)) {
    const unlocked = towerUnlocked(m, id);
    const el = document.createElement('button');
    el.className = 'tower' + (id === m.tower ? ' selected' : '') + (unlocked ? '' : ' locked');
    el.style.color = t.color;
    const starts = Object.entries(t.start)
      .map(([w, l]) => `${WEAPONS[w].name}${l > 1 ? ' II' : ''}`).join(' + ');
    el.innerHTML =
      `<span class="tname" style="color:${t.color}">${t.name}</span>` +
      `<span class="tblurb">${t.blurb}</span>` +
      `<span class="tstart">${unlocked ? starts : '🔒 unlock in Tech Tree'}</span>`;
    el.addEventListener('click', () => { if (unlocked) { m.tower = id; H.onMetaChanged(); renderMenu(G); } });
    row.appendChild(el);
  }
}

export function renderTech(G) {
  const m = G.meta;
  $('techShards').textContent = `◆ ${m.shards}`;
  const grid = $('techGrid');
  grid.innerHTML = '';
  for (const branch of BRANCHES) {
    const col = document.createElement('div');
    col.className = 'branch';
    col.innerHTML = `<h3>${branch.toUpperCase()}</h3>`;
    for (const n of TECH.filter(n => n.branch === branch)) {
      const owned = m.tech.includes(n.id);
      const buyable = canBuy(n.id, m.tech, m.shards);
      const reqsMet = n.req.every(r => m.tech.includes(r));
      const el = document.createElement('button');
      el.className = 'node ' + (owned ? 'owned' : buyable ? 'avail' : reqsMet ? 'poor' : 'locked');
      const reqNames = n.req.filter(r => !m.tech.includes(r))
        .map(r => TECH.find(x => x.id === r)?.name).join(', ');
      el.innerHTML =
        `<span class="nname">${n.name}</span>` +
        `<span class="ndesc">${n.desc}</span>` +
        `<span class="ncost">${owned ? 'OWNED' : reqsMet ? `◆ ${n.cost}` : `needs ${reqNames}`}</span>`;
      if (buyable) el.addEventListener('click', () => { H.onBuy(n.id); renderTech(G); });
      col.appendChild(el);
    }
    grid.appendChild(col);
  }
}

// ---------- bestiary ----------
function drawSpecimen(cv, sides, color, variantId) {
  const ctx = cv.getContext('2d');
  const c = 24, r = 13;
  ctx.clearRect(0, 0, 48, 48);
  const v = variantId ? VARIANTS[variantId] : null;
  if (variantId === 'swift') { ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 10; }
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = color;
  poly(ctx, c, c, r, sides, -Math.PI / 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (variantId === 'armored') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 3;
    poly(ctx, c, c, r + 4, sides, -Math.PI / 2); ctx.stroke();
  }
  if (variantId === 'volatile') {
    ctx.fillStyle = v.color;
    ctx.beginPath(); ctx.arc(c, c, r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  if (variantId === 'regen') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(c, c, r + 5, 0, Math.PI * 2); ctx.stroke();
  }
  if (variantId === 'shielded') {
    ctx.strokeStyle = v.color; ctx.lineWidth = 2;
    for (let s = 0; s < 3; s++) {
      const a0 = 0.4 + (s * Math.PI * 2) / 3;
      ctx.beginPath(); ctx.arc(c, c, r + 5, a0, a0 + Math.PI * 2 / 4.2); ctx.stroke();
    }
  }
}

function bestiaryCard(known, iconArgs, name, stats, lore, color) {
  const el = document.createElement('div');
  if (!known) {
    el.className = 'bcard unknown';
    el.innerHTML = `<span class="bq">?</span><span class="blore">undiscovered</span>`;
    return el;
  }
  el.className = 'bcard';
  el.innerHTML =
    `<span class="bhead"><canvas width="48" height="48"></canvas>` +
    `<span class="bname" style="color:${color}">${name}</span></span>` +
    `<span class="bstats">${stats}</span>` +
    `<span class="blore">${lore}</span>`;
  drawSpecimen(el.querySelector('canvas'), ...iconArgs);
  return el;
}

export function renderBestiary(G) {
  const seen = G.meta.seen;
  const grid = $('bestGrid');
  grid.innerHTML = '';
  const hs = document.createElement('h3'); hs.textContent = 'SHAPES'; grid.appendChild(hs);
  for (const [id, e] of Object.entries(ENEMIES)) {
    const known = seen.enemies.includes(id);
    grid.appendChild(bestiaryCard(known, [e.sides, e.color, null], e.name,
      `HP ${e.hp} · SPD ${e.spd} · DMG ${e.dmg} · XP ${e.xp}`, e.lore, e.color));
  }
  const hv = document.createElement('h3'); hv.textContent = 'VARIANTS'; grid.appendChild(hv);
  for (const [id, v] of Object.entries(VARIANTS)) {
    const known = seen.variants.includes(id);
    grid.appendChild(bestiaryCard(known, [0, ENEMIES.grunt.color, id], v.name, v.desc, v.lore, v.color));
  }
  $('bestCount').textContent =
    `${seen.enemies.length}/${Object.keys(ENEMIES).length} shapes · ` +
    `${seen.variants.length}/${Object.keys(VARIANTS).length} variants`;
}

// ---------- records ----------
export function renderRecords(G) {
  const m = G.meta;
  const list = $('scoreList');
  list.innerHTML = '<h3>HIGH SCORES</h3>';
  if (!m.scores.length) {
    const row = document.createElement('div');
    row.className = 'scoreRow empty';
    row.textContent = 'No runs on record — the shapes are waiting.';
    list.appendChild(row);
  }
  m.scores.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'scoreRow';
    const t = TOWERS[s.tower];
    row.innerHTML =
      `<span class="srank">${i + 1}.</span>` +
      `<span class="swave">Wave ${s.wave}</span>` +
      `<span class="skills">${s.kills} kills</span>` +
      `<span class="stower" style="color:${t?.color || 'inherit'}">${t?.name || s.tower}</span>`;
    list.appendChild(row);
  });
  const grid = $('achGrid');
  grid.innerHTML = '<h3>ACHIEVEMENTS</h3>';
  for (const a of ACHIEVEMENTS) {
    const owned = m.ach.includes(a.id);
    const el = document.createElement('div');
    el.className = 'achCard' + (owned ? '' : ' locked');
    el.innerHTML = `<span class="aname">${owned ? '🏆 ' : ''}${a.name}</span><span class="adesc">${a.desc}</span>`;
    grid.appendChild(el);
  }
  $('achCount').textContent = `${m.ach.length}/${ACHIEVEMENTS.length}`;
}

/** Queued DOM toast — works over any overlay (app.md). */
export function toast(html) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function loadoutHTML(S) {
  const items = [];
  for (const [id, l] of Object.entries(S.weapons)) {
    if (l < 1) continue;
    const max = l >= WEAPONS[id].max;
    items.push(`<span class="litem"><b>${WEAPONS[id].name}</b> ${max ? '<span class="lmax">MAX</span>' : 'Lv ' + l}</span>`);
  }
  const mods = [];
  if (Math.abs(S.dmgMult - 1) > 1e-9) mods.push(`DMG ×${S.dmgMult.toFixed(2)}`);
  if (Math.abs(S.cdMult - 1) > 1e-9) mods.push(`CD ×${S.cdMult.toFixed(2)}`);
  if (S.critChance > 0) mods.push(`CRIT ${Math.round(S.critChance * 100)}%`);
  if (S.regen > 0) mods.push(`REGEN ${S.regen.toFixed(1)}/s`);
  return items.join('') + (mods.length ? `<span class="lmods">${mods.join(' · ')}</span>` : '');
}

export function renderPause(G) {
  $('pauseLoadout').innerHTML = loadoutHTML(G.S);
}

export function renderLevelUp(G, choices) {
  const S = G.S;
  $('levelupTitle').textContent =
    S.pendingLevels > 1 ? `LEVEL UP — ${S.pendingLevels} picks banked` : 'LEVEL UP';
  $('lvlLoadout').innerHTML = loadoutHTML(S);
  const row = $('cardRow');
  row.innerHTML = '';
  for (const c of choices) {
    const el = document.createElement('button');
    el.className = 'card';
    if (c.type === 'weapon') {
      const w = WEAPONS[c.id];
      const isNew = c.lvl === 0;
      el.innerHTML =
        `<span class="chead"><span class="chip ${isNew ? 'NEW' : w.tag}">${isNew ? 'NEW' : w.tag}</span>` +
        `<span class="cname">${w.name}</span></span>` +
        `<span class="clvl">${isNew ? 'Level 1' : `Lv ${c.lvl} → ${c.lvl + 1}`}</span>` +
        `<span class="cdesc">${w.descs[c.lvl]}</span>`;
    } else {
      const g = GENERICS[c.id];
      el.innerHTML =
        `<span class="chead"><span class="chip GEN">BOOST</span>` +
        `<span class="cname">${g.name}</span></span>` +
        `<span class="cdesc">${g.desc}</span>`;
    }
    el.addEventListener('click', () => H.onChoice(c));
    row.appendChild(el);
  }
}

export function renderGameOver(G, earned, rank = 0) {
  G.lastEarned = earned;
  const S = G.S;
  $('overStats').innerHTML =
    (rank > 0 ? `<b style="color:#ffd24d">HIGH SCORE #${rank}</b><br>` : '') +
    `Wave <b>${S.wave}</b> · ${S.kills} shapes disassembled<br>` +
    `<span class="earned">+◆ ${earned} shards</span><br>` +
    `<span class="dim">◆ ${G.meta.shards} total · best wave ${G.meta.best}</span>`;
}

export function updateHUD(G) {
  const S = G.S;
  if (!S) return;
  if (!G.hudCache) G.hudCache = {};
  const c = G.hudCache;
  const xpPct = Math.round((S.xp / S.xpNext) * 100);
  if (c.xp !== xpPct) { $('xpfill').style.width = xpPct + '%'; c.xp = xpPct; }
  if (c.wave !== S.wave) { $('waveTxt').textContent = 'Wave ' + S.wave; c.wave = S.wave; }
  if (c.lvl !== S.lvl) { $('lvlTxt').textContent = 'Lv ' + S.lvl; c.lvl = S.lvl; }
}
