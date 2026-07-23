// DOM overlays + HUD. Reads core tables directly; all game actions go through
// hooks injected by main.js (no circular imports, no rules in here).
import { TOWERS, TECH, WEAPONS, GENERICS } from '../core/config.js';
import { towerUnlocked } from '../core/state.js';
import { canBuy } from '../core/tech.js';
import { storageOk } from './meta.js';

const $ = id => document.getElementById(id);
const OVERLAYS = ['menu', 'tech', 'levelup', 'pause', 'over'];
const BRANCHES = ['Hull', 'Arms', 'Mind', 'Arsenal', 'Towers'];

let H = null; // hooks

export function initUI(G, hooks) {
  H = hooks;
  $('startBtn').addEventListener('click', () => H.onStart());
  $('techBtn').addEventListener('click', () => { renderTech(G); showOnly('tech'); });
  $('techBack').addEventListener('click', () => { renderMenu(G); showOnly(G.returnTo || 'menu'); if (G.returnTo === 'over') renderGameOver(G, G.lastEarned); });
  $('muteBtn').addEventListener('click', () => H.onMute());
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

export function renderGameOver(G, earned) {
  G.lastEarned = earned;
  const S = G.S;
  $('overStats').innerHTML =
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
