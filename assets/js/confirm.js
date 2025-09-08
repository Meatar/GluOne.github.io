// assets/js/confirm.js
import { authVerify, authResend } from './api.js';
import { KEYS, load, save, del } from './storage.js';

(function initConfirmModule() {
  const init = () => {
    const form = document.getElementById('confirmForm');
    if (!form) return;

    const inputs = Array.from(form.querySelectorAll('.otp-input'));
    const codeE  = document.getElementById('codeError');
    const msg    = document.getElementById('confirmMsg');
    const masked = document.getElementById('maskedEmail');
    const validT = document.getElementById('validityText');
    const resendBtn = document.getElementById('resendBtn');
    const resendTimerEl = document.getElementById('resendTimer');

    const challenge = load(KEYS.CHALLENGE, {});
    const challengeId = challenge?.challenge_id || null;

    if (msg && !msg.getAttribute('aria-live')) {
      msg.setAttribute('aria-live', 'polite');
      msg.setAttribute('role', 'status');
    }
    const setError = (t) => { if (!codeE) return; codeE.textContent = t || ''; codeE.hidden = !t; };
    const setMsg   = (t, color='') => { if (!msg) return; msg.textContent = t || ''; msg.style.color = color; };

    const maskEmail = (em) => {
      if (!em || !em.includes('@')) return '***@***';
      const [u, d] = em.split('@');
      const mu = (u.length <= 2) ? (u[0] || '*') + '****' : u.slice(0,2) + '****';
      const md = d ? d[0] + '****' : '****';
      return `${mu}@${md}…`;
    };
    if (challenge.email && masked) masked.textContent = maskEmail(challenge.email);

    const minutes = Math.max(1, Math.ceil((Number(challenge.expires_in) || 600) / 60));
    if (validT) validT.textContent = `${minutes} минут`;

    if (!challengeId) {
      setMsg('Сессия подтверждения не найдена. Возвращаемся на шаг входа…', '#e11d48');
      setTimeout(() => { window.location.href = '/auth.html'; }, 1200);
      return;
    }

    let verifying = false;
    const getCode = () => inputs.map(i => i.value).join('');
    const isDigits = (s) => /^\d+$/.test(s);

    const serverDetail = (data) => {
      if (!data) return '';
      if (typeof data.detail === 'string') return data.detail;
      const d0 = Array.isArray(data.detail) ? data.detail[0] : null;
      return d0?.msg || '';
    };

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
        const { ok, status, data } = await authVerify(challengeId, code);

        if (ok) {
          // НЕ сохраняем access_token — работаем по cookie.
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

        const human = mapVerifyError(status, data);
        setError(human);
        setMsg('');
      } catch {
        setError('Проблема с сетью. Проверьте подключение и попробуйте ещё раз.');
      } finally {
        verifying = false;
        inputs.forEach(i => i.disabled = false);
        if (resendBtn) resendBtn.disabled = false;
        inputs[0]?.focus();
      }
    }

    const maybeVerify = () => { setError(''); setMsg(''); if (inputs.every(x => x.value && /^\d$/.test(x.value))) attemptVerify(); };

    inputs.forEach((el, i) => {
      el.value = '';
      const handleInput = () => {
        const chars = (el.value || '').replace(/\D/g, '').split('');
        el.value = chars.shift() || '';
        let idx = i + 1;
        while (chars.length && idx < inputs.length) { inputs[idx].value = chars.shift() || ''; idx++; }
        if (el.value) {
          const nextEmpty = inputs.findIndex((n, k) => k > i && !n.value);
          if (nextEmpty !== -1) inputs[nextEmpty].focus();
          else if (i < inputs.length - 1) inputs[i + 1].focus();
        }
        maybeVerify();
      };
      el.addEventListener('input', handleInput);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !el.value && i > 0) inputs[i - 1].focus();
        if (e.key === 'Enter') { e.preventDefault(); attemptVerify(); }
        if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
        if (e.key === 'ArrowRight' && i < inputs.length - 1) inputs[i + 1].focus();
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

    // ===== Resend (cooldown) =====
    const RESEND_COOLDOWN_S = 45;
    let timerId = null;
    const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    const cooldownKey = `${KEYS.RESEND_UNTIL}:login`;
    const cooldownLeft = () => Math.max(0, Math.ceil((Number(load(cooldownKey, 0)) - Date.now())/1000));

    function startCooldown(seconds){
      clearInterval(timerId);
      save(cooldownKey, Date.now() + seconds*1000);
      resendBtn && (resendBtn.disabled = true);
      resendTimerEl && (resendTimerEl.textContent = fmt(seconds));
      let left = seconds;
      timerId = setInterval(() => {
        left -= 1;
        resendTimerEl && (resendTimerEl.textContent = fmt(Math.max(0,left)));
        if (left <= 0) {
          clearInterval(timerId);
          del(cooldownKey);
          resendBtn && (resendBtn.disabled = false);
        }
      }, 1000);
    }

    const left0 = cooldownLeft();
    startCooldown(left0 > 0 ? left0 : RESEND_COOLDOWN_S);

    resendBtn?.addEventListener('click', async () => {
      if (resendBtn.disabled) return;
      if (!challengeId) { setMsg('Нет идентификатора сессии подтверждения. Вернитесь на предыдущий шаг.', '#e11d48'); return; }
      resendBtn.disabled = true;
      setMsg('Отправляем новый код…');

      try {
        const { status, ok, data } = await authResend(challengeId);
        if (ok || status === 204) {
          setMsg('Новый код отправлен. Проверьте почту.', '#059669');
          startCooldown(RESEND_COOLDOWN_S);
        } else {
          const human =
            status === 400 ? 'Некорректная сессия подтверждения. Вернитесь на шаг входа.' :
            status === 404 ? 'Пользователь не найден или у аккаунта не указан e-mail.' :
            status === 500 ? 'Ошибка отправки письма. Попробуйте позже.' :
            (serverDetail(data) || `Не удалось отправить код (ошибка ${status}).`);
          setMsg(human, '#e11d48');
          resendBtn.disabled = false;
        }
      } catch {
        setMsg('Проблема с сетью. Проверьте подключение и повторите.', '#e11d48');
        resendBtn.disabled = false;
      }
    });

    form.addEventListener('submit', (e) => { e.preventDefault(); attemptVerify(); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
