// The Lattice view (app.md `lattice.js` row, ADR-0003 stage 1, ADR-0005): renders
// LATTICE as a horizontal rectilinear circuit — hub at the left, one column per
// ring (cost tier), sectors as horizontal bands, right-angle elbow edges. Pure
// view: all purchases go through the hooks object (onBuy), the same contract
// ui.js uses. Pan/zoom state lives here and survives re-renders.
import { LATTICE } from '../core/config.js';
import { canBuy, reqsMet } from '../core/tech.js';

const NS = 'http://www.w3.org/2000/svg';
// seven sectors since ADR-0004 (Armory: manual/aim weapon unlocks)
const SECTOR_ORDER = ['Hull', 'Arms', 'Mind', 'Salvage', 'Arsenal', 'Armory', 'Towers'];
const SECTOR_COLOR = {
  Hull: '#59ff9c', Arms: '#ff5c6c', Mind: '#c06bff',
  Salvage: '#ffd24d', Arsenal: '#4de8ff', Armory: '#ff7fb0', Towers: '#ff9c59',
};
const COL_W = 185; // one column per ring, left→right (ADR-0005)
const PITCH = 58;  // vertical pitch between nodes inside a (sector, ring) cell
const VIEW = 1000; // viewBox half-extent × 2

// ---- computed layout: ring column × sector band + even spread (app.md) ----
const POS = new Map();
const BANDS = []; // per-sector { y, half } — band centers and half-heights
const X0 = -(5 * COL_W) / 2; // hub column; ring r sits at X0 + r*COL_W
let Y0 = 0, Y1 = 0; // vertical extent of the band stack
{
  const bySR = new Map();
  for (const n of LATTICE) {
    const k = `${n.sector}:${n.ring}`;
    if (!bySR.has(k)) bySR.set(k, []);
    bySR.get(k).push(n);
  }
  // band height from the sector's most crowded cell — computed, never hand-tuned
  for (const s of SECTOR_ORDER) {
    let m = 1;
    for (const [k, v] of bySR) if (k.startsWith(s + ':')) m = Math.max(m, v.length);
    BANDS.push({ y: 0, half: ((m - 1) * PITCH) / 2 + 48 });
  }
  const total = BANDS.reduce((a, b) => a + 2 * b.half, 0);
  let y = -total / 2;
  Y0 = y; Y1 = total / 2;
  for (const b of BANDS) { b.y = y + b.half; y += 2 * b.half; }
  for (const [k, nodes] of bySR) {
    const [sector, ring] = k.split(':');
    const band = BANDS[SECTOR_ORDER.indexOf(sector)];
    nodes.forEach((n, i) => {
      POS.set(n.id, {
        // x-stagger in crowded cells keeps labels off the neighbor's dot
        x: X0 + Number(ring) * COL_W + (nodes.length > 1 ? (i % 2 === 0 ? -20 : 20) : 0),
        y: band.y + (i - (nodes.length - 1) / 2) * PITCH,
      });
    });
  }
}

// Right-angle elbow (ADR-0005): cross-column edges run horizontal-first so the
// vertical segment lives in the gutter between columns, never inside one.
function elbow(a, b) {
  if (Math.abs(b.x - a.x) < 50) {
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} L${a.x},${my} L${b.x},${my} L${b.x},${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M${a.x},${a.y} L${mx},${a.y} L${mx},${b.y} L${b.x},${b.y}`;
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
    // phones open zoomed on the hub columns; desktops open width-fitted and
    // pan the tall band stack (app.md: bigger than any screen on purpose)
    const w = svg.getBoundingClientRect().width || window.innerWidth;
    if (w < 600) {
      view.k = 1.5;
      view.x = -(X0 + 180) * view.k;
      view.y = 0;
    } else {
      view.k = Math.min(1, (VIEW - 40) / (5 * COL_W + 260));
    }
    zoomInit = true;
  }
  svg.innerHTML = '';
  const pan = el('g', { id: 'latPan' });
  svg.appendChild(pan);
  applyView(pan);

  // tier guides: one vertical line per ring column
  for (let r = 1; r <= 5; r++) {
    pan.appendChild(el('line', {
      x1: X0 + r * COL_W, y1: Y0 - 20, x2: X0 + r * COL_W, y2: Y1 + 20,
      class: 'latRing',
    }));
  }
  // band separators between sectors
  for (let i = 1; i < BANDS.length; i++) {
    const y = BANDS[i].y - BANDS[i].half;
    pan.appendChild(el('line', {
      x1: X0 - 130, y1: y, x2: X0 + 5 * COL_W + 60, y2: y, class: 'latRing',
    }));
  }

  // sector labels at the left rim of each band
  SECTOR_ORDER.forEach((s, si) => {
    const t = el('text', {
      x: X0 - 40, y: BANDS[si].y,
      class: 'latSector', fill: SECTOR_COLOR[s],
      'text-anchor': 'end', 'dominant-baseline': 'middle',
    });
    t.textContent = s.toUpperCase();
    pan.appendChild(t);
  });

  // edges under nodes: rectilinear elbows (ADR-0005); dashed for any-mode
  for (const n of LATTICE) {
    const p = POS.get(n.id);
    for (const r of n.req) {
      const q = POS.get(r);
      if (!q) continue;
      const bothOwned = G.meta.tech.includes(n.id) && G.meta.tech.includes(r);
      const path = el('path', {
        d: elbow(q, p), fill: 'none', 'stroke-linejoin': 'round',
        class: 'latEdge' + (bothOwned ? ' lit' : '') + (n.reqMode === 'any' ? ' any' : ''),
      });
      pan.appendChild(path);
    }
  }

  // the Point at the hub column, vertical center
  const hub = el('g', { class: 'latHub', transform: `translate(${X0} 0)` });
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
