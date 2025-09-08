// storage.js
const NS = 'gluone:';
const hasSession = (() => {
  try {
    const k = '__t__';
    sessionStorage.setItem(k, '1');
    sessionStorage.removeItem(k);
    return true;
  } catch { return false; }
})();

const mem = new Map();
function k(key) { return NS + key; }

export const KEYS = {
  CHALLENGE: 'auth_challenge',
  TOKEN: 'auth_token',           // legacy: больше не используется в web-флоу
  STATE: 'auth_state',
  RESEND_UNTIL: 'resend_until_ts'
};

// Лёгкая миграция: выпилим старый токен из сессии, чтобы нигде не полагаться на него случайно
try {
  const name = k(KEYS.TOKEN);
  if (hasSession) sessionStorage.removeItem(name);
  else mem.delete(name);
} catch {}

export function save(key, value) {
  try {
    const name = k(key);
    if (value === undefined || value === null) { del(key); return; }
    const str = JSON.stringify(value);
    if (hasSession) sessionStorage.setItem(name, str);
    else mem.set(name, str);
  } catch {}
}

export function load(key, fallback = null) {
  const name = k(key);
  try {
    const raw = hasSession ? sessionStorage.getItem(name) : mem.get(name);
    if (!raw && raw !== '0') return fallback;
    try { return JSON.parse(raw); }
    catch {
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      if (!Number.isNaN(Number(raw)) && raw.trim() !== '') return Number(raw);
      return fallback;
    }
  } catch { return fallback; }
}

export function del(key) {
  try {
    const name = k(key);
    if (hasSession) sessionStorage.removeItem(name);
    else mem.delete(name);
  } catch {}
}

/* Доп. хелперы */
export function saveTTL(key, value, ttlMs) {
  const payload = { v: value, exp: Date.now() + Math.max(0, ttlMs|0) };
  save(key, payload);
}
export function loadTTL(key, fallback = null) {
  const payload = load(key, null);
  if (!payload || typeof payload !== 'object') return fallback;
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) { del(key); return fallback; }
  return payload.v ?? fallback;
}
export function merge(key, patch) {
  const cur = load(key, {}) || {};
  if (typeof cur !== 'object' || cur === null) return save(key, patch);
  save(key, { ...cur, ...patch });
}
