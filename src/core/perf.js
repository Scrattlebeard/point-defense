// Frame-time sampling and statistics — pure, see core/perf.md.
// The shell measures wall clock and draws; the opinions about what a bad frame
// is, and which statistic tells the truth, live here.

/** One frame at 60fps. A frame past this is a frame the player did not get. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** ~10s at 60fps. Bounded on purpose: an instrument whose cost grows with the
 *  session is the bug it exists to find (core/perf.md "Bounded by construction"). */
export const KEEP_SAMPLES = 600;
export const KEEP_WAVES = 10;
/** Below this a bucket is noise, not a measurement, and is not reported. */
export const MIN_SAMPLES = 20;

export function makePerf() {
  return { cur: null, waves: [] };
}

function bucket(wave) {
  return { wave, ms: [], head: 0, n: 0, entSum: 0, partSum: 0 };
}

export function samplePerf(p, ms, { wave, ents = 0, parts = 0 }) {
  if (!p.cur || p.cur.wave !== wave) {
    if (p.cur) {
      p.waves.push(p.cur);
      // KEEP_WAVES is the ROW budget, and the live wave always claims one — so
      // closed buckets are capped one below it, never at it.
      while (p.waves.length > KEEP_WAVES - 1) p.waves.shift();
    }
    p.cur = bucket(wave);
  }
  const b = p.cur;
  // ring, not push-and-trim: keep the RECENT frames, so a wave that degrades
  // half way through shows the degradation instead of its own good start
  if (b.ms.length < KEEP_SAMPLES) b.ms.push(ms);
  else { b.ms[b.head] = ms; b.head = (b.head + 1) % KEEP_SAMPLES; }
  b.n++;
  b.entSum += ents;
  b.partSum += parts;
}

/** p50 / p95 / worst / fraction-over-budget. Sorts, so call it on demand — never
 *  per sample (core/perf.md). */
export function perfStats(ms) {
  if (!ms || ms.length === 0) return { p50: 0, p95: 0, worst: 0, over: 0 };
  const s = [...ms].sort((a, b) => a - b);
  const at = q => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  let over = 0;
  for (const v of ms) if (v > FRAME_BUDGET_MS) over++;
  return { p50: at(0.5), p95: at(0.95), worst: s[s.length - 1], over: over / ms.length };
}

function row(b) {
  const stats = perfStats(b.ms);
  const seen = Math.min(b.n, KEEP_SAMPLES) || 1;
  return {
    wave: b.wave, n: b.n, ...stats,
    // means over everything the bucket saw, not just what the ring still holds:
    // the counts are cheap to accumulate and explain the timings beside them
    ents: b.entSum / b.n, parts: b.partSum / b.n,
    _seen: seen,
  };
}

/** Closed waves oldest-first, then the live one — so the HUD always has a
 *  current row while the wave being complained about is still happening. */
export function perfRows(p) {
  const out = [];
  for (const b of p.waves) if (b.n >= MIN_SAMPLES) out.push(row(b));
  if (p.cur && p.cur.n >= MIN_SAMPLES) out.push(row(p.cur));
  return out;
}
