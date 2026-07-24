// fx.js seam: camera juice (shake, flash) settles even while the sim is paused
// behind an overlay (app.md "Camera juice settles through pauses"). settleFx is
// the pause-safe subset of updateFx: it decays shake/flash and touches nothing
// world-shaped — a frozen field must stay frozen, but must not keep jittering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFx, updateFx, settleFx, shake, flash, burst, dmgText } from '../src/app/fx.js';

test('settleFx decays shake and flash to zero', () => {
  const fx = makeFx();
  shake(fx, 10);
  flash(fx, 0.4);
  for (let i = 0; i < 60; i++) settleFx(fx, 1 / 60); // one second of overlay
  assert.equal(fx.shake, 0);
  assert.equal(fx.flash, 0);
});

test('settleFx leaves world-state fx frozen', () => {
  const fx = makeFx();
  burst(fx, 100, 100, '#fff', 5);
  dmgText(fx, 50, 50, 12);
  const snap = JSON.stringify({ parts: fx.parts, texts: fx.texts });
  for (let i = 0; i < 60; i++) settleFx(fx, 1 / 60);
  assert.equal(JSON.stringify({ parts: fx.parts, texts: fx.texts }), snap);
});

test('updateFx still decays shake/flash (settle is a subset, not a move)', () => {
  const fx = makeFx();
  shake(fx, 10);
  flash(fx, 0.4);
  for (let i = 0; i < 60; i++) updateFx(fx, 1 / 60);
  assert.equal(fx.shake, 0);
  assert.equal(fx.flash, 0);
});
