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

/* ======================== helpers ======================== */

/**
 * Грубая идентификация браузера для X-Device-Id.
 * Наша цель — стабильная короткая строка по сессии/браузеру, а не уникальный отпечаток.
 */
function getBrowserDeviceId() {
  try {
    // UA-CH (современные браузеры)
    const nav = navigator;
    if (nav.userAgentData?.brands?.length) {
      const brands = nav.userAgentData.brands
        .filter(b => !/Not.?A.?Brand/i.test(b.brand))
        .map(b => `${b.brand} ${b.version}`.trim())
        .join('; ');
      const mobile = nav.userAgentData.mobile ? ' Mobile' : '';
      return `Web (${brands})${mobile}`.slice(0, 120);
    }
    // Fallback на userAgent
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
    // вытащим примерную версию
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

/* ======================== auth: login/verify/resend ======================== */

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

/* ======================== profile/me/logout ======================== */

/**
 * Данные профиля текущего пользователя.
 * Автоматически добавляет X-Device-Id = "название браузера", в котором запущена сессия.
 * Можно переопределить передав deviceId вторым аргументом.
 */
export function authMe(accessToken, { deviceId } = {}) {
  const headers = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'X-Device-Id': (deviceId || getBrowserDeviceId())
  };
  return request('/auth/web/me', { method: 'GET', headers });
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

/* ======================== devices ======================== */

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
 * @property {boolean} [is_premium]
 * @property {string|null} [premium_expires_at]
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
 * Успех: 204 No Content (res.ok === true, data === null)
 * Ошибки: 422 Validation Error и пр.
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
 * Полное удаление записи об устройстве пользователя
 * POST /auth/web/devices/delete
 * Успех: 204 No Content
 */
export function authDeleteDevice(accessToken, deviceId) {
  return request('/auth/web/devices/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': '*/*',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ device_id: deviceId })
  });
}

/* ======================== password & account ======================== */

/**
 * Смена пароля (WEB)
 * POST /auth/web/change-password
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
 */
export function authRecoverPassword(email) {
  return request('/auth/web/recover-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ email })
  });
}

/* ======================== subscriptions (NEW) ======================== */

/**
 * Тип плана подписки (ответ /auth/web/subscriptions)
 * @typedef {Object} SubscriptionPlan
 * @property {string} id               - Идентификатор плана
 * @property {string} name             - Название подписки
 * @property {string} sku              - SKU/код продукта
 * @property {number} duration_months  - Длительность в месяцах
 * @property {number} price            - Стоимость (в минимальных единицах валюты, если так задано на сервере)
 * @property {string} currency         - Валюта (например, "RUB")
 * @property {number} discount         - Скидка (в процентах или единицах, согласно бэкенду)
 * @property {boolean} is_active       - Признак активности плана
 */

/**
 * Получить список доступных web-подписок для текущего пользователя.
 * GET /auth/web/subscriptions
 * Требуется Bearer токен.
 * @param {string} accessToken
 * @returns {Promise<{ok: boolean, status: number, data: SubscriptionPlan[] | null}>}
 */
export function authSubscriptions(accessToken) {
  return request('/auth/web/subscriptions', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

/**
 * Создать заказ на оплату подписки.
 * POST /auth/web/payments/order
 * @param {string} accessToken
 * @param {string} userId
 * @param {string} [deviceId]
 * @param {string} subscriptionPlanId
 * @returns {Promise<{ok: boolean, status: number, data: {order_id: string} | null}>}
 */
export function authCreateSubscriptionOrder(accessToken, userId, deviceId, subscriptionPlanId) {
  const payload = { user_id: userId, subscription_plan_id: subscriptionPlanId };
  if (deviceId) payload.device_id = deviceId;
  return request('/auth/web/payments/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });
}
