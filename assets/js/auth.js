import { authLogin, authRecoverPassword } from './api.js';
import { KEYS, save } from './storage.js';

(() => {
  const form = document.getElementById('authForm');
  if (!form) return;

  // -------- элементы формы входа --------
  const loginI  = document.getElementById('login');
  const passI   = document.getElementById('password');
  const toggle  = document.getElementById('togglePass');
  const submit  = document.getElementById('submitBtn');
  const loginE  = document.getElementById('loginError');
  const passE   = document.getElementById('passwordError');
  const formMsg = document.getElementById('formMsg');
  const forgotLink = document.getElementById('forgotLink');

  // -------- модалка восстановления (создаём по клику) --------
  let modalRoot = null;      // контейнер модалки
  let lastFocused = null;    // для возврата фокуса

  function buildRecoverModal() {
    // корневой контейнер
    modalRoot = document.createElement('div');
    modalRoot.id = 'recoverMount';
    modalRoot.innerHTML = `
      <div id="recoverBackdrop" style="
          position:fixed; inset:0; background:rgba(2,6,23,.55);
          backdrop-filter:saturate(120%) blur(2px); z-index:1000;"></div>

      <div id="recoverModal" role="dialog" aria-modal="true"
           aria-labelledby="recoverTitle" aria-describedby="recoverDesc"
           style="position:fixed; inset:0; display:grid; place-items:center; z-index:1001;">
        <div class="card" style="
            width:min(440px, 92vw); border-radius:16px; padding:20px 20px 16px;
            background:var(--surface, #0b1220); color:var(--ink, #e5e7eb);
            box-shadow:0 18px 45px rgba(0,0,0,.45);">
          <h2 id="recoverTitle" style="margin:0 0 6px; font-size:20px; line-height:1.2;">Сброс пароля</h2>
          <p id="recoverDesc" style="margin:0 0 14px; opacity:.85; font-size:14px;">
            Укажите e-mail, привязанный к аккаунту. Мы вышлем на него логин и пароль.
          </p>

          <form id="recoverForm" novalidate>
            <label for="recoverEmail" style="display:block; font-weight:600; font-size:14px;">E-mail</label>
            <div class="input-wrap" style="margin-top:8px;">
              <input id="recoverEmail" name="email" type="email" class="field"
                     placeholder="you@example.com" autocomplete="email" required inputmode="email"
                     style="width:100%;">
            </div>
            <p id="recoverEmailError" class="form-error" hidden style="margin-top:6px;"></p>

            <p id="recoverMsg" class="form-hint" style="margin-top:10px;"></p>

            <div style="display:flex; gap:10px; margin-top:16px;">
              <button type="button" id="recoverCancel" class="btn-secondary" style="min-width:110px;">Отмена</button>
              <button type="submit" id="recoverSubmit" class="btn-primary" style="flex:1;">Отправить</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modalRoot);

    // фокус после монтирования
    setTimeout(() => {
      modalRoot.querySelector('#recoverEmail')?.focus();
    }, 0);

    // события
    const backdrop      = modalRoot.querySelector('#recoverBackdrop');
    const modal         = modalRoot.querySelector('#recoverModal');
    const recoverForm   = modalRoot.querySelector('#recoverForm');
    const recoverEmail  = modalRoot.querySelector('#recoverEmail');
    const recoverEmailE = modalRoot.querySelector('#recoverEmailError');
    const recoverMsg    = modalRoot.querySelector('#recoverMsg');
    const recoverCancel = modalRoot.querySelector('#recoverCancel');
    const recoverSubmit = modalRoot.querySelector('#recoverSubmit');

    // trap focus (простая версия)
    const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstEl) { lastEl.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { firstEl.focus(); e.preventDefault(); }
      } else if (e.key === 'Escape') {
        destroyRecoverModal();
      }
    });

    function showFieldError(el, errEl, text) {
      errEl.textContent = text || '';
      errEl.hidden = !text;
      if (text) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    }
    const explainEmail = (el) =>
      el.validity.valueMissing ? 'Введите e-mail.' :
      (!el.checkValidity() ? 'Некорректный e-mail.' : '');

    recoverEmail.addEventListener('input', () => showFieldError(recoverEmail, recoverEmailE, ''));

    // закрытия
    backdrop.addEventListener('click', destroyRecoverModal);
    recoverCancel.addEventListener('click', destroyRecoverModal);

    // отправка
    recoverForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      recoverMsg.textContent = '';
      recoverMsg.style.color = '';

      if (!recoverEmail.checkValidity()) {
        showFieldError(recoverEmail, recoverEmailE, explainEmail(recoverEmail));
        return;
      }

      recoverSubmit.disabled = true; recoverSubmit.style.opacity = .7;
      let resp;
      try {
        resp = await authRecoverPassword(recoverEmail.value.trim());
      } catch {
        recoverSubmit.disabled = false; recoverSubmit.style.opacity = 1;
        recoverMsg.textContent = 'Не удалось отправить запрос. Проверьте соединение и повторите.';
        recoverMsg.style.color = '#e11d48';
        return;
      }
      recoverSubmit.disabled = false; recoverSubmit.style.opacity = 1;

      const { ok, status, data } = resp || {};
      const errDetail = data?.detail?.[0]?.msg ?? data?.detail;

      if (ok && status === 204) {
        destroyRecoverModal();
        formMsg.textContent = 'Письмо для восстановления отправлено. Проверьте почту.';
        formMsg.style.color = '#059669';
        formMsg.className = 'form-hint';
        return;
      }
      if (status === 404) {
        recoverMsg.textContent = 'Пользователь с таким e-mail не найден.';
        recoverMsg.style.color = '#e11d48';
      } else if (status === 422) {
        const t = (typeof errDetail === 'string' && errDetail) ? errDetail : 'Некорректный e-mail.';
        showFieldError(recoverEmail, recoverEmailE, t);
        recoverMsg.textContent = '';
      } else if (status === 429) {
        recoverMsg.textContent = 'Слишком много попыток. Попробуйте позже.';
        recoverMsg.style.color = '#e11d48';
      } else if (status === 500) {
        recoverMsg.textContent = 'Ошибка при отправке письма. Попробуйте позже.';
        recoverMsg.style.color = '#e11d48';
      } else {
        recoverMsg.textContent = 'Неизвестная ошибка: ' + status;
        recoverMsg.style.color = '#e11d48';
      }
    });
  }

  function showRecoverModal() {
    if (modalRoot) return; // уже открыта
    lastFocused = document.activeElement;
    // блокируем скролл страницы
    document.documentElement.style.overflow = 'hidden';
    buildRecoverModal();
  }

  function destroyRecoverModal() {
    if (!modalRoot) return;
    modalRoot.remove();
    modalRoot = null;
    document.documentElement.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showRecoverModal();
    });
  }

  // -------- существующий UX пароля --------
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

  // -------- валидация и сабмит логина (как было) --------
  const explainLogin = (el) => el.validity.valueMissing ? 'Введите логин.' : (!el.checkValidity() ? 'Некорректный логин.' : '');
  const explainPass  = (el) => el.validity.valueMissing ? 'Введите пароль.' : (!el.checkValidity() ? 'Некорректный пароль.' : '');
  const showError    = (el, errEl, text) => { errEl.textContent = text; errEl.hidden = !text; el.setAttribute('aria-invalid','true'); };
  const clearError   = (el, errEl) => { errEl.textContent = ''; errEl.hidden = true; el.removeAttribute('aria-invalid'); };

  loginI.addEventListener('input', () => clearError(loginI, loginE));
  passI .addEventListener('input', () => clearError(passI, passE));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    formMsg.textContent = '';
    formMsg.className   = 'form-hint';
    formMsg.style.color = '';

    let invalid = false;
    if (!loginI.checkValidity()) { showError(loginI, loginE, explainLogin(loginI)); invalid = true; }
    if (!passI.checkValidity())  { showError(passI,  passE,  explainPass(passI));   invalid = true; }
    if (invalid) return;

    submit.disabled = true; submit.style.opacity = .7;
    const { ok, status, data } = await authLogin(loginI.value.trim(), passI.value);
    submit.disabled = false; submit.style.opacity = 1;

    if (ok) {
      save(KEYS.CHALLENGE, {
        challenge_id: data?.challenge_id ?? null,
        email: data?.email ?? null,
        expires_in: data?.expires_in ?? null,
        ts: Date.now()
      });
      formMsg.textContent = data?.email
        ? `Код отправлен на ${data.email}. Введите его для подтверждения.`
        : 'Код подтверждения отправлен. Проверьте почту.';
      formMsg.style.color = '#059669';
      window.location.href = '/confirm.html';
      return;
    }

    const errDetail = data?.detail?.[0]?.msg;
    const show = (t)=>{ formMsg.textContent = t; formMsg.style.color = '#e11d48'; };
    if (status === 400) show('У вашего аккаунта не указан e-mail. Невозможно отправить код.');
    else if (status === 401) show('Неверный логин или пароль.');
    else if (status === 403) show('Аккаунт заблокирован или неактивен.');
    else if (status === 429) show('Слишком много попыток. Попробуйте позже.');
    else if (status === 500) show('Ошибка при отправке письма. Попробуйте позже.');
    else if (status === 422) show('Некорректные данные: ' + (errDetail || 'проверьте форму'));
    else show('Неизвестная ошибка: ' + status);
  });
})();
