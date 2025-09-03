import { authLogin } from './api.js';
import { KEYS, save } from './storage.js';

(() => {
  const form = document.getElementById('authForm');
  if (!form) return;

  const loginI  = document.getElementById('login');
  const passI   = document.getElementById('password');
  const toggle  = document.getElementById('togglePass');
  const submit  = document.getElementById('submitBtn');
  const loginE  = document.getElementById('loginError');
  const passE   = document.getElementById('passwordError');
  const formMsg = document.getElementById('formMsg');

  // Видимость пароля
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

  // Валидация
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
      // сохраняем challenge
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

    // ошибки
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
