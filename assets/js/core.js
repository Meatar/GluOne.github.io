// core.js
import { authMe } from './api.js';
import { KEYS, load } from './storage.js';

// Дождёмся DOM
document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // Feature tabs (если есть)
  const tabs   = Array.from(document.querySelectorAll('.feature-tab'));
  const panels = Array.from(document.querySelectorAll('.feature-panel'));

  function activate(panelId) {
    if (!panelId) return;
    tabs.forEach(btn => {
      const on = btn.dataset.panel === panelId;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.classList.toggle('is-active', on);
    });
    panels.forEach(p => {
      const on = p.id === panelId;
      p.classList.toggle('hidden', !on);
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  if (tabs.length && panels.length) {
    tabs.forEach(btn => btn.addEventListener('click', () => activate(btn.dataset.panel)));
    const initial = document.querySelector('.feature-tab[aria-selected="true"]');
    activate(initial ? initial.dataset.panel : (panels[0]?.id || ''));
  }

  // Шапка: показываем «Личный кабинет»/username, если сессия валидна (cookie-авторизация)
  const authLink = document.querySelector('#authEntry, [data-auth-link]');
  if (authLink) {
    // значение по умолчанию
    authLink.textContent = 'Авторизация';
    authLink.setAttribute('href', '/auth.html');

    // пробуем тихо подтянуть профиль (если есть действующая кука — вернётся 200)
    authMe()
      .then(({ ok, data, status }) => {
        if (ok && data) {
          const label = data.username || 'Личный кабинет';
          authLink.textContent = label;
          authLink.setAttribute('href', '/cabinet.html');
        } else if (status === 401) {
          // не авторизован — оставляем «Авторизация»
        } else {
          // иные ошибки сети/серва — ничего не меняем
        }
      })
      .catch(() => {
        // сеть упала — оставим «Авторизация»
      });
  }
});
