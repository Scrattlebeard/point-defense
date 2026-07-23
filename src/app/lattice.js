// The Lattice view (app.md `lattice.js` row, ADR-0003 stage 1): renders LATTICE
// as a radial SVG web — the Point at center, six sector wedges, ring guides at
// cost tiers. Pure view: all purchases go through the hooks object (onBuy), the
// same contract ui.js uses. Pan/zoom state lives here and survives re-renders.
import { LATTICE } from '../core/config.js';
import { canBuy, reqsMet } from '../core/tech.js';

const NS = 'http://www.w3.org/2000/svg';
const SECTOR_ORDER = ['Hull', 'Arms', 'Mind', 'Salvage', 'Arsenal', 'Towers'];
const SECTOR_COLOR = {
  Hull: '#59ff9c', Arms: '#ff5c6c', Mind: '#c06bff',
  Salvage: '#ffd24d', Arsenal: '#4de8ff', Towers: '#ff9c59',
};
const RING_R = [0, 120, 200, 280, 360, 440];
const VIEW = 1000; // viewBox half-extent × 2

// ---- computed layout: sector wedge + ring radius + even spread (app.md) ----
const POS = new Map();
{
  const bySR = new Map();
  for (const n of LATTICE) {
    const k = `${n.sector}:${n.ring}`;
    if (!bySR.has(k)) bySR.set(k, []);
    bySR.get(k).push(n);
  }
  const span = (Math.PI * 2) / SECTOR_ORDER.length;
  const pad = 0.12; // wedge-edge margin (radians)
  for (const [, nodes] of bySR) {
    nodes.forEach((n, i) => {
      const si = SECTOR_ORDER.indexOf(n.sector);
      const start = -Math.PI / 2 + si * span + pad;
      const width = span - 2 * pad;
      const a = start + ((i + 1) / (nodes.length + 1)) * width;
      // radial stagger inside crowded cells so neighbors never collide
      const r = RING_R[n.ring] + (nodes.length > 1 ? (i % 2 === 0 ? -17 : 17) : 0);
      POS.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
    });
  }
}

// ---- pan/zoom state (module-scoped: survives re-renders, resets per session) ----
const view = { x: 0, y: 0, k: 1 };
let selectedId = null;
let wired = false;
let zoomInit = false; // first render adapts k to the viewport (phones start closer)

