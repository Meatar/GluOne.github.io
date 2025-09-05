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

  // Шапка: заменить «Авторизация» на логин, если авторизован
  const authLink = document.querySelector('#authEntry, [data-auth-link]');
  if (authLink) {
    const tokenObj = load(KEYS.TOKEN, null);
    const accessToken = tokenObj?.access_token;

    if (accessToken) {
      // Сразу даём полезный линк
      authLink.textContent = 'Личный кабинет';
      authLink.setAttribute('href', '/cabinet.html');

      // Пытаемся подтянуть username через /me (X-Device-Id подставит сам api.js)
      authMe(accessToken)
        .then(({ ok, data }) => {
          if (ok && data?.username) {
            authLink.textContent = data.username;
            authLink.setAttribute('href', '/cabinet.html');
          }
        })
        .catch(() => {
          // Сеть упала — оставим «Личный кабинет» без изменений
        });
    } else {
      authLink.textContent = 'Авторизация';
      authLink.setAttribute('href', '/auth.html');
    }
  }
});
