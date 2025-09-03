import { authResend, authVerify } from './api.js';
import { KEYS, load, save, del } from './storage.js';

(() => {
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

  const challenge = load(KEYS.CHALLENGE, {});
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

  const minutes = Math.max(1, Math.ceil((Number(challenge.expires_in) || 600) / 60));
  if (validT) validT.textContent = `${minutes} минут`;

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

  // Кулдаун resend (45s) с сохранением
  const RESEND_COOLDOWN_S = 45;
  let timerId = null;
  const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const cooldownLeft = () => Math.max(0, Math.ceil((Number(load(KEYS.RESEND_UNTIL, 0)) - Date.now())/1000));
  function startCooldown(seconds){
    clearInterval(timerId);
    save(KEYS.RESEND_UNTIL, Date.now() + seconds*1000);
    resendBtn.disabled = true;
    let left = seconds;
    resendTimerEl.textContent = fmt(left);
    timerId = setInterval(() => {
      left -= 1;
      resendTimerEl.textContent = fmt(Math.max(0,left));
      if (left <= 0) { clearInterval(timerId); resendBtn.disabled = false; del(KEYS.RESEND_UNTIL); }
    }, 1000);
  }
  const left0 = cooldownLeft();
  if (left0 > 0) startCooldown(left0); else { resendBtn.disabled = false; resendTimerEl.textContent = fmt(0); }

  // Resend
  resendBtn.addEventListener('click', async () => {
    if (resendBtn.disabled) return;
    if (!challengeId) { setMsg('Нет идентификатора сессии подтверждения. Вернитесь на шаг входа.', '#e11d48'); return; }
    resendBtn.disabled = true;
    setMsg('Отправляем новый код…');
    const { status, ok, data } = await authResend(challengeId);
    if (ok || status === 204) {
      setMsg('Новый код отправлен. Проверьте почту.', '#059669');
      startCooldown(RESEND_COOLDOWN_S);
    } else {
      setMsg('Не удалось отправить код: ' + (data?.detail?.[0]?.msg || status), '#e11d48');
      resendBtn.disabled = false;
    }
  });

  // Verify
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = inputs.map(i => i.value).join('');
    if (code.length !== inputs.length){ setError('Введите полный код из письма.'); return; }
    if (!challengeId){ setMsg('Сессия подтверждения не найдена. Вернитесь на шаг входа.', '#e11d48'); return; }

    setMsg('Проверяем код…');
    const { ok, status, data } = await authVerify(challengeId, code);

    if (ok) {
      // data: { access_token, token_type, is_premium, premium_expires_at }
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

    setMsg(data?.detail?.[0]?.msg || ('Не удалось подтвердить код: ' + status), '#e11d48');
  });
})();
