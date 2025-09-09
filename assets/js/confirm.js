// assets/js/confirm.js
import { authLoginVerify, authLoginResend, setAccessToken } from './api.js';
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

    const setError = (t) => { if (!codeE) return; codeE.textContent = t || ''; codeE.hidden = !t; };
    const setMsg   = (t, color='') => { if (!msg) return; msg.textContent = t || ''; msg.style.color = color; };

    const challenge = load(KEYS.CHALLENGE, {}) || {};
    const challengeId = challenge?.challenge_id || null;

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
    const onlyDigits = (s) => (s || '').replace(/\D/g, '');
    const isDigit = (ch) => /^[0-9]$/.test(ch);

    const serverDetail = (data) => {
      if (!data) return '';
      if (typeof data.detail === 'string') return data.detail;
      const d0 = Array.isArray(data.detail) ? data.detail[0] : null;
      return d0?.msg || '';
    };

    async function attemptVerify(){
      if (verifying) return;

      const code = getCode();
      if (code.length !== inputs.length) { setError('Введите полный код из письма.'); return; }
      if (!/^\d+$/.test(code))         { setError('Код должен состоять только из цифр.'); return; }

      verifying = true;
      inputs.forEach(i => (i.disabled = true));
      resendBtn && (resendBtn.disabled = true);
      setError(''); setMsg('Проверяем код…');

      try {
        const { ok, status, data } = await authLoginVerify(challengeId, code);
        if (ok) {
          // Сервер уже поставил refresh_token (HttpOnly) и csrf_token (видимый).
          // Access из ответа держим только в памяти на эту вкладку.
          if (data?.access_token) setAccessToken(data.access_token);

          save(KEYS.STATE, {
            is_premium: !!data?.is_premium,
            premium_expires_at: data?.premium_expires_at || null,
            ts: Date.now()
          });
          del(KEYS.CHALLENGE);

          setMsg('Готово! Входим…', '#059669');
          const next = new URLSearchParams(location.search).get('next') || '/cabinet.html';
          window.location.href = next;
          return;
        }
        const human =
          status === 400 ? (serverDetail(data) || 'Неверный или просроченный код.') :
          status === 404 ? (serverDetail(data) || 'Сессия не найдена.') :
          (serverDetail(data) || `Ошибка ${status}`);
        setError(human); setMsg('');
      } catch {
        setError('Проблема с сетью. Проверьте подключение и попробуйте ещё раз.');
      } finally {
        verifying = false;
        inputs.forEach(i => (i.disabled = false));
        resendBtn && (resendBtn.disabled = false);
        inputs[0]?.focus();
      }
    }

    const fillFrom = (start, str) => {
      const digits = onlyDigits(str).split('');
      let idx = start;
      while (digits.length && idx < inputs.length) { inputs[idx].value = digits.shift(); idx++; }
    };

    inputs.forEach((el, i) => {
      el.addEventListener('focus', () => setTimeout(() => el.select?.(), 0));
      el.addEventListener('input', () => {
        const val = onlyDigits(el.value);
        if (!val) { el.value = ''; return; }
        fillFrom(i, val);
        const nextEmpty = inputs.findIndex(inp => !inp.value);
        if (nextEmpty !== -1) inputs[nextEmpty].focus();
        else inputs[Math.min(i + 1, inputs.length - 1)].focus();
        if (inputs.every(x => x.value && /^\d$/.test(x.value))) attemptVerify();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (el.value) { el.value = ''; e.preventDefault(); return; }
          if (i > 0) { e.preventDefault(); inputs[i-1].focus(); inputs[i-1].value=''; }
          return;
        }
        if (e.key === 'ArrowLeft' && i>0) { e.preventDefault(); inputs[i-1].focus(); return; }
        if (e.key === 'ArrowRight' && i<inputs.length-1) { e.preventDefault(); inputs[i+1].focus(); return; }
        if (e.key === 'Enter') { e.preventDefault(); attemptVerify(); return; }
        if (e.key.length === 1 && !isDigit(e.key)) e.preventDefault();
      });
    });

    form.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text) return;
      e.preventDefault();
      fillFrom(0, text.slice(0, inputs.length));
      const nextEmpty = inputs.findIndex(inp => !inp.value);
      if (nextEmpty === -1) attemptVerify(); else inputs[nextEmpty].focus();
    });

    // ===== Resend cooldown (как было) =====
    const RESEND_COOLDOWN_S = 45;
    const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    const cooldownKey = `${KEYS.RESEND_UNTIL}:login`;
    let tId = null;

    function getUntil(){ return Number(load(cooldownKey, 0)) || 0; }
    function setUntil(ts){ save(cooldownKey, ts); }
    function render(){
      const left = Math.max(0, Math.ceil((getUntil()-Date.now())/1000));
      resendTimerEl && (resendTimerEl.textContent = fmt(left));
      const active = left>0;
      resendBtn && (resendBtn.disabled = active);
      if (!active && tId){ clearInterval(tId); tId = null; }
    }
    function start(sec){
      setUntil(Date.now()+sec*1000); render();
      if (tId) clearInterval(tId);
      tId = setInterval(render, 1000);
    }

    const left0 = Math.max(0, Math.ceil((getUntil()-Date.now())/1000));
    if (left0>0){ render(); tId=setInterval(render,1000); } else { start(RESEND_COOLDOWN_S); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

    resendBtn?.addEventListener('click', async () => {
      if (resendBtn.disabled) return;
      resendBtn.disabled = true; setMsg('Отправляем новый код…');
      try {
        const { ok, status, data } = await authLoginResend(challengeId);
        if (ok || status === 204) { setMsg('Новый код отправлен. Проверьте почту.', '#059669'); start(RESEND_COOLDOWN_S); }
        else {
          const human = (data?.detail?.[0]?.msg) || (data?.detail) || `Не удалось отправить код (ошибка ${status}).`;
          setMsg(human, '#e11d48'); resendBtn.disabled = false;
        }
      } catch { setMsg('Проблема с сетью. Повторите.', '#e11d48'); resendBtn.disabled = false; }
    });

    form.addEventListener('submit', (e) => { e.preventDefault(); attemptVerify(); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
