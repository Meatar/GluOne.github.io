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

  // ---- Контекст шага
  let challenge = {};
  try { challenge = JSON.parse(sessionStorage.getItem('auth_challenge') || '{}'); } catch(_) {}
  const challengeId = challenge?.challenge_id || null;

  // Маска e-mail
  const maskEmail = (em) => {
    if (!em || !em.includes('@')) return '***@***';
    const [u, d] = em.split('@');
    const mu = (u.length <= 2) ? (u[0] || '*') + '****' : u.slice(0,2) + '****';
    const md = d ? d[0] + '****' : '****';
    return `${mu}@${md}…`;
  };
  if (challenge.email && masked) masked.textContent = maskEmail(challenge.email);

  // «Код действует …» из expires_in
  const minutes = Math.max(1, Math.ceil((Number(challenge.expires_in) || 600) / 60));
  if (validT) validT.textContent = `${minutes} минут`;

  // ---- UX helpers
  const setError = (t) => { codeE.textContent = t || ''; codeE.hidden = !t; };
  const setMsg   = (t, color='') => { msg.textContent = t || ''; msg.style.color = color; };

  // Инпуты
  inputs.forEach((el, i) => {
    el.value = '';
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '').slice(0,1);
      if (el.value && i < inputs.length - 1) inputs[i + 1].focus();
      setError(''); setMsg('');
      if (inputs.every(x => x.value && /^\d$/.test(x.value))) confirmBtn.click();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !el.value && i > 0) inputs[i - 1].focus();
    });
    el.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text) return;
      e.preventDefault();
      const digits = text.replace(/\D/g, '').slice(0, inputs.length).split('');
      inputs.forEach((inp, idx) => { inp.value = digits[idx] || ''; });
      (digits.length >= inputs.length ? confirmBtn : inputs[digits.length] || el).focus();
    });
  });
  inputs[0]?.focus();

  // ---- Кулдаун повторной отправки (45с) с сохранением
  const RESEND_COOLDOWN_S = 45;
  let   timerId = null;
  const loadCooldownLeft = () => {
    const until = Number(sessionStorage.getItem('resend_until_ts') || 0);
    const left = Math.ceil((until - Date.now()) / 1000);
    return Math.max(0, left);
  };
  const saveCooldown = (s) => sessionStorage.setItem('resend_until_ts', String(Date.now() + s*1000));
  const fmtMMSS = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  function startCooldown(seconds){
    clearInterval(timerId);
    saveCooldown(seconds);
    resendBtn.disabled = true;
    let left = seconds;
    resendTimerEl.textContent = fmtMMSS(left);
    timerId = setInterval(() => {
      left -= 1;
      const l = Math.max(0, left);
      resendTimerEl.textContent = fmtMMSS(l);
      if (l <= 0) {
        clearInterval(timerId);
        resendBtn.disabled = false;
        resendBtn.title = 'Отправить код ещё раз';
        sessionStorage.removeItem('resend_until_ts');
      }
    }, 1000);
  }
  const left0 = loadCooldownLeft();
  if (left0 > 0) startCooldown(left0);
  else { resendBtn.disabled = false; resendTimerEl.textContent = fmtMMSS(0); }

  // ---- Повторная отправка
  resendBtn.addEventListener('click', async () => {
    if (resendBtn.disabled) return;
    if (!challengeId) { setMsg('Нет идентификатора сессии подтверждения. Вернитесь на шаг входа.', '#e11d48'); return; }
    resendBtn.disabled = true;
    setMsg('Отправляем новый код…');
    try {
      const res = await fetch('https://api.gluone.ru/auth/web/login/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
        body: JSON.stringify({ challenge_id: challengeId })
      });
      if (res.status === 204) {
        setMsg('Новый код отправлен. Проверьте почту.', '#059669');
        startCooldown(RESEND_COOLDOWN_S);
      } else if (res.status === 422) {
        let data = null; try { data = await res.json(); } catch(_){}
        setMsg('Не удалось отправить код: ' + (data?.detail?.[0]?.msg || 'ошибка запроса'), '#e11d48');
        resendBtn.disabled = false;
      } else {
        setMsg('Ошибка отправки кода: ' + res.status, '#e11d48');
        resendBtn.disabled = false;
      }
    } catch (_) {
      setMsg('Сеть недоступна. Попробуйте позже.', '#e11d48');
      resendBtn.disabled = false;
    }
  });

  // ---- Проверка кода
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = inputs.map(i => i.value).join('');
    if (code.length !== inputs.length){ setError('Введите полный код из письма.'); return; }
    if (!challengeId){ setMsg('Сессия подтверждения не найдена. Вернитесь на шаг входа.', '#e11d48'); return; }

    setMsg('Проверяем код…');
    try {
      const res = await fetch('https://api.gluone.ru/auth/web/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include', // получаем HttpOnly cookie
        body: JSON.stringify({ challenge_id: challengeId, code })
      });

      if (res.status === 200){
        let data = null; try { data = await res.json(); } catch(_){}
        // { access_token, token_type, is_premium, premium_expires_at }
        // ВАЖНО: access_token НЕ сохраняем в JS-хранилища
        try {
          sessionStorage.setItem('auth_state', JSON.stringify({
            is_premium: !!data?.is_premium,
            premium_expires_at: data?.premium_expires_at || null,
            ts: Date.now()
          }));
        } catch(_){}
        setMsg('Готово! Входим…', '#059669');
        const params = new URLSearchParams(location.search);
        const next = params.get('next') || '/cabinet.html';
        window.location.href = next;
      }
      else if (res.status === 422){
        let data = null; try { data = await res.json(); } catch(_){}
        setMsg(data?.detail?.[0]?.msg || 'Некорректный код.', '#e11d48');
      }
      else{
        setMsg('Не удалось подтвердить код: ' + res.status, '#e11d48');
      }
    } catch (err) {
      setMsg('Сеть недоступна. Попробуйте ещё раз.', '#e11d48');
      console.error(err);
    }
  });
})();

