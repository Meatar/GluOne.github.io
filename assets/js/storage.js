// storage.js
const NS = 'gluone:'; // неймспейс ключей
const hasSession = (() => {
  try {
    const k = '__t__';
    sessionStorage.setItem(k, '1');
    sessionStorage.removeItem(k);
    return true;
  } catch { return false; }
})();

// Фолбэк-хранилище в памяти (на случай запрета sessionStorage)
const mem = new Map();

/** Нормализуем имя ключа с неймспейсом */
function k(key) { return NS + key; }

export const KEYS = {
  CHALLENGE: 'auth_challenge',
  TOKEN: 'auth_token',
  STATE: 'auth_state',
  RESEND_UNTIL: 'resend_until_ts'
};

/** Сохранить значение. save(key, undefined|null) => удалить ключ. */
export function save(key, value) {
  try {
    const name = k(key);
    if (value === undefined || value === null) {
      del(key);
      return;
    }
    const str = JSON.stringify(value);
    if (hasSession) sessionStorage.setItem(name, str);
    else mem.set(name, str);
  } catch {
    // молча игнорируем, как и ранее
  }
}

/** Прочитать значение, вернуть fallback при ошибке/отсутствии. */
export function load(key, fallback = null) {
  const name = k(key);
  try {
    const raw = hasSession ? sessionStorage.getItem(name) : mem.get(name);
    if (!raw && raw !== '0') return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      // если лежит «грязная» строка (не JSON) — вернём как есть, если ожидаем строку/число
      // иначе — fallback
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      if (!Number.isNaN(Number(raw)) && raw.trim() !== '') return Number(raw);
      return fallback;
    }
  } catch {
    return fallback;
  }
}

/** Удалить ключ. */
export function del(key) {
  try {
    const name = k(key);
    if (hasSession) sessionStorage.removeItem(name);
    else mem.delete(name);
  } catch {}
}

/* ===== Дополнительные удобные хелперы (опционально) ===== */

/** Сохранить значение с TTL (мс). */
export function saveTTL(key, value, ttlMs) {
  const payload = { v: value, exp: Date.now() + Math.max(0, ttlMs|0) };
  save(key, payload);
}

/** Прочитать значение с TTL: вернёт fallback, если просрочено/нет. */
export function loadTTL(key, fallback = null) {
  const payload = load(key, null);
  if (!payload || typeof payload !== 'object') return fallback;
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) { del(key); return fallback; }
  return payload.v ?? fallback;
}

/** Частичное обновление объекта (merge), если в хранилище лежит объект. */
export function merge(key, patch) {
  const cur = load(key, {}) || {};
  if (typeof cur !== 'object' || cur === null) return save(key, patch);
  save(key, { ...cur, ...patch });
}
