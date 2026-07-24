// Persistence of the meta at the versioned key (README "Public seams").
// Storage failures degrade to in-memory play with an honest warning (app.md).
import { defaultMeta } from '../core/state.js';

// Channel-scoped key (README "Deployment"): prod/dev/beta share one Pages
// origin — unscoped, a dev playtest would overwrite the real save.
const chan = typeof location !== 'undefined'
  ? (location.pathname.match(/\/(dev|beta)\//) || [])[1] : undefined;
const KEY = 'pointdefense.meta.v1' + (chan ? `.${chan}` : '');
export let storageOk = true;

export function loadMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultMeta(), ...JSON.parse(raw) };
    // probe writability so the warning is accurate on first visit
    localStorage.setItem(KEY + '.probe', '1');
    localStorage.removeItem(KEY + '.probe');
  } catch {
    storageOk = false;
  }
  return defaultMeta();
}

export function saveMeta(meta) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    storageOk = false;
  }
}
