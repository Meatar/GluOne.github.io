import { authMe, authLogout, authDevices } from './api.js';
import { KEYS, load, del } from './storage.js';

(() => {
  const el = (id) => document.getElementById(id);

  const token = load(KEYS.TOKEN, null);
  if (!token?.access_token) {
    window.location.href = '/auth.html?next=%2Fcabinet.html';
    return;
  }

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

  const meDevicesSection = el('meDevicesSection');
  const meDevicesStatus  = el('meDevicesStatus');
  const meDevicesEmpty   = el('meDevicesEmpty');
  const meDevicesList    = el('meDevices');

  // helpers
  const maskEmail = (em) => (em && typeof em === 'string') ? em : '—';
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
  const fmtDate     = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', {year:'numeric', month:'long', day:'numeric'}); } catch { return iso || '—'; } };
  const fmtDateTime = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}); } catch { return iso || '—'; } };
  const mapGender = (g) => ({ male:'Мужской', female:'Женский' })[g] || '—';
  const mapDia    = (t) => ({ type1:'Тип 1', type2:'Тип 2', gestational:'Гестационный' })[t] || '—';

  // ===== profile
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

      // Premium info
      mePremium.hidden = !data?.is_premium;
      mePremiumNote.hidden = false;
      if (data?.is_premium){
        const exp = data?.premium_expires_at ? new Date(data.premium_expires_at) : null;
        mePremiumNote.textContent = exp
          ? `Подписка Premium активна до ${exp.toLocaleString('ru-RU',{year:'numeric',month:'long',day:'numeric'})}.`
          : 'Подписка Premium активна.';
      } else {
        mePremiumNote.textContent = 'Premium не оплачен';
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

  // ===== devices (оставляем как у тебя было) ...
  // loadDevices(), renderDevice(), setupLogout() — без изменений

  loadMe();
  loadDevices();
  setupLogout();
})();
