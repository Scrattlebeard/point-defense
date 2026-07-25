// Deterministic randomness for sim-based tests.
//
// CLAUDE.md: "Tests must be fast and deterministic — they are the inner loop, and
// a slow or flaky spec stops being enforced." Most of the sim runs on bare
// `Math.random` (spawn bearings, crit rolls, variant rolls, scatter jitter,
// mortar target picks), so any test that drives the sim inherits that. Those
// tests were not deterministic; they were *comfortably inside their margins*,
// which is a different and much weaker property — and margins move every time
// balance does.
//
// Evidence this matters: `forms.test` shipped 2026-07-25 with a neutrality check
// whose measurement carried ~20% crit noise. It failed roughly one run in seven,
// which no single run reveals. It was found by running the suite twenty times
// after an unrelated landing.
//
// Call `seedRandom()` at the top of each rig/factory so every test starts from
// the same stream position rather than inheriting whatever the previous test
// consumed. Not in a global setup hook: doing it per rig is what makes tests
// independent of their neighbours and of their order in the file.
//
// This file is deliberately NOT named `*.test.mjs` — the runner's glob would
// otherwise collect it as an (empty) test file.
import { mulberry32 } from '../src/core/rng.js';

/** Pin `Math.random` to a fixed stream. Same seed → same run, every time. */
export function seedRandom(seed = DEFAULT_SEED) {
  Math.random = mulberry32(seed);
}

// Sweepable so the suite can be checked for ROBUSTNESS, not just determinism:
// `TEST_SEED=7 npm test`. A test that passes only on the default seed is passing
// by luck and the seed is hiding it — see the sweep recorded in this file's
// landing commit.
const DEFAULT_SEED = Number(process.env.TEST_SEED ?? 20260725);
