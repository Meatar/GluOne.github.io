// core.js
import { authRefresh, authMe } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();

  // Feature tabs (как было)
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

  // Шапка: пробуем тихо обновить access по cookie и показать «Личный кабинет»
  const authLink = document.querySelector('#authEntry, [data-auth-link]');
  if (authLink) {
    authLink.textContent = 'Авторизация';
    authLink.setAttribute('href', '/auth.html');

    (async () => {
      try {
        const r = await authRefresh();      // требует X-CSRF-Token (из куки)
        if (!r.ok) return;
        const me = await authMe();
        if (me.ok && me.data) {
          const label = me.data.username || 'Личный кабинет';
          authLink.textContent = label;
          authLink.setAttribute('href', '/cabinet.html');
        }
      } catch {}
    })();
  }
});
