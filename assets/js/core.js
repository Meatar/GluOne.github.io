import { authMe } from './api.js';

// Дождёмся DOM
document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // Feature tabs (если есть)
  const tabs = Array.from(document.querySelectorAll('.feature-tab'));
  const panels = Array.from(document.querySelectorAll('.feature-panel'));

  function activate(panelId) {
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
    let token = null;
    try { token = JSON.parse(sessionStorage.getItem('auth_token') || 'null'); } catch{}
    if (token?.access_token) {
      authLink.textContent = 'Личный кабинет';
      authLink.setAttribute('href', '/cabinet.html');

      // подменим на логин, если получится получить /me
      authMe(token.access_token).then(({ok, data}) => {
        if (ok && data?.username) authLink.textContent = data.username;
      }).catch(() => {});
    } else {
      authLink.textContent = 'Авторизация';
      authLink.setAttribute('href', '/auth.html');
    }
  }
});
