// storage.js
// Небольшая обёртка над sessionStorage с безопасными фолбэками.
// Используем ТОЛЬКО для UI-состояний (challenge, resend-таймер и пр.).
// Access-токены в web-флоу не храним — держим в памяти (см. api.js).

const NS = 'gluone:';

// Проверяем доступность sessionStorage (Safari ITP / приватный режим и т.п.)
const hasSession = (() => {
  try {
    const k = '__t__';
    sessionStorage.setItem(k, '1');
    sessionStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

// Проверяем доступность localStorage (некоторые браузеры запрещают sessionStorage)
const hasLocal = (() => {
  try {
    const k = '__t__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

// Выбираем доступное хранилище: sessionStorage → localStorage → Map
const store = hasSession ? sessionStorage : (hasLocal ? localStorage : null);

// Фолбэк-хранилище в памяти (на случай запрета и sessionStorage, и localStorage)
const mem = new Map();
function k(key) { return NS + key; }

// Ключи, которые могут использоваться фронтом
export const KEYS = Object.freeze({
  CHALLENGE   : 'auth_challenge',   // шаг подтверждения входа/регистрации
  TOKEN       : 'auth_token',       // legacy: НЕ ИСПОЛЬЗУЕМ в web-флоу
  STATE       : 'auth_state',       // лёгкий UI-стейт (флаги подписки и т.п.)
  RESEND_UNTIL: 'resend_until_ts'   // таймер повторной отправки кода
});

// Лёгкая миграция: выпилим старый токен из сессии, чтобы случайно не использовать
try {
  const name = k(KEYS.TOKEN);
  if (store) store.removeItem(name);
  else mem.delete(name);
} catch {}

/* ======================== базовые операции ======================== */

export function save(key, value) {
  try {
    const name = k(key);
    if (value === undefined || value === null) { del(key); return; }
    const str = JSON.stringify(value);
    if (store) store.setItem(name, str);
    else mem.set(name, str);
  } catch {}
}

export function load(key, fallback = null) {
  const name = k(key);
  try {
    const raw = store ? store.getItem(name) : mem.get(name);
    if (!raw && raw !== '0') return fallback;

    // Пытаемся распарсить JSON; если не получилось — аккуратно вернуть примитив
    try { return JSON.parse(raw); }
    catch {
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      const num = Number(raw);
      if (!Number.isNaN(num) && String(num).trim() !== '') return num;
      return fallback;
    }
  } catch {
    return fallback;
  }
}

export function del(key) {
  try {
    const name = k(key);
    if (store) store.removeItem(name);
    else mem.delete(name);
  } catch {}
}

/* ======================== доп. хелперы ======================== */

// Сохранить значение с TTL (в миллисекундах)
export function saveTTL(key, value, ttlMs) {
  const payload = { v: value, exp: Date.now() + Math.max(0, ttlMs | 0) };
  save(key, payload);
}

// Загрузить значение с TTL; при истечении — ключ удалится и вернётся fallback
export function loadTTL(key, fallback = null) {
  const payload = load(key, null);
  if (!payload || typeof payload !== 'object') return fallback;
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) { del(key); return fallback; }
  return payload.v ?? fallback;
}

// Мягкий merge для объектов
export function merge(key, patch) {
  const cur = load(key, {}) || {};
  if (typeof cur !== 'object' || cur === null) return save(key, patch);
  save(key, { ...cur, ...patch });
}

// Удобный вайп авторизационных следов на фронте (используйте при logout/удалении)
export function clearAuthStorage() {
  try {
    del(KEYS.STATE);
    del(KEYS.CHALLENGE);
    del(KEYS.RESEND_UNTIL);
    del(KEYS.TOKEN); // на всякий случай, legacy
  } catch {}
}
