// ===== Footer year (если есть элемент с id="y") ========================
(function () {
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();
})();

// ===== Feature Tabs (главная) =========================================
(function () {
  const tabs   = Array.from(document.querySelectorAll('.feature-tab'));
  const panels = Array.from(document.querySelectorAll('.feature-panel'));
  if (!tabs.length || !panels.length) return;

  function activate(panelId) {
    tabs.forEach(btn => {
      const on = btn.dataset.panel === panelId;
      btn.classList.toggle('bg-slate-900', on);
      btn.classList.toggle('text-white', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.id === panelId;
      p.classList.toggle('hidden', !on);
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.panel)));
  const initial = document.querySelector('.feature-tab[aria-selected="true"]');
  activate(initial ? initial.dataset.panel : 'panel-track');
})();

// ===== Auth module (страница авторизации) ==============================
(function () {
  const form = document.getElementById('authForm');
  if (!form) return;

  const loginI  = document.getElementById('login');
  const passI   = document.getElementById('password');
  const toggle  = document.getElementById('togglePass');
  const submit  = document.getElementById('submitBtn');
  const loginE  = document.getElementById('loginError');
  const passE   = document.getElementById('passwordError');
  const formMsg = document.getElementById('formMsg');

  // Переключатель видимости пароля (по умолчанию скрыт)
  passI.type = 'password';
  if (toggle) {
    toggle.dataset.state = 'hidden';
    toggle.addEventListener('click', () => {
      const nowHidden = passI.type === 'password';
      passI.type = nowHidden ? 'text' : 'password';
      toggle.dataset.state = nowHidden ? 'visible' : 'hidden';
      toggle.setAttribute('aria-label', nowHidden ? 'Скрыть пароль' : 'Показать пароль');
      toggle.setAttribute('title',      nowHidden ? 'Скрыть пароль' : 'Показать пароль');
    });
  }

  // Жёсткие требования (не показываем пользователю)
  loginI.setAttribute('minlength', '3');
  loginI.setAttribute('maxlength', '30');
  loginI.setAttribute('pattern', '^[A-Za-z0-9._-]{3,30}$');

  passI.setAttribute('minlength', '12');
  passI.setAttribute('maxlength', '72');
  passI.setAttribute('pattern', '^(?=.{12,72}$)(?!.*\\s)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s])[\\x21-\\x7E]+$');

  // Лаконичные тексты ошибок — без раскрытия правил
  const explainLogin = (el) => {
    if (el.validity.valueMissing) return 'Введите логин.';
    if (!el.checkValidity())     return 'Некорректный логин.';
    return '';
  };
  const explainPass = (el) => {
    if (el.validity.valueMissing) return 'Введите пароль.';
    if (!el.checkValidity())      return 'Некорректный пароль.';
    return '';
  };
  const showError  = (el, errEl, text) => { errEl.textContent = text; errEl.hidden = !text; el.setAttribute('aria-invalid','true'); };
  const clearError = (el, errEl)       => { errEl.textContent = '';  errEl.hidden = true;  el.removeAttribute('aria-invalid'); };

  loginI.addEventListener('input', () => clearError(loginI, loginE));
  passI .addEventListener('input', () => clearError(passI,  passE));

  // Небольшой helper для таймаута fetch (чтобы UI не «висел» бесконечно)
  async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 15000, ...rest } = options;
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(resource, { ...rest, signal: ctrl.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    formMsg.textContent = '';
    formMsg.className   = 'form-hint';
    formMsg.style.color = '';

    let invalid = false;
    if (!loginI.checkValidity()) { showError(loginI, loginE, explainLogin(loginI)); invalid = true; }
    if (!passI.checkValidity())  { showError(passI,  passE,  explainPass(passI));   invalid = true; }
    if (invalid) return;

    // ⚠️ Бэкенд ожидает поля username, а не login
    const payload = { username: loginI.value.trim(), password: passI.value };

    submit.disabled = true; submit.style.opacity = .7;
    try {
      const res = await fetchWithTimeout('https://api.gluone.ru/auth/web/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 15000
      });

      // Разбираем ответы согласно спецификации
      if (res.status === 200) {
        let data = {};
        try { data = await res.json(); } catch(_) {}
        // data: { challenge_id, expires_in, email }
        // Сохраняем challenge для второго шага
        try {
          sessionStorage.setItem('auth_challenge', JSON.stringify({
            challenge_id: data?.challenge_id ?? null,
            email: data?.email ?? null,
            expires_in: data?.expires_in ?? null,
            ts: Date.now()
          }));
        } catch(_) {}

        formMsg.textContent = data?.email
          ? `Код отправлен на ${data.email}. Введите его для подтверждения.`
          : 'Код подтверждения отправлен. Проверьте почту.';

        formMsg.style.color = '#059669';

        // Если есть страница подтверждения — переходим
        // (попробуем мягко: сначала HEAD-запрос; если нельзя — просто редиректнемся)
        const next = '/confirm.html';
        try {
          fetch(next, { method: 'HEAD' }).then(r => {
            if (r.ok) window.location.href = next;
          }).catch(() => { /* молча игнорируем */ });
        } catch(_) {}
      }
      else if (res.status === 400) {
        formMsg.textContent = 'У вашего аккаунта не указан e-mail. Невозможно отправить код.';
        formMsg.style.color = '#e11d48';
      }
      else if (res.status === 401) {
        formMsg.textContent = 'Неверный логин или пароль.';
        formMsg.style.color = '#e11d48';
      }
      else if (res.status === 403) {
        formMsg.textContent = 'Аккаунт заблокирован или неактивен.';
        formMsg.style.color = '#e11d48';
      }
      else if (res.status === 429) {
        formMsg.textContent = 'Слишком много попыток. Попробуйте позже.';
        formMsg.style.color = '#e11d48';
      }
      else if (res.status === 500) {
        formMsg.textContent = 'Ошибка при отправке письма. Попробуйте позже.';
        formMsg.style.color = '#e11d48';
      }
      else if (res.status === 422) {
        let err;
        try { err = await res.json(); } catch(_) {}
        const msg = (err && err.detail && err.detail[0] && err.detail[0].msg) ? err.detail[0].msg : 'Проверьте введённые данные.';
        formMsg.textContent = 'Некорректные данные: ' + msg;
        formMsg.style.color = '#e11d48';
      }
      else {
        formMsg.textContent = 'Неизвестная ошибка: ' + res.status;
        formMsg.style.color = '#e11d48';
      }
    } catch (err) {
      formMsg.textContent = (err?.name === 'AbortError')
        ? 'Истекло время ожидания ответа сервера.'
        : 'Не удалось соединиться с сервером. Повторите попытку.';
      formMsg.style.color = '#e11d48';
      console.error(err);
    } finally {
      submit.disabled = false; submit.style.opacity = 1;
    }
  });
})();
