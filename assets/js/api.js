const API = 'https://api.gluone.ru';

async function request(path, { method = 'GET', headers = {}, body, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const tId = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers,
      body,
      signal: ctrl.signal
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : null;
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(tId);
  }
}

export function authLogin(username, password) {
  return request('/auth/web/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username, password })
  });
}

export function authVerify(challenge_id, code) {
  return request('/auth/web/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ challenge_id, code })
  });
}

export function authResend(challenge_id) {
  return request('/auth/web/login/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
    body: JSON.stringify({ challenge_id })
  });
}

export function authMe(accessToken) {
  return request('/auth/web/me', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  });
}
