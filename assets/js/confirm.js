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

  // Срок действия кода
  const minutes = Math.max(1, Math.ceil((Number(challenge.expires_in) || 600) / 60));
  if (validT) validT.textContent = `${minutes} минут`;

  const setError = (t) => { codeE.textContent = t || ''; codeE.hidden = !t; };
  const setMsg   = (t, color='') => { msg.textContent = t || ''; msg.style.color = color; };

  // ===== Автопроверка кода
  let verifying = false;
  const getCode = () => inputs.map(i => i.value).join('');
  const serverDetail = (data) => {
    // бэкенд иногда присылает detail как строку или массив объектов
    if (!data) return '';
    if (typeof data.detail === 'string') return data.detail;
    const d0 = Array.isArray(data.detail) ? data.detail[0] : null;
    return d0?.msg || '';
  };

  function mapVerifyError(status, data){
    const d = serverDetail(data);
    switch (status) {
      case 400: return d || 'Неверный или просроченный код. Запросите новый и попробуйте снова.';
      case 401: return d || 'Сессия подтверждения истекла. Вернитесь на шаг входа и выполните отправку кода ещё раз.';
      case 405: return d || 'Неверный метод запроса. Обновите страницу и попробуйте ещё раз.';
      case 422: return d || 'Неполные данные: отсутствует challenge_id или код.';
      case 429: return d || 'Слишком много попыток. Подождите минуту и повторите.';
      case 500: return d || 'Временная ошибка сервера. Повторите попытку позже.';
      default : return d || `Не удалось подтвердить код (ошибка ${status}).`;
    }
  }

  async function attemptVerify(){
    if (verifying) return;
    const code = getCode();
    if (code.length !== inputs.length){ setError('Введите полный код из письма.'); return; }
    if (!challengeId){ setMsg('Сессия подтверждения не найдена. Вернитесь на шаг входа.', '#e11d48'); return; }

    verifying = true;
    inputs.forEach(i => i.disabled = true);
    resendBtn.disabled = true;
    setError('');
    setMsg('Проверяем код…');

    try {
      const { ok, status, data } = await authVerify(challengeId, code);

      if (ok) {
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

      // Ошибка — показываем человеко-понятное сообщение
      const human = mapVerifyError(status, data);
      setError(human);          // под полями
      setMsg('');               // убираем строку статуса
    } catch (e) {
      setError('Проблема с сетью. Проверьте подключение и попробуйте ещё раз.');
      console.error('verify error', e);
    } finally {
      verifying = false;
      inputs.forEach(i => i.disabled = false);
      resendBtn.disabled = false;
      // Фокус на первое поле, чтобы пользователь сразу исправил
      inputs[0]?.focus();
    }
  }

  // Инпуты
  const maybeVerify = () => {
    setError(''); setMsg('');
    if (inputs.every(x => x.value && /^\d$/.test(x.value))) attemptVerify();
  };

  inputs.forEach((el, i) => {
    el.value = '';
    const handleInput = () => {
      el.value = el.value.replace(/\D/g, '').slice(0,1);
      if (el.value && i < inputs.length - 1) inputs[i + 1].focus();
      maybeVerify();
    };
    ['input','keyup','change'].forEach(evt => el.addEventListener(evt, handleInput));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !el.value && i > 0) inputs[i - 1].focus();
      if (e.key === 'Enter') e.preventDefault(); // Enter не нужен — у нас автопроверка
    });
    el.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text) return;
      e.preventDefault();
      const digits = text.replace(/\D/g, '').slice(0, inputs.length).split('');
      inputs.forEach((inp, idx) => { inp.value = digits[idx] || ''; });
      if (digits.length >= inputs.length) attemptVerify();
      else (inputs[digits.length] || el).focus();
    });
  });
  inputs[0]?.focus();

  // ===== Resend с кулдауном
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
  startCooldown(left0 > 0 ? left0 : RESEND_COOLDOWN_S);

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
      setMsg('Не удалось отправить код: ' + (serverDetail(data) || status), '#e11d48');
      resendBtn.disabled = false;
    }
  });

  // На случай, если браузер/расширение всё же инициирует submit
  form.addEventListener('submit', (e) => { e.preventDefault(); attemptVerify(); });
})();
