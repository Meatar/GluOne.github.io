export const KEYS = {
  CHALLENGE: 'auth_challenge',
  TOKEN: 'auth_token',
  STATE: 'auth_state',
  RESEND_UNTIL: 'resend_until_ts'
};

export function save(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export function load(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function del(key) { try { sessionStorage.removeItem(key); } catch {} }
