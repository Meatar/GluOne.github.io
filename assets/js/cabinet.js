import { authMe, authLogout } from './api.js';
import { KEYS, load, del } from './storage.js';

(() => {
  const card = document.getElementById('meCard');
  if (!card) return;

  const el = (id) => document.getElementById(id);
  const meUsername    = el('meUsername');
  const meEmail       = el('meEmail');
  const meAvatar      = el('meAvatar');
  const mePremium     = el('mePremium');
  const mePremiumNote = el('mePremiumNote');
  const meActive      = el('meActive');
  const meRoles       = el('meRoles');
  const meGender      = el('meGender');
  const meBirth       = el('meBirth');
  const meDiabetes    = el('meDiabetes');
  const meMsg         = el('meMsg');

  const token = load(KEYS.TOKEN, null);
  if (!token?.access_token) {
    window.location.href = '/auth.html?next=%2Fcabinet.html';
    return;
  }

  // ===== helpers
  const maskEmail = (em) => {
    if (!em || !em.includes('@')) return '***@***';
    const [u, d] = em.split('@');
    const mu = (u.length <= 2) ? (u[0] || '*') + '****' : u.slice(0,2) + '****';
    const md = d ? d[0] + '****' : '****';
    return `${mu}@${md}…`;
  };
  const ageFrom = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d)) return null;
    const n = new Date();
    let age = n.getUTCFullYear() - d.getUTCFullYear();
    const m = n.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) age--;
    return age;
  };
  const fmtDate   = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', {year:'numeric', month:'long', day:'numeric'}); } catch { return iso || '—'; } };
  const mapGender = (g) => ({ male:'Мужской', female:'Женский' })[g] || '—';
  const mapDia    = (t) => ({ type1:'Тип 1', type2:'Тип 2', gestational:'Гестационный' })[t] || '—';

  // ===== load profile
  async function loadMe(){
    meMsg.textContent = 'Загружаем профиль…';
    const { ok, status, data } = await authMe(token.access_token);

    if (ok) {
      meUsername.textContent = data?.username || 'Без имени';
      meEmail.textContent    = data?.email ? maskEmail(data.email) : '—';
      meAvatar.textContent   = (data?.username || data?.email || 'U').trim()[0].toUpperCase();
      meActive.textContent   = data?.is_active ? 'Активен' : 'Неактивен';
      meGender.textContent   = mapGender(data?.gender);
      meBirth.textContent    = data?.birth_date ? `${fmtDate(data.birth_date)}${ageFrom(data.birth_date) ? ` · ${ageFrom(data.birth_date)} лет` : ''}` : '—';
      meDiabetes.textContent = mapDia(data?.diabetes_type);

      meRoles.innerHTML = '';
      (Array.isArray(data?.roles) ? data.roles : []).forEach(r => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = r;
        meRoles.appendChild(chip);
      });

      if (data?.is_premium){
        mePremium.hidden = false;
        const exp = data?.premium_expires_at ? new Date(data.premium_expires_at) : null;
        mePremiumNote.hidden = false;
        mePremiumNote.textContent = exp
          ? `Подписка Premium активна до ${exp.toLocaleString('ru-RU',{year:'numeric',month:'long',day:'numeric'})}.`
          : 'Подписка Premium активна.';
      } else {
        mePremium.hidden = true;
        mePremiumNote.hidden = true;
      }

      meMsg.textContent = '';
      return;
    }

    if (status === 401) {
      window.location.href = '/auth.html?next=%2Fcabinet.html';
    } else {
      meMsg.textContent = 'Ошибка загрузки профиля: ' + status;
    }
  }

  // ===== logout
  function setupLogout(){
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    // Если csrf_token доступен в невидимом cookie (не HttpOnly), прочитаем
    function getCookie(name){
      const m = document.cookie.match(new RegExp('(^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g,'\\$1') + '=([^;]*)'));
      return m ? decodeURIComponent(m[2]) : null;
    }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const csrf = getCookie('csrf_token'); // может быть null
        await authLogout(csrf);               // сервер сам читает refresh/csrf из cookie
      } catch(_) { /* игнорируем — выходим локально */ }

      // чистим состояние на фронте
      try {
        del(KEYS.TOKEN);
        del(KEYS.STATE);
        del(KEYS.CHALLENGE);
        del(KEYS.RESEND_UNTIL);
      } catch {}

      window.location.href = '/auth.html';
    });
  }

  // init
  loadMe();
  setupLogout();
})();

