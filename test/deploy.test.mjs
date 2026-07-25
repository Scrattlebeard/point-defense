// The deploy workflow's channel contract (README "Deployment").
//
// Every CI run assembles ALL channels from their branch heads, so a gate script
// named by the workflow may simply not exist on an older channel head. Naming one
// unguarded is not a hypothetical: it took the whole site down for 20 consecutive
// runs on 2026-07-24/25, because a prod-channel failure blocks the deploy outright
// and the dev channel rode down with it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const yml = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

// `node scripts/foo.mjs …` anywhere in the workflow body — NOT anchored to the
// start of a line, since a guarded gate reads `…; then node scripts/foo.mjs`.
const invocations = [...yml.matchAll(/\bnode\s+(scripts\/[\w.-]+\.mjs)/g)].map(m => m[1]);

test('the workflow actually runs gates (this test is worthless if it matches nothing)', () => {
  assert.ok(invocations.length >= 2, `expected gate invocations, found ${invocations.length}`);
});

test('every gate is guarded against being absent from a channel head', () => {
  for (const script of new Set(invocations)) {
    assert.match(
      yml,
      new RegExp(`\\[\\s*-f\\s+${script.replace(/[/.]/g, '\\$&')}\\s*\\]`),
      `${script} is invoked without an existence guard — it will hard-fail on any ` +
      `channel head that predates it, and a prod failure blocks the entire deploy`,
    );
  }
});

test('a missing gate is skipped loudly, never silently', () => {
  // A skip nobody can see in the log is indistinguishable from a gate that passed.
  const notices = [...yml.matchAll(/::notice::/g)].length;
  assert.ok(
    notices >= new Set(invocations).size,
    `expected a ::notice:: per guarded gate, found ${notices}`,
  );
});

test('the prod channel stays fail-closed', () => {
  // Failure isolation is deliberate and asymmetric (README "Deployment"): dev and
  // beta warn, prod blocks. Guarding gates must not have quietly softened that.
  const prodStep = yml.slice(yml.indexOf('prod channel'), yml.indexOf('beta channel'));
  assert.doesNotMatch(prodStep, /continue-on-error:\s*true/,
    'the prod channel must block the deploy on failure, not warn');
  assert.match(prodStep, /set -euo pipefail/,
    'a gate that fails must still kill the step');
});
