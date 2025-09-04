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
  const formMsg = document.getElementById('formMsg');
  const forgotLink = document.getElementById('forgotLink');

  // ============================================================
  // ========  МОДАЛКА ВОССТАНОВЛЕНИЯ ПАРОЛЯ  ===================
  // ============================================================
  let modalRoot = null, lastFocused = null;

  function buildRecoverModal() {
    const mount = document.createElement('div');
    mount.id = 'recoverMount';
    mount.innerHTML = `
      <div class="rec-backdrop" id="recoverBackdrop"></div>
      <div class="rec-wrap" id="recoverModal" role="dialog" aria-modal="true"
           aria-labelledby="recoverTitle" aria-describedby="recoverDesc">
        <div class="rec-card">
          <h2 id="recoverTitle" class="rec-title">Сброс пароля</h2>
          <p id="recoverDesc" class="rec-sub">
            Укажите e-mail, привязанный к аккаунту. Мы отправим на него новый пароль.
          </p>

          <form id="recoverForm" novalidate>
            <label for="recoverEmail" class="rec-label">E-mail</label>
            <input id="recoverEmail" name="email" type="email" class="rec-input"
                   placeholder="you@example.com" autocomplete="email" required inputmode="email" />
            <p id="recoverEmailError" class="rec-error" hidden></p>
            <p id="recoverMsg" class="rec-hint"></p>

            <div class="rec-actions">
              <button type="submit" id="recoverSubmit" class="rec-btn rec-btn-primary">Отправить</button>
              <button type="button" id="recoverCancel" class="rec-btn rec-btn-ghost">Отмена</button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(mount);
    return mount;
  }

  function showRecoverModal() {
    if (modalRoot) return;
    lastFocused = document.activeElement;
    document.documentElement.style.overflow = 'hidden';
    modalRoot = buildRecoverModal();

    // элементы модалки
    const backdrop      = modalRoot.querySelector('#recoverBackdrop');
    const modal         = modalRoot.querySelector('#recoverModal');
    const recoverForm   = modalRoot.querySelector('#recoverForm');
    const recoverEmail  = modalRoot.querySelector('#recoverEmail');
    const recoverEmailE = modalRoot.querySelector('#recoverEmailError');
    const recoverMsg    = modalRoot.querySelector('#recoverMsg');
    const recoverCancel = modalRoot.querySelector('#recoverCancel');
    const recoverSubmit = modalRoot.querySelector('#recoverSubmit');

    // автофокус
    setTimeout(() => recoverEmail.focus(), 0);

    // trap focus
    const focusables = modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstEl) { lastEl.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { firstEl.focus(); e.preventDefault(); }
      } else if (e.key === 'Escape') {
        destroyRecoverModal();
      }
    });

    // закрытия
    backdrop.addEventListener('click', destroyRecoverModal);
    recoverCancel.addEventListener('click', destroyRecoverModal);

    // helpers
    const showFieldError = (el, errEl, text) => {
      errEl.textContent = text || '';
      errEl.hidden = !text;
      if (text) el.setAttribute('aria-invalid','true'); else el.removeAttribute('aria-invalid');
    };
    const explainEmail = (el) =>
      el.validity.valueMissing ? 'Введите e-mail.' :
      (!el.checkValidity() ? 'Некорректный e-mail.' : '');

    recoverEmail.addEventListener('input', () => showFieldError(recoverEmail, recoverEmailE, ''));

    // submit
    recoverForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      recoverMsg.textContent = '';
      recoverMsg.style.color = '';

      if (!recoverEmail.checkValidity()) {
        showFieldError(recoverEmail, recoverEmailE, explainEmail(recoverEmail));
        return;
      }

      recoverSubmit.disabled = true;
      let resp;
      try {
        resp = await authRecoverPassword(recoverEmail.value.trim());
      } catch {
        recoverSubmit.disabled = false;
        recoverMsg.textContent = 'Не удалось отправить запрос. Проверьте соединение и повторите.';
        recoverMsg.style.color = '#dc2626';
        return;
      }
      recoverSubmit.disabled = false;

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
        recoverMsg.style.color = '#dc2626';
      } else if (status === 422) {
        const t = (typeof errDetail === 'string' && errDetail) ? errDetail : 'Некорректный e-mail.';
        showFieldError(recoverEmail, recoverEmailE, t);
        recoverMsg.textContent = '';
      } else if (status === 429) {
        recoverMsg.textContent = 'Слишком много попыток. Попробуйте позже.';
        recoverMsg.style.color = '#dc2626';
      } else if (status === 500) {
        recoverMsg.textContent = 'Ошибка при отправке письма. Попробуйте позже.';
        recoverMsg.style.color = '#dc2626';
      } else {
        recoverMsg.textContent = 'Неизвестная ошибка: ' + status;
        recoverMsg.style.color = '#dc2626';
      }
    });
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

  // ============================================================
  // ========  ОСНОВНАЯ ФОРМА ВХОДА  ============================
  // ============================================================
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

  // валидация логина и пароля выполняется на сервере

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    formMsg.textContent = '';
    formMsg.className   = 'form-hint';
    formMsg.style.color = '';

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