const el = (tag, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

function nodeState(n, meta) {
  const owned = meta.tech.includes(n.id);
  if (owned) return 'owned';
  if (!reqsMet(n, new Set(meta.tech))) return 'locked';
  return meta.shards >= n.cost ? 'avail' : 'poor';
}

export function renderLattice(G, hooks) {
  const svg = document.getElementById('latticeSvg');
  svg.setAttribute('viewBox', `${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}`);
  if (!zoomInit) {
    // phones start zoomed to the inner rings; desktops see the whole web
    const w = svg.getBoundingClientRect().width || window.innerWidth;
    view.k = Math.min(2.2, Math.max(1, 780 / w));
    zoomInit = true;
  }
  svg.innerHTML = '';
  const pan = el('g', { id: 'latPan' });
  svg.appendChild(pan);
  applyView(pan);

  // ring guides
  for (let r = 1; r < RING_R.length; r++) {
    pan.appendChild(el('circle', {
      cx: 0, cy: 0, r: RING_R[r], class: 'latRing', fill: 'none',
    }));
  }

  // sector labels at the rim
  SECTOR_ORDER.forEach((s, si) => {
    const a = -Math.PI / 2 + (si + 0.5) * (Math.PI * 2 / 6);
    const t = el('text', {
      x: Math.cos(a) * 478, y: Math.sin(a) * 478,
      class: 'latSector', fill: SECTOR_COLOR[s],
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
    });
    t.textContent = s.toUpperCase();
    pan.appendChild(t);
  });

  // edges under nodes; dashed for any-mode cross-links
  for (const n of LATTICE) {
    const p = POS.get(n.id);
    for (const r of n.req) {
      const q = POS.get(r);
      if (!q) continue;
      const bothOwned = G.meta.tech.includes(n.id) && G.meta.tech.includes(r);
      const line = el('line', {
        x1: q.x, y1: q.y, x2: p.x, y2: p.y,
        class: 'latEdge' + (bothOwned ? ' lit' : '') + (n.reqMode === 'any' ? ' any' : ''),
      });
      pan.appendChild(line);
    }
  }

  // the Point at center
  const hub = el('g', { class: 'latHub' });
  for (const [r, w] of [[26, 3], [16, 2.4], [7, 2]]) {
    hub.appendChild(el('circle', { cx: 0, cy: 0, r, fill: 'none', stroke: '#4de8ff', 'stroke-width': w }));
  }
  pan.appendChild(hub);

  // nodes
  for (const n of LATTICE) {
    const p = POS.get(n.id);
    const state = nodeState(n, G.meta);
    const color = SECTOR_COLOR[n.sector];
    const g = el('g', {
      class: `latNode ${state}`, transform: `translate(${p.x} ${p.y})`,
      'data-id': n.id, style: `--sec:${color}`,
    });
    const r = n.ring >= 5 ? 21 : 16;
    g.appendChild(el('circle', { r, class: 'latDot' }));
    const label = el('text', { y: r + 13, class: 'latLabel', 'text-anchor': 'middle' });
    label.textContent = n.name;
    g.appendChild(label);
    const cost = el('text', { y: 4, class: 'latCost', 'text-anchor': 'middle' });
    cost.textContent = state === 'owned' ? '✓' : n.cost;
    g.appendChild(cost);
    if (n.id === selectedId) g.classList.add('selected');
    g.addEventListener('click', ev => {
      if (dragMoved) return;
      ev.stopPropagation();
      selectedId = n.id;
      renderLattice(G, hooks);
    });
    pan.appendChild(g);
  }

  renderCard(G, hooks);
  wireGestures(svg, pan, () => renderCard(G, hooks));
}

function renderCard(G, hooks) {
  const card = document.getElementById('nodeCard');
  const n = LATTICE.find(x => x.id === selectedId);
  if (!n) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  const state = nodeState(n, G.meta);
  const missing = state === 'locked'
    ? n.req.filter(r => !G.meta.tech.includes(r)).map(r => LATTICE.find(x => x.id === r)?.name)
    : [];
  const reqTxt = missing.length
    ? `needs ${n.reqMode === 'any' ? 'one of: ' : ''}${missing.join(', ')}`
    : '';
  card.innerHTML =
    `<div class="ncTitle" style="color:${SECTOR_COLOR[n.sector]}">${n.name}</div>` +
    `<div class="ncDesc">${n.desc}</div>` +
    `<div class="ncFoot">` +
    (state === 'owned'
      ? '<span class="ncOwned">OWNED</span>'
      : `<span class="shards">◆ ${n.cost}</span>` +
        (reqTxt ? `<span class="ncReq">${reqTxt}</span>`
                : `<button id="ncBuy" class="small primary" ${state === 'avail' ? '' : 'disabled'}>BUY</button>`)) +
    `</div>`;
  const buy = document.getElementById('ncBuy');
  if (buy) buy.addEventListener('click', () => {
    if (canBuy(n.id, G.meta.tech, G.meta.shards)) hooks.onBuy(n.id);
  });
}

// ---- pan / pinch / wheel ----
let dragMoved = false;
function applyView(pan) {
  pan.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
}
function wireGestures(svg, pan, onTapBg) {
  if (wired) { applyView(pan); return; }
  wired = true;
  const pointers = new Map();
  let pinchD = 0;
  const unit = () => VIEW / svg.getBoundingClientRect().width; // px → viewBox units

  svg.addEventListener('pointerdown', ev => {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    dragMoved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    }
    svg.setPointerCapture(ev.pointerId);
  });
  svg.addEventListener('pointermove', ev => {
    const prev = pointers.get(ev.pointerId);
    if (!prev) return;
    const cur = { x: ev.clientX, y: ev.clientY };
    if (pointers.size === 1) {
      const dx = (cur.x - prev.x) * unit(), dy = (cur.y - prev.y) * unit();
      if (Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y) > 3) dragMoved = true;
      view.x += dx; view.y += dy;
      applyView(document.getElementById('latPan'));
    } else if (pointers.size === 2) {
      pointers.set(ev.pointerId, cur);
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD > 0) {
        view.k = Math.min(3, Math.max(0.5, view.k * (d / pinchD)));
        applyView(document.getElementById('latPan'));
      }
      pinchD = d;
      dragMoved = true;
      return;
    }
    pointers.set(ev.pointerId, cur);
  });
  const up = ev => { pointers.delete(ev.pointerId); pinchD = 0; };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('click', () => {
    if (!dragMoved && selectedId !== null) { selectedId = null; onTapBg(); }
  });
  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    view.k = Math.min(3, Math.max(0.5, view.k * (ev.deltaY < 0 ? 1.12 : 0.89)));
    applyView(document.getElementById('latPan'));
  }, { passive: false });
}
