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

/**
 * Отозвать (разлогинить) конкретное устройство пользователя
 * POST /auth/web/devices/revoke
 * @param {string} accessToken - Bearer токен
 * @param {string} deviceId    - ID устройства, которое нужно разлогинить
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 *
 * Успех: 204 No Content (res.ok === true, data === null)
 * Ошибки:
 *  - 422 Validation Error (например, пустой/невалидный device_id), data.detail с описанием
 */
export function authRevokeDevice(accessToken, deviceId) {
  return request('/auth/web/devices/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ device_id: deviceId })
  });
}

/**
 * Смена пароля (WEB)
 * POST /auth/web/change-password
 * Возвращает:
 *  - 204 No Content — пароль сменён
 *  - 401 Unauthorized — неверные учётные данные
 *  - 403 Forbidden — пользователь неактивен
 *  - 422 Unprocessable Entity — не прошла валидация
 *  - 429 Too Many Requests — лимит запросов
 */
export function authChangePassword(username, old_password, new_password) {
  return request('/auth/web/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ username, old_password, new_password })
  });
}

/**
 * Полное удаление аккаунта (WEB)
 * POST /auth/web/delete
 * Возвращает:
 *  - 204 No Content — аккаунт удалён
 *  - 401 Unauthorized — неверные учётные данные
 *  - 403 Forbidden — пользователь неактивен
 *  - 422 Unprocessable Entity — не прошла валидация
 *  - 429 Too Many Requests — лимит запросов
 */
export function authDeleteAccount(username, password) {
  return request('/auth/web/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ username, password })
  });
}

/**
 * Восстановление пароля (WEB)
 * POST /auth/web/recover-password
 * @param {string} email
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 *
 * Возможные ответы:
 *  - 204 No Content — письмо отправлено (data === null)
 *  - 404 Not Found — пользователь с указанным адресом не найден
 *  - 422 Unprocessable Entity — ошибка валидации (например, пустой/некорректный e-mail)
 */
export function authRecoverPassword(email) {
  return request('/auth/web/recover-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ email })
  });
}
