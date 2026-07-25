// Frame-time sampling and statistics — pure, see core/perf.md.
// The shell measures wall clock and draws; the opinions about what a bad frame
// is, and which statistic tells the truth, live here.

/** One frame at 60fps. Used only as a fallback before enough frames exist to
 *  estimate the real refresh interval — never as a scoring threshold. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** ~10s at 60fps. Bounded on purpose: an instrument whose cost grows with the
 *  session is the bug it exists to find (core/perf.md "Bounded by construction"). */
export const KEEP_SAMPLES = 600;
export const KEEP_WAVES = 10;
/** Below this a bucket is noise, not a measurement, and is not reported. */
export const MIN_SAMPLES = 20;

/** The peak window: ~2s at 60fps, re-evaluated twice a second. A wave ramps —
 *  spawns, crunch, mop-up — so the wave average reports neither (core/perf.md). */
export const WINDOW = 120;
export const WINDOW_STRIDE = 30;

/** Session-wide ring used to estimate the refresh interval. */
export const KEEP_BASELINE = 1200;

/** Fraction of a refresh interval above which a frame counts as DROPPED. Vsync
 *  hands out whole intervals, so a dropped frame is always ~2x one. */
export const DROP_FACTOR = 1.5;

export function makePerf() {
  return { cur: null, waves: [], all: [], allHead: 0 };
}

function bucket(wave) {
  return {
    wave, n: 0, since: 0,
    ms: [], work: [], head: 0, entSum: 0, partSum: 0,
    // the rolling window under evaluation
    win: [], winWork: [], winEnts: [], winHead: 0,
    peak: null,
  };
}

/** One refresh interval, estimated as a low percentile of the whole session.
 *  NOT the median of whatever is being scored: a window in which every frame is
 *  33.3ms has a median of 33.3, and would grade itself flawless (core/perf.md). */
export function refreshMs(p) {
  if (!p.all || p.all.length < MIN_SAMPLES) return FRAME_BUDGET_MS;
  const s = [...p.all].sort((a, b) => a - b);
  return s[Math.floor(0.05 * s.length)];
}

/** p50 / p95 / worst / dropped-fraction. `baseline` is one refresh interval; it
 *  defaults to this sample's own median, which is right for a well-behaved sample
 *  and wrong for a uniformly bad one — pass it explicitly when scoring a window
 *  that might be entirely degraded (core/perf.md). Sorts, so call on demand. */
export function perfStats(ms, baseline = null) {
  if (!ms || ms.length === 0) return { p50: 0, p95: 0, worst: 0, dropped: 0 };
  const s = [...ms].sort((a, b) => a - b);
  const at = q => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  const p50 = at(0.5);
  const cut = (baseline || p50) * DROP_FACTOR;
  let dropped = 0;
  for (const v of ms) if (v > cut) dropped++;
  return { p50, p95: at(0.95), worst: s[s.length - 1], dropped: dropped / ms.length };
}

function evaluateWindow(b, baseline) {
  if (b.win.length < MIN_SAMPLES) return;
  const stats = perfStats(b.win, baseline);
  // "worst" is the window with the highest MEDIAN frame time — the sustained
  // crunch, not a single hitch, which `worst` already reports separately.
  if (b.peak && stats.p50 <= b.peak.p50) return;
  b.peak = {
    ...stats,
    work: perfStats(b.winWork, baseline).p95,
    // co-timed with the peak: the count on screen when the frames dropped, which
    // is the only version of this number the cost question can use
    ents: b.winEnts.reduce((a, v) => a + v, 0) / b.winEnts.length,
  };
}

export function samplePerf(p, ms, { wave, ents = 0, parts = 0, work = 0 }) {
  if (!p.cur || p.cur.wave !== wave) {
    if (p.cur) {
      evaluateWindow(p.cur, refreshMs(p)); // a short wave still gets one reading
      p.waves.push(p.cur);
      // KEEP_WAVES is the ROW budget, and the live wave always claims one — so
      // closed buckets are capped one below it, never at it.
      while (p.waves.length > KEEP_WAVES - 1) p.waves.shift();
    }
    p.cur = bucket(wave);
  }
  const b = p.cur;

  if (b.ms.length < KEEP_SAMPLES) { b.ms.push(ms); b.work.push(work); }
  else { b.ms[b.head] = ms; b.work[b.head] = work; b.head = (b.head + 1) % KEEP_SAMPLES; }
  b.n++;
  b.entSum += ents;
  b.partSum += parts;

  if (p.all.length < KEEP_BASELINE) p.all.push(ms);
  else { p.all[p.allHead] = ms; p.allHead = (p.allHead + 1) % KEEP_BASELINE; }

  // the window ring — three parallel arrays sharing one head, so the entity count
  // stays aligned with the frame time it was taken beside
  if (b.win.length < WINDOW) { b.win.push(ms); b.winWork.push(work); b.winEnts.push(ents); }
  else {
    b.win[b.winHead] = ms; b.winWork[b.winHead] = work; b.winEnts[b.winHead] = ents;
    b.winHead = (b.winHead + 1) % WINDOW;
  }

  if (++b.since >= WINDOW_STRIDE) { b.since = 0; evaluateWindow(b, refreshMs(p)); }
}

function row(b, baseline) {
  // The row IS the peak window (core/perf.md). Whole-wave figures stay on the
  // bucket for anyone who wants them; the table shows what the player felt.
  const peak = b.peak || { ...perfStats(b.ms, baseline), work: 0, ents: b.entSum / b.n };
  return {
    wave: b.wave, n: b.n,
    p50: peak.p50, p95: peak.p95, worst: peak.worst, dropped: peak.dropped,
    work: peak.work, ents: peak.ents,
    parts: b.partSum / b.n,
  };
}

/** Closed waves oldest-first, then the live one — so the HUD always has a
 *  current row while the wave being complained about is still happening. */
export function perfRows(p) {
  const baseline = refreshMs(p);
  const out = [];
  for (const b of p.waves) if (b.n >= MIN_SAMPLES) out.push(row(b, baseline));
  if (p.cur && p.cur.n >= MIN_SAMPLES) out.push(row(p.cur, baseline));
  return out;
}
