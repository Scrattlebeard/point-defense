// The initUI hook contract (app.md "The hook seam is a contract").
//
// ui.js calls H.<name>(); main.js supplies the object. In vanilla JS a missing
// key is not an error until a human clicks that exact button — which is why the
// FULLSCREEN and HAPTICS buttons both shipped dead on 2026-07-25, each "verified"
// by a screenshot proving the button rendered. This is the cheapest possible
// check that the two halves of the seam agree, and it needs no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../src/app/${f}`, import.meta.url), 'utf8');
const ui = read('ui.js');
const main = read('main.js');

// Every hook ui.js invokes, and every key main.js hands to initUI.
const called = new Set([...ui.matchAll(/\bH\.(on[A-Za-z]+)\s*\(/g)].map(m => m[1]));
const initUIArgs = main.slice(main.indexOf('initUI(G, {'));
const provided = new Set([...initUIArgs.matchAll(/^\s{2}(on[A-Za-z]+):/gm)].map(m => m[1]));

test('the contract has both sides (worthless if either scrape finds nothing)', () => {
  assert.ok(called.size >= 5, `expected hook calls in ui.js, found ${called.size}`);
  assert.ok(provided.size >= 5, `expected hooks in main.js, found ${provided.size}`);
});

test('every hook the UI calls is actually provided', () => {
  const dead = [...called].filter(h => !provided.has(h));
  assert.deepEqual(dead, [],
    `ui.js calls ${dead.join(', ')} but main.js never defines ${dead.length > 1 ? 'them' : 'it'} — ` +
    `clicking those buttons throws TypeError at the player, silently to every headless check`);
});

test('the two buttons that shipped dead are wired', () => {
  // Named explicitly: a regression here is a button a human presses and nothing
  // happens, which is the exact failure the generic check above was written for.
  for (const hook of ['onFullscreen', 'onHaptics']) {
    assert.ok(called.has(hook), `ui.js should still wire ${hook}`);
    assert.ok(provided.has(hook), `main.js must define ${hook}`);
  }
});

// The OTHER half of the same seam: ui.js reaches into the DOM by literal id, and
// a missing id is not an error until a human touches that exact control — the
// same silent failure the hook check above exists for. A screenshot cannot catch
// it either: the two dead buttons of 2026-07-25 were each "verified" by an image
// proving they rendered. Added 2026-07-26 with the rehearsal panel (ADR-0018),
// which introduced four new ids across two files at once.
test('every id ui.js reaches for exists in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const declared = new Set([...html.matchAll(/\bid="([A-Za-z][\w-]*)"/g)].map(m => m[1]));
  const used = new Set([...ui.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)].map(m => m[1]));
  assert.ok(used.size > 20, `only found ${used.size} id lookups — the regex stopped matching`);
  const missing = [...used].filter(id => !declared.has(id));
  assert.deepEqual(missing, [], `ui.js reaches for ids that do not exist: ${missing.join(', ')}`);
});
