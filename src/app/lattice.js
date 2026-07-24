// The Lattice view (app.md `lattice.js` row, ADR-0003 stage 1, ADR-0005): renders
// LATTICE as a horizontal rectilinear circuit — hub at the left, one column per
// ring (cost tier), sectors as horizontal bands, right-angle elbow edges. Pure
// view: all purchases go through the hooks object (onBuy), the same contract
// ui.js uses. Pan/zoom state lives here and survives re-renders.
import { LATTICE, SECTORS } from '../core/config.js';
import { canBuy, reqsMet } from '../core/tech.js';

const NS = 'http://www.w3.org/2000/svg';
// band order comes from core — it is semantic since the adjacent-lanes rule
// (core.md "The Lattice"); the view only owns the colors
const SECTOR_COLOR = {
  Hull: '#59ff9c', Arms: '#ff5c6c', Mind: '#c06bff',
  Salvage: '#ffd24d', Arsenal: '#4de8ff', Armory: '#ff7fb0', Towers: '#ff9c59',
};
const COL_W = 185; // one column per ring, left→right (ADR-0005)
const PITCH = 58;  // vertical pitch between nodes inside a (sector, ring) cell
const BOX_W = 110, BOX_H = 46; // square node cards (app.md)
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
  for (const s of SECTORS) {
    let m = 1;
    for (const [k, v] of bySR) if (k.startsWith(s + ':')) m = Math.max(m, v.length);
    BANDS.push({ y: 0, half: ((m - 1) * PITCH) / 2 + 48 });
  }
  const total = BANDS.reduce((a, b) => a + 2 * b.half, 0);
  let y = -total / 2;
  Y0 = y; Y1 = total / 2;
  for (const b of BANDS) { b.y = y + b.half; y += 2 * b.half; }
  // lane pull (app.md): a node with a cross-sector partner (either direction)
  // sorts toward the band edge facing it — cross-links become facing-lane hops
  const byId = new Map(LATTICE.map(n => [n.id, n]));
  const pull = new Map(LATTICE.map(n => [n.id, 0]));
  for (const n of LATTICE) {
    for (const r of n.req) {
      const q = byId.get(r);
      const d = Math.sign(SECTORS.indexOf(q.sector) - SECTORS.indexOf(n.sector));
      pull.set(n.id, pull.get(n.id) + d);
      pull.set(q.id, pull.get(q.id) - d);
    }
  }
  for (const [k, nodes] of bySR) {
    const [sector, ring] = k.split(':');
    const band = BANDS[SECTORS.indexOf(sector)];
    nodes.sort((a, b) => pull.get(a.id) - pull.get(b.id)); // stable: ties keep config order
    nodes.forEach((n, i) => {
      POS.set(n.id, {
        x: X0 + Number(ring) * COL_W,
        y: band.y + (i - (nodes.length - 1) / 2) * PITCH,
      });
    });
  }
}

// Right-angle elbow (ADR-0005): cross-column edges run horizontal-first so the
// vertical segment lives in the gutter between columns, never inside one.
// Same-column edges run straight — unless a card sits between the endpoints,
// in which case they dogleg through the right-hand gutter (app.md).
function vBlocked(a, b) {
  const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
  for (const p of POS.values()) {
    if (p === a || p === b) continue;
    if (Math.abs(p.x - a.x) < BOX_W / 2 && p.y > lo && p.y < hi) return true;
  }
  return false;
}
function hBlocked(y, xa, xb, a, b) {
  const lo = Math.min(xa, xb) - BOX_W / 2, hi = Math.max(xa, xb) + BOX_W / 2;
  for (const p of POS.values()) {
    if (p === a || p === b) continue;
    if (Math.abs(p.y - y) < BOX_H / 2 + 2 && p.x > lo && p.x < hi) return true;
  }
  return false;
}
// Trim both ends to the card border (app.md): locked cards are translucent,
// so an under-card segment reads as *through* the card. Points are copies —
// never mutate POS entries.
function trim(pts) {
  const t0 = pts[0], t1 = pts[1];
  if (t1.x !== t0.x) t0.x += Math.sign(t1.x - t0.x) * (BOX_W / 2);
  else t0.y += Math.sign(t1.y - t0.y) * (BOX_H / 2);
  const e0 = pts[pts.length - 1], e1 = pts[pts.length - 2];
  if (e1.x !== e0.x) e0.x += Math.sign(e1.x - e0.x) * (BOX_W / 2);
  else e0.y += Math.sign(e1.y - e0.y) * (BOX_H / 2);
  return 'M' + pts.map(p => `${p.x},${p.y}`).join(' L');
}
function elbow(a, b) {
  if (Math.abs(b.x - a.x) < 50) {
    if (vBlocked(a, b)) {
      const gx = a.x + COL_W / 2 - 4; // right-hand gutter, offset off span-1 verticals
      return trim([{ ...a }, { x: gx, y: a.y }, { x: gx, y: b.y }, { ...b }]);
    }
    const my = (a.y + b.y) / 2;
    return trim([{ ...a }, { x: a.x, y: my }, { x: b.x, y: my }, { ...b }]);
  }
  // cross-column: vertical segment in a gutter — for multi-column hops the
  // midpoint would land ON a column, so pick whichever gutter routes clean
  const s = Math.sign(b.x - a.x);
  const late = b.x - s * (COL_W / 2), early = a.x + s * (COL_W / 2);
  if (!hBlocked(a.y, a.x, late, a, b) && !hBlocked(b.y, late, b.x, a, b)) {
    return trim([{ ...a }, { x: late, y: a.y }, { x: late, y: b.y }, { ...b }]);
  }
  if (!hBlocked(a.y, a.x, early, a, b) && !hBlocked(b.y, early, b.x, a, b)) {
    return trim([{ ...a }, { x: early, y: a.y }, { x: early, y: b.y }, { ...b }]);
  }
  // both lanes blocked — the flat multi-column hop with a card dead between:
  // jog through the pitch gap between lane rows for the middle stretch
  const jy = a.y + PITCH / 2;
  return trim([{ ...a }, { x: early, y: a.y }, { x: early, y: jy },
    { x: late, y: jy }, { x: late, y: b.y }, { ...b }]);
}

