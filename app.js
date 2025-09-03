// Footer year
document.getElementById('y').textContent = new Date().getFullYear();

// Tabs
(function () {
  const tabs = Array.from(document.querySelectorAll('.feature-tab'));
  const panels = Array.from(document.querySelectorAll('.feature-panel'));
  if (!tabs.length || !panels.length) return;

  function activate(panelId){
    tabs.forEach(b => {
      const on = b.dataset.panel === panelId;
      b.classList.toggle('bg-slate-900', on);
      b.classList.toggle('text-white', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(p => {
      const on = p.id === panelId;
      p.classList.toggle('hidden', !on);
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }
  tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.panel)));
  const initial = document.querySelector('.feature-tab[aria-selected="true"]');
  activate(initial ? initial.dataset.panel : 'panel-track');
})();


// === Auth module =======================================================
(function () {
  const form = document.getElementById('authForm');
  if (!form) return; // мы не на странице auth

  const loginI = document.getElementById('login');
  const passI  = document.getElementById('password');
  const toggle = document.getElementById('togglePass');
  const submit = document.getElementById('submitBtn');
  const loginE = document.getElementById('loginError');
  const passE  = document.getElementById('passwordError');
  const formMsg= document.getElementById('formMsg');

  // Переключатель видимости пароля
  passI.type = 'password';
  toggle.dataset.state = 'hidden';
  toggle.addEventListener('click', () => {
    const nowHidden = passI.type === 'password';
    passI.type = nowHidden ? 'text' : 'password';
    toggle.dataset.state = nowHidden ? 'visible' : 'hidden';
    toggle.setAttribute('aria-label', nowHidden ? 'Скрыть пароль' : 'Показать пароль');
    toggle.setAttribute('title',      nowHidden ? 'Скрыть пароль' : 'Показать пароль');
  });

  // Требования
  loginI.setAttribute('minlength', '3');
  loginI.setAttribute('maxlength', '30');
  loginI.setAttribute('pattern', '^[A-Za-z0-9._-]{3,30}$');

  passI.setAttribute('minlength', '12');
  passI.setAttribute('maxlength', '72');
  passI.setAttribute('pattern', '^(?=.{12,72}$)(?!.*\\s)(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s])[\\x21-\\x7E]+$');

  const explainLogin = (el) => {
    if (el.validity.valueMissing) return 'Введите логин.';
    if (el.validity.tooShort || el.validity.tooLong) return 'Логин от 3 до 30 символов.';
    if (el.validity.patternMismatch) return 'Разрешены латиница, цифры, ".", "-", "_".';
    return '';
  };
  const explainPass = (el) => {
    if (el.validity.valueMissing) return 'Введите пароль.';
    if (el.validity.tooShort) return 'Минимум 12 символов.';
    if (el.validity.patternMismatch)
      return 'Без пробелов, с буквами разных регистров, цифрой и спецсимволом.';
    return '';
  };
  const showError = (el, errEl, text) => { errEl.textContent = text; errEl.hidden = !text; el.setAttribute('aria-invalid','true'); };
  const clearError = (el, errEl) => { errEl.textContent = ''; errEl.hidden = true; el.removeAttribute('aria-invalid'); };

  loginI.addEventListener('input', () => clearError(loginI, loginE));
  passI .addEventListener('input', () => clearError(passI,  passE));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMsg.textContent = ''; formMsg.className = 'mt-4 text-sm';

    let bad = false;
    if (!loginI.checkValidity()) { showError(loginI, loginE, explainLogin(loginI)); bad = true; }
    if (!passI.checkValidity())  { showError(passI,  passE,  explainPass(passI));  bad = true; }
    if (bad) return;

    const payload = { login: loginI.value.trim(), password: passI.value };

    submit.disabled = true; submit.style.opacity = .7;
    try {
      // Пример реального запроса:
      // const res = await fetch('/api/auth/login', {
      //   method: 'POST', headers: {'Content-Type':'application/json'},
      //   body: JSON.stringify(payload)
      // });
      // if (!res.ok) throw new Error(res.status === 401 ? 'Неверный логин или пароль' : 'Ошибка авторизации');
      // const data = await res.json();

      // Заглушка:
      await new Promise(r => setTimeout(r, 500));
      formMsg.textContent = 'Успешный вход. Перенаправляем…';
      formMsg.classList.add('text-emerald-600');
      // window.location.href = (new URLSearchParams(location.search)).get('next') || '/';
    } catch (err) {
      formMsg.textContent = err.message || 'Не удалось войти. Повторите попытку.';
      formMsg.classList.add('text-rose-600');
    } finally {
      submit.disabled = false; submit.style.opacity = 1;
    }
  }, { passive: false });
})();
