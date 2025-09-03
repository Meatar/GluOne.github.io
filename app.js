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

  // Helper: fetch с таймаутом
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

    const payload = { username: loginI.value.trim(), password: passI.value };

    submit.disabled = true; submit.style.opacity = .7;
    try {
      const res = await fetchWithTimeout('https://api.gluone.ru/auth/web/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 15000
      });

      if (res.status === 200) {
        let data = {};
        try { data = await res.json(); } catch(_) {}
        // data: { challenge_id, expires_in, email }
        try {
          sessionStorage.setItem('auth_challenge', JSON.stringify({
            challenge_id: data?.challenge_id ?? null,
            email: data?.email ?? null,
            expires_in: data?.expires_in ?? null,  // сек
            ts: Date.now()
          }));
        } catch(_) {}

        formMsg.textContent = data?.email
          ? `Код отправлен на ${data.email}. Введите его для подтверждения.`
          : 'Код подтверждения отправлен. Проверьте почту.';
        formMsg.style.color = '#059669';

        // Переходим на экран подтверждения
        const next = '/confirm.html';
        try {
          fetch(next, { method: 'HEAD' }).then(r => { if (r.ok) window.location.href = next; });
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

// ===== Confirm module (страница подтверждения) =========================
(function () {
  const form   = document.getElementById('confirmForm');
  if (!form) return;

  const inputs = Array.from(document.querySelectorAll('.otp-input'));
  const codeE  = document.getElementById('codeError');
  const msg    = document.getElementById('confirmMsg');
  const masked = document.getElementById('maskedEmail');
  const validT = document.getElementById('validityText');
  const resendBtn = document.getElementById('resendBtn');
  const resendTimerEl = document.getElementById('resendTimer');
  const confirmBtn = document.getElementById('confirmBtn');

  // Читаем контекст из sessionStorage
  let challenge = {};
  try { challenge = JSON.parse(sessionStorage.getItem('auth_challenge') || '{}'); } catch(_) {}

  // Маскируем e-mail
  const maskEmail = (em) => {
    if (!em || !em.includes('@')) return '***@***';
    const [u, d] = em.split('@');
    const mu = u.length <= 2 ? u[0] + '*' : u.slice(0,2) + '****';
    const md = d.length <= 2 ? '*' : d[0] + '****';
    return `${mu}@${md}…`;
  };
  if (challenge.email && masked) masked.textContent = maskEmail(challenge.email);

  // «Код действует …» из expires_in (сек → минут, округление вверх)
  const minutes = Math.max(1, Math.ceil((Number(challenge.expires_in) || 600) / 60));
  if (validT) validT.textContent = `${minutes} минут`;

  // Вспомогалки
  const setError = (text) => { codeE.textContent = text || ''; codeE.hidden = !text; };
  const clearMsg = () => { msg.textContent = ''; msg.style.color = ''; };

  // Автопереход между ячейками + фильтр только цифры
  inputs.forEach((el, idx) => {
    el.addEventListener('input', (e) => {
      el.value = el.value.replace(/\D/g, '').slice(0,1);
      if (el.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      setError('');
      clearMsg();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !el.value && idx > 0) inputs[idx - 1].focus();
    });
    el.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text) return;
      e.preventDefault();
      const digits = text.replace(/\D/g, '').slice(0, inputs.length).split('');
      inputs.forEach((inp, i) => { inp.value = digits[i] || ''; });
      (digits.length >= inputs.length ? confirmBtn : inputs[digits.length] || el).focus();
    });
  });

  // 45-секундный таймер для «Отправить повторно»
  const RESEND_COOLDOWN = 45; // сек
  let resendLeft = RESEND_COOLDOWN;
  let resendTimerId = null;

  function formatMMSS(s){
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sec = (s%60).toString().padStart(2,'0');
    return `${m}:${sec}`;
  }
  function startResendTimer(){
    resendBtn.disabled = true;
    resendLeft = RESEND_COOLDOWN;
    resendTimerEl.textContent = formatMMSS(resendLeft);
    clearInterval(resendTimerId);
    resendTimerId = setInterval(() => {
      resendLeft -= 1;
      resendTimerEl.textContent = formatMMSS(Math.max(0, resendLeft));
      if (resendLeft <= 0){
        clearInterval(resendTimerId);
        resendBtn.disabled = false;
        resendBtn.title = 'Отправить код ещё раз';
      }
    }, 1000);
  }
  startResendTimer();

  // Сабмит подтверждения (логика API добавим позже по необходимости)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = inputs.map(i => i.value).join('');
    if (code.length !== inputs.length){
      setError('Введите полный код из письма.');
      return;
    }
    // Здесь будет вызов /auth/web/login/verify
    msg.textContent = 'Проверяем код…';
    msg.style.color = '';
  });

  // Клик «Отправить повторно» — только визуальный хук и перезапуск таймера
  resendBtn.addEventListener('click', () => {
    if (resendBtn.disabled) return;
    // Здесь будет вызов /auth/web/login/resend
    msg.textContent = 'Новый код отправлен. Проверьте почту.';
    msg.style.color = '#059669';
    startResendTimer();
  });

  // Фокус на первую ячейку
  inputs[0]?.focus();
})();
