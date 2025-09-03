// assets/js/cabinet.js
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

  // ===== token/redirect
  const token = load(KEYS.TOKEN, null);
  if (!token?.access_token) {
    window.location.href = '/auth.html?next=%2Fcabinet.html';
    return;
  }

  // ===== helpers
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

  const setBusy = (v) => v ? card.setAttribute('aria-busy','true') : card.removeAttribute('aria-busy');

  // ===== load profile
  async function loadMe(){
    setBusy(true);
    meMsg.textContent = 'Загружаем профиль…';

    try {
      const { ok, status, data } = await authMe(token.access_token);

      if (!ok) {
        // авторизация истекла — уходим на логин
        if (status === 401 || status === 403) {
          window.location.href = '/auth.html?next=%2Fcabinet.html';
          return;
        }
        meMsg.textContent = 'Ошибка загрузки профиля: ' + (status ?? 'неизвестно');
        console.error('[cabinet] authMe not ok', { status });
        return;
      }

      // --- success
      const username = (data?.username || '').trim();
      const email    = (data?.email || '').trim();

      meUsername.textContent = username || 'Без имени';

      meEmail.textContent = email || '—';
      meEmail.title = email || '';

      const avatarSource = username || email || 'U';
      meAvatar.textContent = (avatarSource.trim()[0] || 'U').toUpperCase();

      meActive.textContent   = data?.is_active ? 'Активен' : 'Неактивен';
      meGender.textContent   = mapGender(data?.gender);
      meBirth.textContent    = data?.birth_date
        ? `${fmtDate(data.birth_date)}${ageFrom(data.birth_date) ? ` · ${ageFrom(data.birth_date)} лет` : ''}`
        : '—';
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
    } catch (err) {
      console.error('[cabinet] authMe error', err);
      meMsg.textContent = 'Не удалось загрузить профиль. Проверьте соединение и попробуйте ещё раз.';
    } finally {
      setBusy(false);
    }
  }

  // ===== logout
  function setupLogout(){
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    function getCookie(name){
      const m = document.cookie.match(new RegExp('(^|; )' + name.replace(/([.$?*|{}()[\\]\\\\/+^])/g,'\\\\$1') + '=([^;]*)'));
      return m ? decodeURIComponent(m[2]) : null;
    }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const csrf = getCookie('csrf_token');
        await authLogout(csrf);
      } catch(err) {
        console.warn('[cabinet] logout error (ignored)', err);
      }
      try {
        del(KEYS.TOKEN); del(KEYS.STATE); del(KEYS.CHALLENGE); del(KEYS.RESEND_UNTIL);
      } catch {}
      window.location.href = '/auth.html';
    });
  }

  // init
  loadMe();
  setupLogout();
})();