// ---- pan/zoom state (module-scoped: survives re-renders, resets per session) ----
const view = { x: 0, y: 0, k: 1 };
let selectedId = null;
let hoverId = null; // mouse-only card preview; never set on touch
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
  SECTORS.forEach((s, si) => {
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
    // square card (app.md): name inside, split to two lines when long
    g.appendChild(el('rect', {
      x: -BOX_W / 2, y: -BOX_H / 2, width: BOX_W, height: BOX_H, rx: 8, class: 'latDot',
    }));
    const words = n.name.split(' ');
    let lines = [n.name];
    if (n.name.length > 12 && words.length > 1) {
      let best = 1, diff = 1e9;
      for (let i = 1; i < words.length; i++) {
        const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
        if (d < diff) { diff = d; best = i; }
      }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    const name = el('text', {
      y: lines.length > 1 ? -10 : -4, class: 'latName', 'text-anchor': 'middle',
    });
    lines.forEach((ln, i) => {
      const ts = el('tspan', { x: 0, dy: i === 0 ? 0 : 11 });
      ts.textContent = ln;
      name.appendChild(ts);
    });
    g.appendChild(name);
    const sub = el('text', {
      y: lines.length > 1 ? 15 : 13, class: 'latSub', 'text-anchor': 'middle',
    });
    sub.textContent = state === 'owned' ? '✓' : `◆ ${n.cost}`;
    g.appendChild(sub);
    if (n.id === selectedId) g.classList.add('selected');
    // no click listener here — pointer capture retargets clicks to the svg;
    // taps are resolved in wireGestures' pointerup (app.md, the 2026-07-24 bug)
    pan.appendChild(g);
  }

  renderCard(G, hooks);
  wireGestures(svg, pan,
    id => { selectedId = id; renderLattice(G, hooks); },
    () => renderCard(G, hooks));
}

function renderCard(G, hooks) {
  const card = document.getElementById('nodeCard');
  // mouse hover previews without selecting (app.md); touch never sets hoverId
  const n = LATTICE.find(x => x.id === (hoverId ?? selectedId));
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
function wireGestures(svg, pan, onTap, onHover) {
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
  // Taps resolve HERE, not in click handlers: setPointerCapture retargets the
  // derived click to the svg, so per-node listeners never fire (app.md — this
  // made every node unselectable until 2026-07-24). elementFromPoint sees the
  // real element under the finger regardless of capture.
  svg.addEventListener('pointerup', ev => {
    const wasSolo = pointers.size === 1;
    pointers.delete(ev.pointerId); pinchD = 0;
    if (wasSolo && !dragMoved) {
      const t = document.elementFromPoint(ev.clientX, ev.clientY);
      const g = t && t.closest ? t.closest('.latNode') : null;
      onTap(g ? g.getAttribute('data-id') : null);
    }
  });
  svg.addEventListener('pointercancel', ev => { pointers.delete(ev.pointerId); pinchD = 0; });
  // mouse-only hover preview; guarded so re-entering descendants is a no-op
  svg.addEventListener('pointerover', ev => {
    if (ev.pointerType !== 'mouse' || pointers.size) return;
    const g = ev.target.closest ? ev.target.closest('.latNode') : null;
    const id = g ? g.getAttribute('data-id') : null;
    if (id !== hoverId) { hoverId = id; onHover(); }
  });
  svg.addEventListener('pointerleave', ev => {
    if (ev.pointerType === 'mouse' && hoverId !== null) { hoverId = null; onHover(); }
  });
  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    view.k = Math.min(3, Math.max(0.5, view.k * (ev.deltaY < 0 ? 1.12 : 0.89)));
    applyView(document.getElementById('latPan'));
  }, { passive: false });
}
