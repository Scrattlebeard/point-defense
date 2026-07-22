// Tech tree logic. Nodes live in config.js; meta is never mutated, always replaced.
import { TECH } from './config.js';

const byId = new Map(TECH.map(n => [n.id, n]));

export function canBuy(id, ownedIds, shards) {
  const n = byId.get(id);
  if (!n) return false;
  const owned = new Set(ownedIds);
  if (owned.has(id)) return false;
  if (!n.req.every(r => owned.has(r))) return false;
  return shards >= n.cost;
}

/** Returns a new meta with the node bought, or the input meta unchanged if it can't be. */
export function buy(id, meta) {
  if (!canBuy(id, meta.tech, meta.shards)) return meta;
  const n = byId.get(id);
  return { ...meta, shards: meta.shards - n.cost, tech: [...meta.tech, id] };
}

/** Aggregate owned nodes into one effects object. Additive within each stat. */
export function effectsOf(ownedIds) {
  const fx = {
    hpBonus: 0, regen: 0, critChance: 0, critMult: 2, startLevel: 1,
    dmgMult: 1, xpMult: 1, dmgTakenMult: 1, cdMult: 1, salvageMult: 1,
    weapons: new Set(), towers: new Set(),
  };
  let dmgAdd = 0, xpAdd = 0, dtAdd = 0, cdAdd = 0, salvAdd = 0;
  for (const id of ownedIds) {
    const e = byId.get(id)?.effect;
    if (!e) continue;
    if (e.hpBonus) fx.hpBonus += e.hpBonus;
    if (e.regen) fx.regen += e.regen;
    if (e.critChance) fx.critChance += e.critChance;
    if (e.startLevelAdd) fx.startLevel += e.startLevelAdd;
    if (e.dmgAdd) dmgAdd += e.dmgAdd;
    if (e.xpAdd) xpAdd += e.xpAdd;
    if (e.dmgTakenAdd) dtAdd += e.dmgTakenAdd;
    if (e.cdAdd) cdAdd += e.cdAdd;
    if (e.salvageAdd) salvAdd += e.salvageAdd;
    if (e.unlockWeapon) fx.weapons.add(e.unlockWeapon);
    if (e.unlockTower) fx.towers.add(e.unlockTower);
  }
  fx.dmgMult = 1 + dmgAdd;
  fx.xpMult = 1 + xpAdd;
  fx.dmgTakenMult = 1 + dtAdd;
  fx.cdMult = 1 + cdAdd;
  fx.salvageMult = 1 + salvAdd;
  return fx;
}
