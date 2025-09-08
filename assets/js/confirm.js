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

    // --- вспомогалки UI ---
    if (msg && !msg.getAttribute('aria-live')) {
      msg.setAttribute('aria-live', 'polite');
      msg.setAttribute('role', 'status');
    }
    const setError = (t) => { if (!codeE) return; codeE.textContent = t || ''; codeE.hidden = !t; };
    const setMsg   = (t, color='') => { if (!msg) return; msg.textContent = t || ''; msg.style.color = color; };

    // --- challenge из шага логина ---
    const challenge = load(KEYS.CHALLENGE, {});
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

    // --- валидация/верификация ---
    let verifying = false;
    const getCode = () => inputs.map(i => i.value).join('');
    const isDigit = (ch) => /^[0-9]$/.test(ch);
    const onlyDigits = (s) => (s || '').replace(/\D/g, '');

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
      if (!/^\d+$/.test(code)) { setError('Код должен состоять только из цифр.'); return; }

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

    const maybeVerify = () => {
      setError('');
      setMsg('');
      if (inputs.every(x => x.value && /^\d$/.test(x.value))) {
        attemptVerify();
      }
    };

    // --- распределение ввода по ячейкам ---
    const fillFrom = (start, str) => {
      const digits = onlyDigits(str).split('');
      let idx = start;
      while (digits.length && idx < inputs.length) {
        inputs[idx].value = digits.shift();
        idx++;
      }
    };

    // --- ПОВЕДЕНИЕ ЯЧЕЕК: auto-advance, backspace, стрелки, фокус ---
    inputs.forEach((el, i) => {
      // Жёстко ограничим по 1 символу и запретим не-цифры
      el.setAttribute('inputmode', 'numeric');
      el.setAttribute('autocomplete', 'one-time-code');
      el.setAttribute('maxlength', '1');

      // При фокусе выделяем содержимое (удобно для ручной правки)
      el.addEventListener('focus', () => {
        // таймаут нужен для корректной работы на iOS
        setTimeout(() => el.select?.(), 0);
      });

      // Основной ввод
      el.addEventListener('input', () => {
        const val = onlyDigits(el.value);
        if (val.length === 0) {
          el.value = '';
          return;
        }
        // если вставили сразу несколько символов в одну ячейку — раскидаем дальше
        fillFrom(i, val);
        // фокус на следующую пустую
        const nextEmpty = inputs.findIndex(inp => !inp.value);
        if (nextEmpty !== -1) {
          inputs[nextEmpty].focus();
        } else {
          inputs[Math.min(i + 1, inputs.length - 1)].focus();
        }
        maybeVerify();
      });

      // Клавиатурная навигация
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (el.value) {
            // очистим текущую, не прыгая
            el.value = '';
            e.preventDefault();
            return;
          }
          // если пустая — прыгаем влево
          if (i > 0) {
            e.preventDefault();
            inputs[i - 1].focus();
            inputs[i - 1].value = '';
          }
          return;
        }

        if (e.key === 'ArrowLeft' && i > 0) {
          e.preventDefault();
          inputs[i - 1].focus();
          return;
        }
        if (e.key === 'ArrowRight' && i < inputs.length - 1) {
          e.preventDefault();
          inputs[i + 1].focus();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          attemptVerify();
          return;
        }

        // Блокируем ввод не-цифр с клавиатуры (кроме служебных клавиш)
        if (e.key.length === 1 && !isDigit(e.key)) {
          e.preventDefault();
        }
      });
    });

    // Вставка из буфера: вставляем как есть и верифицируем если все ячейки заполнены
    form.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      if (!text) return;
      e.preventDefault();
      fillFrom(0, text.slice(0, inputs.length));
      const nextEmpty = inputs.findIndex(inp => !inp.value);
      if (nextEmpty === -1) {
        attemptVerify();
      } else {
        inputs[nextEmpty].focus();
      }
    });

    inputs[0]?.focus();

    // ===== Resend (cooldown) — стабильный тикающий таймер =====
    const RESEND_COOLDOWN_S = 45;
    let timerId = null;
    const fmt = (s)=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    const cooldownKey = `${KEYS.RESEND_UNTIL}:login`;

    // Читаем/пишем абсолютный «до какого времени»
    const getUntil = () => Number(load(cooldownKey, 0)) || 0;
    const setUntil = (ts) => save(cooldownKey, ts);

    function renderCooldown() {
      const now = Date.now();
      const until = getUntil();
      const left = Math.max(0, Math.ceil((until - now) / 1000));
      if (resendTimerEl) resendTimerEl.textContent = fmt(left);

      const active = left > 0;
      if (resendBtn) resendBtn.disabled = active;

      if (!active && timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function startCooldown(seconds){
      const until = Date.now() + seconds * 1000;
      setUntil(until);
      // моментальный рендер и запуск точного тика
      renderCooldown();
      if (timerId) clearInterval(timerId);
      timerId = setInterval(renderCooldown, 1000);
    }

    // восстановим состояние таймера при загрузке (или заведём новый)
    const left0 = Math.max(0, Math.ceil((getUntil() - Date.now()) / 1000));
    if (left0 > 0) {
      // уже идёт отсчёт — просто запустим тик
      renderCooldown();
      timerId = setInterval(renderCooldown, 1000);
    } else {
      startCooldown(RESEND_COOLDOWN_S);
    }

    // при возврате на вкладку/пробуждении синхронизируемся
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) renderCooldown();
    });

    // Кнопка «Отправить код снова»
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
