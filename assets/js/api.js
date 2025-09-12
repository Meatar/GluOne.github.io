// api.js — cookie-first: refresh в HttpOnly cookie, access — только в памяти (не в storage).
const API = 'https://api.gluone.ru';

/* ======================== access-токен в памяти ======================== */
let ACCESS_TOKEN = null;
export function setAccessToken(t) { ACCESS_TOKEN = t || null; }
export function getAccessToken() { return ACCESS_TOKEN || null; }
export function clearAccessToken() { ACCESS_TOKEN = null; }

/* ======================== helpers ======================== */
function readCookie(name) {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-./\\^$*+?()[\]{}|]/g, '\\$&') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  } catch { return ''; }
}
export function getCsrfToken() {
  // сервер ставит видимую куку csrf_token
  return readCookie('csrf_token') || '';
}

/* базовый запрос */
async function request(
  path,
  { method = 'GET', headers = {}, body, timeout = 15000, credentials = 'include' } = {}
) {
  const ctrl = new AbortController();
  const tId = setTimeout(() => ctrl.abort(), timeout);

  const h = { ...headers };
  const access = getAccessToken();
  if (access) h['Authorization'] = `Bearer ${access}`;

  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: h,
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

/* ======================== AUTH (WEB) ======================== */
// REGISTER
export function authRegister(username, email, password, gender, birth_date, diabetes_type) {
  return request('/auth/web/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, email, password, gender, birth_date, diabetes_type })
  });
}
export function authRegisterVerify(challenge_id, code) {
  return request('/auth/web/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ challenge_id, code })
  });
}
export function authRegisterResend(challenge_id) {
  return request('/auth/web/register/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ challenge_id })
  });
}

// LOGIN (step 1 -> challenge)
export function authLogin(username, password) {
  return request('/auth/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}
// LOGIN VERIFY (step 2 -> ставит refresh_cookie + csrf_cookie, возвращает {access_token})
export function authLoginVerify(challenge_id, code) {
  return request('/auth/web/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ challenge_id, code })
  });
}
export function authLoginResend(challenge_id) {
  return request('/auth/web/login/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ challenge_id })
  });
}

// REFRESH (cookie) — требует X-CSRF-Token
export async function authRefresh() {
  const csrf = getCsrfToken();
  const headers = { 'Accept': 'application/json' };
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const resp = await request('/auth/web/refresh', { method: 'POST', headers });
  if (resp?.ok && resp.data?.access_token) {
    setAccessToken(resp.data.access_token);
  }
  return resp;
}

// LOGOUT — требует X-CSRF-Token, чистит refresh/csrf куки на сервере
export async function authLogout() {
  const csrf = getCsrfToken();
  const headers = { 'Accept': '*/*' };
  if (csrf) headers['X-CSRF-Token'] = csrf;
  return request('/auth/web/logout', { method: 'POST', headers });
}

// ME — только Bearer access
export function authMe() {
  return request('/auth/web/me', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
}

/* ======================== DEVICES ======================== */
export function authDevices() {
  return request('/auth/web/devices', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
}
export function authRevokeDevice(device_id) {
  return request('/auth/web/devices/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ device_id })
  });
}
export function authDeleteDevice(device_id) {
  return request('/auth/web/devices/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ device_id })
  });
}

/* ======================== PASSWORD / ACCOUNT ======================== */
export function authRecoverPassword(email) {
  return request('/auth/web/recover-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ email })
  });
}
export function authChangePassword(username, old_password, new_password) {
  return request('/auth/web/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ username, old_password, new_password })
  });
}
export function authDeleteAccount(username, password) {
  return request('/auth/web/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ username, password })
  });
}

/* ======================== PREMIUM / PAYMENTS ======================== */
export function authPremiumTransfer(device_id) {
  return request('/auth/web/premium/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ device_id })
  });
}
export function authSubscriptions() {
  return request('/auth/web/subscriptions', {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
}
export async function authCreateSubscriptionOrder(user_id, device_id, subscription_plan_id) {
  const payload = { user_id, device_id, subscription_plan_id };
  const res = await request('/auth/web/payments/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  const { payment_url, order_id, payment_id } = res.data || {};
  return { ...res, data: { payment_url, order_id, payment_id } };
}

// Список оплат пользователя
export async function authPaymentsList(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
  }
  const qs = q.toString();

  const res = await request(`/payments/payments${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  let payments = [];
  let next   = null;
  let limit  = null;
  let total  = null;

  const data = res?.data;
  if (Array.isArray(data)) {
    payments = data;
  } else if (data && typeof data === "object") {
    payments = data.payments || [];
    next    = data.next  ?? null;
    limit   = data.limit ?? null;
    total   = data.total ?? null;
  }

  return {
    ok:    !!res?.ok,              // сохраняем явно
    status: res?.status ?? 200,    // сохраняем явно
    // при необходимости прокиньте еще res.error/res.headers и т.п.
    data: { payments, next, limit, total },
  };
}
