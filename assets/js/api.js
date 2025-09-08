// api.js
const API = 'https://api.gluone.ru';

/**
 * Базовый запрос с таймаутом.
 * Для web-флоу почти везде нужна cookie-авторизация → по умолчанию шлём credentials: 'include'.
 */
async function request(
  path,
  { method = 'GET', headers = {}, body, timeout = 15000, credentials = 'include' } = {}
) {
  const ctrl = new AbortController();
  const tId = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body,
      signal: ctrl.signal,
      ...(credentials ? { credentials } : {})
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(tId);
  }
}

/* ======================== helpers ======================== */

/** Читаем CSRF-токен (если кладёте его в <meta name="csrf-token" content="...">) */
function readCsrfFromMeta() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

/**
 * Грубая идентификация браузера для X-Device-Id.
 * Стабильная короткая строка по браузеру/сессии (не «фингерпринт»).
 */
function getBrowserDeviceId() {
  try {
    const nav = navigator;
    if (nav.userAgentData?.brands?.length) {
      const brands = nav.userAgentData.brands
        .filter(b => !/Not.?A.?Brand/i.test(b.brand))
        .map(b => `${b.brand} ${b.version}`.trim())
        .join('; ');
      const mobile = nav.userAgentData.mobile ? ' Mobile' : '';
      return `Web (${brands})${mobile}`.slice(0, 120);
    }
    const ua = (nav.userAgent || '').toLowerCase();
    const isChrome = /chrome|crios|crmo/.test(ua) && !/edg|opr\//.test(ua);
    const isEdge   = /edg\//.test(ua);
    const isFirefox= /firefox|fxios/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome|crios|crmo|android/.test(ua);
    let name = isEdge ? 'Edge'
             : isChrome ? 'Chrome'
             : isFirefox ? 'Firefox'
             : isSafari  ? 'Safari'
             : 'Browser';
    let version = '';
    const m =
      (isEdge && ua.match(/edg\/([\d.]+)/)) ||
      (isChrome && ua.match(/(?:chrome|crios)\/([\d.]+)/)) ||
      (isFirefox && ua.match(/(?:firefox|fxios)\/([\d.]+)/)) ||
      (isSafari && ua.match(/version\/([\d.]+)/));
    if (m) version = m[1];
    const platform = nav.platform || nav.userAgent || '';
    return `Web ${name}${version ? ' ' + version : ''} (${platform})`.slice(0, 120);
  } catch {
    return 'Web Browser';
  }
}

/* ======================== REGISTER (новый аккаунт) ======================== */
// POST /auth/web/register  -> { challenge_id, expires_in, email }
export function authRegister(username, email, password) {
  return request('/auth/web/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
}

// POST /auth/web/register/verify  -> HttpOnly refresh-cookie + { access_token }
export function authRegisterVerify(challenge_id, code) {
  return request('/auth/web/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ challenge_id, code })
  });
}

// POST /auth/web/register/resend  -> 204
export function authRegisterResend(challenge_id) {
  return request('/auth/web/register/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ challenge_id })
  });
}

/* ======================== LOGIN (код в два шага) ======================== */
// POST /auth/web/login  -> { challenge_id, expires_in, email }
export function authLogin(username, password) {
  return request('/auth/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}

// POST /auth/web/login/verify  -> HttpOnly refresh-cookie + { access_token }
export function authLoginVerify(challenge_id, code) {
  return request('/auth/web/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ challenge_id, code })
  });
}

// POST /auth/web/login/resend -> 204
export function authLoginResend(challenge_id) {
  return request('/auth/web/login/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ challenge_id })
  });
}

/* ======================== REFRESH / LOGOUT ======================== */
// POST /auth/web/refresh  (нужны HttpOnly refresh-cookie + CSRF)
export function authRefresh(csrfToken = readCsrfFromMeta()) {
  const headers = { 'Accept': 'application/json' };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return request('/auth/web/refresh', { method: 'POST', headers });
}

// POST /auth/web/logout  (CSRF + cookie), 204
export function authLogout(csrfToken = readCsrfFromMeta()) {
  const headers = { 'Accept': '*/*' };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return request('/auth/web/logout', { method: 'POST', headers });
}

/* ======================== ME (cookie-авторизация) ======================== */
// GET /auth/web/me -> данные пользователя и подписки
export function authMe({ deviceId } = {}) {
  return request('/auth/web/me', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Device-Id': (deviceId || getBrowserDeviceId())
    }
  });
}

/* ======================== DEVICES (cookie-авторизация) ======================== */
// GET /auth/web/devices -> список устройств
export function authDevices() {
  return request('/auth/web/devices', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
}

// POST /auth/web/devices/revoke -> 204
export function authRevokeDevice(device_id) {
  return request('/auth/web/devices/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ device_id })
  });
}

// POST /auth/web/devices/delete -> 204
export function authDeleteDevice(device_id) {
  return request('/auth/web/devices/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ device_id })
  });
}

/* ======================== PASSWORD & ACCOUNT (WEB) ======================== */
// POST /auth/web/recover-password -> 204 (письмо отправлено)
export function authRecoverPassword(email) {
  return request('/auth/web/recover-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ email })
  });
}

// POST /auth/web/change-password -> 204
export function authChangePassword(username, old_password, new_password) {
  return request('/auth/web/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ username, old_password, new_password })
  });
}

// POST /auth/web/delete -> 204 + очистка cookie
export function authDeleteAccount(username, password) {
  return request('/auth/web/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ username, password })
  });
}

/* ======================== PREMIUM TRANSFER ======================== */
// POST /auth/web/premium/transfer -> { device_id, expires_at }
export function authPremiumTransfer(device_id) {
  return request('/auth/web/premium/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ device_id })
  });
}

/* ======================== SUBSCRIPTIONS & PAYMENTS (WEB) ======================== */
// GET /auth/web/subscriptions -> список планов
export function authSubscriptions() {
  return request('/auth/web/subscriptions', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
}

// POST /auth/web/payments/order -> { order_id }
export function authCreateSubscriptionOrder(user_id, device_id, subscription_plan_id) {
  const payload = { user_id, subscription_plan_id };
  if (device_id) payload.device_id = device_id;
  return request('/auth/web/payments/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export {
  getBrowserDeviceId,
  readCsrfFromMeta
};
