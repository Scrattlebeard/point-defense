// The web app manifest (README "Deployment"). A malformed manifest does not error
// anywhere — the browser simply declines to offer installation — so the only place
// this can be caught is here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));

test('the manifest parses and carries what installability requires', () => {
  for (const key of ['name', 'short_name', 'start_url', 'display', 'icons']) {
    assert.ok(manifest[key], `missing ${key}`);
  }
  assert.equal(manifest.display, 'standalone', 'standalone is the point — it kills the URL bar');
  assert.ok(manifest.short_name.length <= 12, 'short_name is what fits under a home-screen icon');
});

test('every declared icon exists, and its file matches its declared size', () => {
  // a manifest pointing at a missing or mis-sized icon fails silently
  assert.ok(manifest.icons.length >= 2, 'need at least a 192 and a 512');
  for (const icon of manifest.icons) {
    const f = new URL(`assets/${icon.src}`, root);
    assert.ok(existsSync(f), `${icon.src} is declared but not in assets/`);
    assert.ok(statSync(f).size > 200, `${icon.src} looks empty`);
    // PNG header: width/height are big-endian uint32 at bytes 16..24
    const buf = readFileSync(f);
    assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${icon.src} is not a PNG`);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} is ${w}x${h}, declared ${icon.sizes}`);
  }
  assert.ok(manifest.icons.some(i => i.sizes === '512x512'), 'installability wants a 512');
});

test('orientation stays the player\'s choice', () => {
  // decided 2026-07-23: the arena is radially symmetric and portrait one-thumb
  // play is a feature, so we do NOT force landscape
  assert.equal(manifest.orientation, 'any');
});

test('no service worker is declared — offline is deliberately out of scope', () => {
  // the game is one file with no runtime deps; a stale cached build is a real cost
  // and offline buys nothing worth it
  assert.equal(existsSync(new URL('sw.js', root)), false);
});