// ===== Cabinet module (страница личного кабинета) =====================
(function () {
  const card = document.getElementById('meCard');
  if (!card) return;

  const el = (id) => document.getElementById(id);
  const meUsername = el('meUsername');
  const meEmail    = el('meEmail');
  const meAvatar   = el('meAvatar');
  const mePremium  = el('mePremium');
  const mePremiumNote = el('mePremiumNote');
  const meActive   = el('meActive');
  const meRoles    = el('meRoles');
  const meGender   = el('meGender');
  const meBirth    = el('meBirth');
  const meDiabetes = el('meDiabetes');
  const meMsg      = el('meMsg');

  const maskEmail = (em) => {
    if (!em || !em.includes('@')) return '***@***';
    const [u, d] = em.split('@');
    const mu = (u.length <= 2) ? (u[0] || '*') + '****' : u.slice(0,2) + '****';
    const md = d ? d[0] + '****' : '****';
    return `${mu}@${md}…`;
  };
  const ageFrom = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d)) return null;
    const n = new Date();
    let age = n.getUTCFullYear() - d.getUTCFullYear();
    const m = n.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) age--;
    return age;
  };
  const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('ru-RU', {year:'numeric', month:'long', day:'numeric'}); }
    catch { return iso; }
  };
  const mapGender = (g) => ({male:'Мужской', female:'Женский'})[g] || '—';
  const mapDia    = (t) => ({type1:'Тип 1', type2:'Тип 2', gestational:'Гестационный'})[t] || '—';

  async function loadMe(){
    meMsg.textContent = 'Загружаем профиль…';
    try {
      const res = await fetch('https://api.gluone.ru/auth/web/me', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      if (res.status === 200){
        const data = await res.json();
        // Заполняем
        meUsername.textContent = data?.username || 'Без имени';
        meEmail.textContent    = data?.email ? maskEmail(data.email) : '—';
        meAvatar.textContent   = (data?.username || data?.email || 'U').trim()[0].toUpperCase();
        meActive.textContent   = data?.is_active ? 'Активен' : 'Неактивен';
        meGender.textContent   = mapGender(data?.gender);
        meBirth.textContent    = data?.birth_date ? `${fmtDate(data.birth_date)}${ageFrom(data.birth_date) ? ` · ${ageFrom(data.birth_date)} лет` : ''}` : '—';
        meDiabetes.textContent = mapDia(data?.diabetes_type);

        // Роли — чипами
        meRoles.innerHTML = '';
        (Array.isArray(data?.roles) ? data.roles : []).forEach(r => {
          const chip = document.createElement('span');
          chip.className = 'chip';
          chip.textContent = r;
          meRoles.appendChild(chip);
        });

        // Премиум
        const premium = !!data?.is_premium;
        if (premium){
          mePremium.hidden = false;
          const exp = data?.premium_expires_at ? new Date(data.premium_expires_at) : null;
          mePremiumNote.hidden = false;
          mePremiumNote.textContent = exp
            ? `Подписка Premium активна до ${exp.toLocaleString('ru-RU', { year:'numeric', month:'long', day:'numeric' })}.`
            : 'Подписка Premium активна.';
        } else {
          mePremium.hidden = true;
          mePremiumNote.hidden = true;
        }

        meMsg.textContent = '';
      }
      else if (res.status === 401){
        // неавторизован — уводим на вход
        window.location.href = '/auth.html?next=%2Fcabinet.html';
      }
      else {
        meMsg.textContent = 'Ошибка загрузки профиля: ' + res.status;
      }
    } catch (e) {
      meMsg.textContent = 'Сеть недоступна. Обновите страницу.';
      console.error(e);
    } finally {
      card.removeAttribute('aria-busy');
    }
  }

  loadMe();
})();
