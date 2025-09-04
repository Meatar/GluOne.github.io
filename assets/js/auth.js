// ДОБАВЬ: импорт метода восстановления
import { authLogin, authRecoverPassword } from './api.js';
import { KEYS, save } from './storage.js';

(() => {
  const form = document.getElementById('authForm');
  if (!form) return;

  // --- существующие элементы ---
  const loginI  = document.getElementById('login');
  const passI   = document.getElementById('password');
  const toggle  = document.getElementById('togglePass');
  const submit  = document.getElementById('submitBtn');
  const loginE  = document.getElementById('loginError');
  const passE   = document.getElementById('passwordError');
  const formMsg = document.getElementById('formMsg');

  // --- элементы модалки восстановления ---
  const forgotLink    = document.getElementById('forgotLink');
  const modal         = document.getElementById('recoverModal');
  const backdrop      = document.getElementById('recoverBackdrop');
  const recoverForm   = document.getElementById('recoverForm');
  const recoverEmail  = document.getElementById('recoverEmail');
  const recoverEmailE = document.getElementById('recoverEmailError');
  const recoverMsg    = document.getElementById('recoverMsg');
  const recoverCancel = document.getElementById('recoverCancel');
  const recoverSubmit = document.getElementById('recoverSubmit');

  // ===== UX: показать/скрыть модалку =====
  let lastFocused = null;

  const showRecover = () => {
    lastFocused = document.activeElement;
    recoverForm.reset();
    recoverMsg.textContent = '';
    recoverMsg.style.color = '';
    recoverEmailE.textContent = '';
    recoverEmailE.hidden = true;
    recoverEmail.removeAttribute('aria-invalid');

    backdrop.hidden = false;
    modal.hidden = false;

    // Фокус на поле
    setTimeout(() => recoverEmail.focus(), 0);

    // Блокировка скролла страницы
    document.documentElement.style.overflow = 'hidden';
  };

  const hideRecover = () => {
    backdrop.hidden = true;
    modal.hidden = true;
    document.documentElement.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  };

  // Открыть по ссылке «Забыли пароль?»
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showRecover();
    });
  }

  // Закрытия: фон, кнопка «Отмена», Esc
  if (backdrop) backdrop.addEventListener('click', hideRecover);
  if (recoverCancel) recoverCancel.addEventListener('click', hideRecover);
  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') hideRecover();
  });

  // Простая валидация e-mail
  const explainEmail = (el) =>
    el.validity.valueMissing ? 'Введите e-mail.' :
    (!el.checkValidity() ? 'Некорректный e-mail.' : '');

  const showFieldError = (el, errEl, text) => {
    errEl.textContent = text;
    errEl.hidden = !text;
    if (text) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  };

  recoverEmail.addEventListener('input', () => showFieldError(recoverEmail, recoverEmailE, ''));

  // Сабмит формы восстановления
  if (recoverForm) {
    recoverForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      recoverMsg.textContent = '';
      recoverMsg.style.color = '';

      if (!recoverEmail.checkValidity()) {
        showFieldError(recoverEmail, recoverEmailE, explainEmail(recoverEmail));
        return;
      }

      // loading state
      recoverSubmit.disabled = true;
      recoverSubmit.style.opacity = .7;

      const email = recoverEmail.value.trim();
      let res;
      try {
        res = await authRecoverPassword(email);
      } catch (err) {
        // Сетевые ошибки/таймаут
        recoverSubmit.disabled = false;
        recoverSubmit.style.opacity = 1;
        recoverMsg.textContent = 'Не удалось отправить запрос. Проверьте соединение и попробуйте снова.';
        recoverMsg.style.color = '#e11d48';
        return;
      }

      recoverSubmit.disabled = false;
      recoverSubmit.style.opacity = 1;

      const { ok, status, data } = res || {};
      const errDetail = data?.detail?.[0]?.msg ?? data?.detail;

      if (ok && status === 204) {
        // Успех: закрываем модалку и показываем зелёный тост под основной формой
        hideRecover();
        formMsg.textContent = 'Письмо для восстановления отправлено. Проверьте почту.';
        formMsg.style.color = '#059669';
        formMsg.className = 'form-hint';
        return;
      }

      // Ошибки API
      if (status === 404) {
        recoverMsg.textContent = 'Пользователь с таким e-mail не найден.';
        recoverMsg.style.color = '#e11d48';
      } else if (status === 422) {
        // Валидация на беке: подсветим поле и покажем причину
        const t = typeof errDetail === 'string' && errDetail ? errDetail : 'Некорректный e-mail. Исправьте и попробуйте снова.';
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

  // ===== существующая логика видимости пароля и логина (без изменений) =====
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
