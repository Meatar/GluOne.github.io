// Footer year
(() => {
  const y = document.getElementById('y');
  if (y) y.textContent = new Date().getFullYear();
})();

// Feature tabs (если есть)
(() => {
  const tabs = Array.from(document.querySelectorAll('.feature-tab'));
  const panels = Array.from(document.querySelectorAll('.feature-panel'));
  if (!tabs.length || !panels.length) return;

  function activate(panelId) {
    tabs.forEach(btn => {
      const on = btn.dataset.panel === panelId;
      btn.classList.toggle('bg-slate-900', on);
      btn.classList.toggle('text-white', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
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
