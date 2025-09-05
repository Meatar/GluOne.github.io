// confirm.js (login-only)
import { authLoginResend, authLoginVerify } from './api.js';
import { KEYS, load, save, del } from './storage.js';

(function initConfirmModule() {
  const init = () => {
    const form = document.getElementById('confirmForm');
    if (!form) return;

    // Берём инпуты в рамках формы (чтобы не поймать чужие случайно)
    const inputs = Array.from(form.querySelectorAll('.otp-input'));
    const codeE  = document.getElementById('codeError');
    const msg    = document.getElementById('confirmMsg');
    const masked = document.getElementById('maskedEmail');
    const validT = document.getElementById('validityText');
    const resendBtn = document.getElementById('resendBtn');
    const resendTimerEl = document.getElementById('resendTimer');

    // ---------- данные из шага логина ----------
    const challenge = load(KEYS.CHALLENGE, {});
    const challengeId = challenge?.challenge_id || null;

    // -------- доступность/утилиты UI ----------
    if (msg && !msg.getAttribute('aria-live')) {
      msg.setAttribute('aria-live', 'polite');
      msg.setAttribute('role', 'status');
    }
    const setError = (t) => { if (!codeE) return; codeE.textContent = t || ''; codeE.hidden = !t; };
    const setMsg   = (t, color='') => { if (!msg) return; msg.textContent = t || ''; msg.style.color = color; };

    // -------- маска e-mail ----------
    const maskEmail = (em) => {
      if (!em || !em.includes('@')) return '***@***';
      const [u, d] = em.split('@');
      const mu = (u.length <= 2) ? (u[0] || '*') + '****' : u.slice(0,2) + '****';
      const md = d ? d[0] + '****' : '****';
      return `${mu}@${md}…`;
    };
    if (challenge.email && masked) masked.textContent = maskEmail(challenge.email);

    // -------- срок действия кода ----------
    const minutes = Math.max(1, Math.ceil((Number(challenge.expires_in) || 600) / 60));
    if (validT) validT.textContent = `${minutes} минут`;

    // если нет challenge_id — мягко вернём на шаг входа
    if (!challengeId) {
      setMsg('Сессия подтверждения не найдена. Возвращаемся на шаг входа…', '#e11d48');
      setTimeout(() => { window.location.href = '/auth.html'; }, 1200);
      return;
    }

    // ===== Сабмит/верификация =====
    let verifying = false;
    const getCode = () => inputs.map(i => i.value).join('');
    const isDigits = (s) => /^\d+$/.test(s);

    const serverDetail = (data) => {
      if (!data) return '';
      if (typeof data.detail === 'string') return data.detail;
      const d0 = Array.isArray(data.detail) ? data.detail[0] : null;
      return d0?.msg || '';
    };

    // маппинг ошибок по спецификации LOGIN /verify
    function mapVerifyError(status, data){
      const d = serverDetail(data);
      switch (status) {
        case 400: return d || 'Неверный или просроченный код. Запросите новый и попробуйте снова.';
        case 404: return d || 'Пользователь не найден. Повторите вход.';
        default : return d || `Не удалось подтвердить код (ошибка ${status}).`;
      }
    }

    async function attemptVerify(){
      if (verifying) return;

      const code = getCode();
      if (code.length !== inputs.length) { setError('Введите полный код из письма.'); return; }
      if (!isDigits(code)) { setError('Код должен состоять только из цифр.'); return; }

      verifying = true;
      inputs.forEach(i => i.disabled = true);
      if (resendBtn) resendBtn.disabled = true;
      setError('');
      setMsg('Проверяем код…');

      try {
        const { ok, status, data } = await authLoginVerify(challengeId, code);

        if (ok) {
          // токен и премиум-флаги из ответа
          if (data?.access_token) {
            save(KEYS.TOKEN, {
              access_token: data.access_token,
              token_type: data.token_type || 'bearer',
              received_at: Date.now()
            });
          }
          save(KEYS.STATE, {
            is_premium: !!data?.is_premium,
            premium_expires_at: data?.premium_expires_at || null,
            ts: Date.now()
          });
          del(KEYS.CHALLENGE);

          setMsg('Готово! Входим…', '#059669');
          const params = new URLSearchParams(location.search);
          const next = params.get('next') || '/cabinet.html';
          window.location.href = next;
          return;
        }

        // Ошибка — человеко-понятно
        const human = mapVerifyError(status, data);
        setError(human);
        setMsg('');
      } catch (e) {
        setError('Проблема с сетью. Проверьте подключение и попробуйте ещё раз.');
        console.error('verify error', e);
      } finally {
        verifying = false;
        inputs.forEach(i => i.disabled = false);
        if (resendBtn) resendBtn.disabled = false;
        inputs[0]?.focus();
      }
    }

    // ===== Инпуты и автопроверка =====
    const maybeVerify = () => {
      setError(''); setMsg('');
      if (inputs.every(x => x.value && /^\d$/.test(x.value))) attemptVerify();
    };

    inputs.forEach((el, i) => {
      el.value = '';

      const handleInput = () => {
        // Собираем только цифры и распределяем их по полям, начиная с текущего
        const chars = (el.value || '').replace(/\D/g, '').split('');
        el.value = chars.shift() || '';

        let idx = i + 1;
        while (chars.length && idx < inputs.length) {
          inputs[idx].value = chars.shift() || '';
          idx++;
        }

        if (el.value && idx <= inputs.length - 1) {
          inputs[idx]?.focus();
        }

        maybeVerify();
      };

      el.addEventListener('input', handleInput);

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !el.value && i > 0) inputs[i - 1].focus();
        if (e.key === 'Enter') { e.preventDefault(); attemptVerify(); }
      });
    });

    form.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text) return;
      e.preventDefault();
      const digits = text.replace(/\D/g, '').slice(0, inputs.length).split('');
      inputs.forEach((inp, idx) => { inp.value = digits[idx] || ''; });
      if (digits.length >= inputs.length) attemptVerify();
      else inputs[digits.length]?.focus();
    });

    inputs[0]?.focus();

    // ===== Resend с кулдауном (LOGIN /resend) =====
    const RESEND_COOLDOWN_S = 45;
    let timerId = null;
    const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    const cooldownKey = `${KEYS.RESEND_UNTIL}:login`; // ключ отдельно для login
    const cooldownLeft = () => Math.max(0, Math.ceil((Number(load(cooldownKey, 0)) - Date.now())/1000));

    function startCooldown(seconds){
      clearInterval(timerId);
      save(cooldownKey, Date.now() + seconds*1000);
      if (resendBtn) resendBtn.disabled = true;
      if (resendTimerEl) resendTimerEl.textContent = fmt(seconds);
      let left = seconds;
      timerId = setInterval(() => {
        left -= 1;
        if (resendTimerEl) resendTimerEl.textContent = fmt(Math.max(0,left));
        if (left <= 0) {
          clearInterval(timerId);
          del(cooldownKey);
          if (resendBtn) resendBtn.disabled = false;
        }
      }, 1000);
    }

    // запускаем кулдаун (продолжаем незавершённый или стартуем новый)
    const left0 = cooldownLeft();
    startCooldown(left0 > 0 ? left0 : RESEND_COOLDOWN_S);

    resendBtn?.addEventListener('click', async () => {
      if (resendBtn.disabled) return;
      if (!challengeId) { setMsg('Нет идентификатора сессии подтверждения. Вернитесь на предыдущий шаг.', '#e11d48'); return; }
      resendBtn.disabled = true;
      setMsg('Отправляем новый код…');

      try {
        const { status, ok, data } = await authLoginResend(challengeId);
        if (ok || status === 204) {
          setMsg('Новый код отправлен. Проверьте почту.', '#059669');
          startCooldown(RESEND_COOLDOWN_S);
        } else {
          // LOGIN /resend: 400 — неверный challenge_id; 404 — пользователь не найден/без e-mail; 500 — ошибка письма
          let human = '';
          if (status === 400) human = 'Некорректная сессия подтверждения. Вернитесь на шаг входа.';
          else if (status === 404) human = 'Пользователь не найден или у аккаунта не указан e-mail.';
          else if (status === 500) human = 'Ошибка отправки письма. Попробуйте позже.';
          else human = serverDetail(data) || `Не удалось отправить код (ошибка ${status}).`;

          setMsg(human, '#e11d48');
          resendBtn.disabled = false;
        }
      } catch (e) {
        setMsg('Проблема с сетью. Проверьте подключение и повторите.', '#e11d48');
        resendBtn.disabled = false;
        console.error('resend error', e);
      }
    });

    // На случай, если браузер инициирует submit
    form.addEventListener('submit', (e) => { e.preventDefault(); attemptVerify(); });
  };

  // Гарантированно запускаем после готовности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
