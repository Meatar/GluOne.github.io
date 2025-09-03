const API = 'https://api.gluone.ru';

/**
 * Базовый запрос с таймаутом.
 * @param {string} path
 * @param {Object} [opts]
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [opts.method='GET']
 * @param {Object} [opts.headers={}]
 * @param {BodyInit|null} [opts.body]
 * @param {number} [opts.timeout=15000]
 * @param {'omit'|'same-origin'|'include'} [opts.credentials]  // при необходимости можно пробрасывать куки
 */
async function request(path, { method = 'GET', headers = {}, body, timeout = 15000, credentials } = {}) {
  const ctrl = new AbortController();
  const tId = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body,
      signal: ctrl.signal,
      ...(credentials ? { credentials } : {}) // добавляем только если передали
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(tId);
  }
}

/**
 * Логин (этап 1)
 */
export function authLogin(username, password) {
  return request('/auth/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}

/**
 * Подтверждение кода (этап 2)
 */
export function authVerify(challenge_id, code) {
  return request('/auth/web/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ challenge_id, code })
  });
}

/**
 * Повторная отправка кода
 */
export function authResend(challenge_id) {
  return request('/auth/web/login/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ challenge_id })
  });
}

/**
 * Данные профиля текущего пользователя
 */
export function authMe(accessToken) {
  return request('/auth/web/me', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

/**
 * Выход (инвалидирует refresh/сессию на сервере)
 * ВАЖНО: credentials: 'include' — чтобы ушли куки (refresh/csrf), если они используются
 */
export async function authLogout(csrfToken) {
  const headers = { 'Accept': '*/*' };
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  return request('/auth/web/logout', {
    method: 'POST',
    headers,
    credentials: 'include' // отправляем куки
  });
}

/**
 * Тип устройства (JSDoc для удобства)
 * @typedef {Object} AuthDevice
 * @property {string} device_id
 * @property {string} model
 * @property {string} os
 * @property {string} app_build
 * @property {string} created_at
 * @property {string} last_seen_at
 * @property {string} last_ip
 * @property {boolean} revoked
 * @property {boolean} current
 */

/**
 * Список устройств, с которых пользователь авторизовывался
 * GET /auth/web/devices
 * @param {string} accessToken - Bearer токен
 * @returns {Promise<{ok: boolean, status: number, data: AuthDevice[] | null}>}
 */
export function authDevices(accessToken) {
  return request('/auth/web/devices', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
}
