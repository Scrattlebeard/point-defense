// Weapon icon contract (app.md icons.js row): every weapon in config has an
// inline SVG in the generated module, and the module stays in sync with the
// assets/icons/ source tree it's generated from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { WEAPONS } from '../src/core/config.js';
import { WEAPON_ICONS } from '../src/app/icons.js';

test('every weapon has an inline icon, and no icon is orphaned', () => {
  const want = Object.keys(WEAPONS).sort();
  const have = Object.keys(WEAPON_ICONS).sort();
  assert.deepEqual(have, want);
});

test('icons are self-contained SVGs (single-file build safe)', () => {
  for (const [id, svg] of Object.entries(WEAPON_ICONS)) {
    assert.match(svg, /^<svg[^>]*xmlns=/, `${id}: not a standalone <svg>`);
    assert.ok(!svg.includes('src='), `${id}: references an external resource`);
    assert.ok(!svg.includes('</script>'), `${id}: would break inline embedding`);
  }
});

test('generated module matches the assets/icons source tree', () => {
  const files = readdirSync(new URL('../assets/icons', import.meta.url))
    .filter(f => f.endsWith('.svg'));
  assert.equal(files.length, Object.keys(WEAPON_ICONS).length, 'file/entry count differs — rerun scripts/icons.mjs');
  for (const f of files) {
    const id = f.replace('.svg', '');
    const disk = readFileSync(new URL(`../assets/icons/${f}`, import.meta.url), 'utf8').trim();
    assert.equal(WEAPON_ICONS[id], disk, `${id}: icons.js is stale — rerun scripts/icons.mjs`);
  }
});
