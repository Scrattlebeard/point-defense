// Lattice logic (core.md "The Lattice"). Nodes live in config.js; meta is never
// mutated, always replaced.
import { LATTICE, RETIRED_NODES } from './config.js';

const byId = new Map(LATTICE.map(n => [n.id, n]));

/** Prereqs satisfied? reqMode 'any' = web cross-link, ANY listed req suffices. */
export function reqsMet(n, owned) {
  if (n.req.length === 0) return true;
  return n.reqMode === 'any' ? n.req.some(r => owned.has(r)) : n.req.every(r => owned.has(r));
}

export function canBuy(id, ownedIds, shards) {
  const n = byId.get(id);
  if (!n) return false;
  const owned = new Set(ownedIds);
  if (owned.has(id)) return false;
  if (!reqsMet(n, owned)) return false;
  return shards >= n.cost;
}

/** Returns a new meta with the node bought, or the input meta unchanged if it can't be. */
export function buy(id, meta) {
  if (!canBuy(id, meta.tech, meta.shards)) return meta;
  const n = byId.get(id);
  return { ...meta, shards: meta.shards - n.cost, tech: [...meta.tech, id] };
}

/** Refund a save holding retired nodes, once, at load (core.md "Retired nodes
 *  refund on load"). Respecs are free, so retiring a node must never cost the
 *  player their investment. Returns the input unchanged when there is nothing
 *  to do, so a clean save is never rewritten. */
export function refundRetired(meta) {
  const owned = meta.tech.filter(id => RETIRED_NODES[id] !== undefined);
  if (!owned.length) return meta;
  const refund = owned.reduce((s, id) => s + RETIRED_NODES[id], 0);
  return {
    ...meta,
    shards: meta.shards + refund,
    tech: meta.tech.filter(id => RETIRED_NODES[id] === undefined),
  };
}

/** Aggregate owned nodes into one effects object. Additive within each stat. */
export function effectsOf(ownedIds) {
  const fx = {
    hpBonus: 0, regen: 0, critChance: 0, critMult: 2, startLevel: 1,
    dmgMult: 1, dmgTakenMult: 1, cdMult: 1, salvageMult: 1,
    weapons: new Set(), towers: new Set(), generics: new Set(), forms: new Set(),
  };
  let dmgAdd = 0, dtAdd = 0, cdAdd = 0, salvAdd = 0;
  for (const id of ownedIds) {
    const e = byId.get(id)?.effect;
    if (!e) continue;
    if (e.hpBonus) fx.hpBonus += e.hpBonus;
    if (e.regen) fx.regen += e.regen;
    if (e.critChance) fx.critChance += e.critChance;
    if (e.unlockGeneric) fx.generics.add(e.unlockGeneric);
    if (e.unlockForm) fx.forms.add(e.unlockForm);
    if (e.startLevelAdd) fx.startLevel += e.startLevelAdd;
    if (e.dmgAdd) dmgAdd += e.dmgAdd;
    if (e.dmgTakenAdd) dtAdd += e.dmgTakenAdd;
    if (e.cdAdd) cdAdd += e.cdAdd;
    if (e.salvageAdd) salvAdd += e.salvageAdd;
    if (e.unlockWeapon) fx.weapons.add(e.unlockWeapon);
    if (e.unlockTower) fx.towers.add(e.unlockTower);
  }
  fx.dmgMult = 1 + dmgAdd;
  fx.dmgTakenMult = 1 + dtAdd;
  fx.cdMult = 1 + cdAdd;
  fx.salvageMult = 1 + salvAdd;
  return fx;
}
