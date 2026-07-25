// The ?perf overlay (app.md "Dev hatch: ?perf"). Draws what core/perf.js reports.
// Deliberately canvas-drawn rather than DOM: it must survive a fullscreen PWA on a
// phone, and it must appear in a headless screenshot — which is the only way this
// repo can read a number off a real rasteriser.
import { perfRows, perfStats, refreshMs } from '../core/perf.js';

const PAD = 8;
// clears the DOM HUD's wave/level line, which also lives at the top-left
const TOP = 44;
const LINE = 13;
const OK = '#59ff9c';
const WARN = '#ffd24d';
const BAD = '#ff5c6c';

/** Colour is the whole point: a table of numbers on a phone screen is unreadable
 *  at a glance, and this gets read at a glance while something else is happening.
 *  Keyed on DROPPED FRAMES, not on p95 against an absolute budget — the first
 *  version painted the whole table red for a phone running a clean 60fps
 *  (core/perf.md "Vsync quantizes everything"). */
function tint(dropped) {
  if (dropped > 0.10) return BAD;
  if (dropped > 0.02) return WARN;
  return OK;
}

// Stats sort; drawing every frame would make the instrument a cost centre. Once
// every ~quarter second is far faster than a human reads and 15× cheaper.
const REFRESH = 15;
let cache = null, tick = 0;

export function drawPerfHud(G) {
  const { ctx } = G;
  if (!G.perf) return;
  if (tick++ % REFRESH === 0 || !cache) {
    cache = {
      rows: perfRows(G.perf),
      live: perfStats(G.perf.cur ? G.perf.cur.ms : [], refreshMs(G.perf)),
      synthetic: !!G.perf.synthetic,
    };
  }
  const { rows, live, synthetic } = cache;

  const w = 250;
  const h = PAD * 2 + LINE * (rows.length + 3);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);      // pin to the physical top-left, unshaken
  ctx.scale(G.hudScale || 1, G.hudScale || 1);
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = '#04070d';
  ctx.translate(0, TOP);
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(120,160,240,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.textAlign = 'left';

  let y = PAD + LINE - 3;
  ctx.fillStyle = synthetic ? OK : tint(live.dropped);
  ctx.fillText(
    `p50 ${live.p50.toFixed(1)}  p95 ${live.p95.toFixed(1)}  max ${live.worst.toFixed(0)}`,
    PAD, y);
  y += LINE;
  ctx.fillStyle = '#5f7396';
  // Rows are the WORST ~2s window of each wave, not the wave average: a wave
  // ramps and thins, and the average reports neither (core/perf.md).
  ctx.fillText(synthetic
    ? 'pre-sim: draw cost, no vsync — drop n/a'
    : 'rows = worst 2s window of each wave', PAD, y);
  y += LINE;
  ctx.fillStyle = '#8fa6c8';
  // `work` is ours; p50/p95 are the vsync-quantized gap. Both, because either
  // alone is half an instrument (core/perf.md).
  ctx.fillText('wave  p50   p95  drop  work  ents', PAD, y);

  for (const r of rows) {
    y += LINE;
    ctx.fillStyle = synthetic ? OK : tint(r.dropped);
    ctx.fillText(
      String(r.wave).padStart(4) + '  ' +
      r.p50.toFixed(1).padStart(4) + '  ' +
      r.p95.toFixed(1).padStart(5) + '  ' +
      (synthetic ? '  -' : (r.dropped * 100).toFixed(0).padStart(3) + '%') + '  ' +
      r.work.toFixed(1).padStart(4) + '  ' +
      Math.round(r.ents).toString().padStart(4),
      PAD, y);
  }
  ctx.restore();
}
