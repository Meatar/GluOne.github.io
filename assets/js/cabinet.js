import { authMe, authLogout, authDevices } from './api.js';
import { KEYS, load, del } from './storage.js';

(() => {
  const card = document.getElementById('meCard');
  if (!card) return;

  const el = (id) => document.getElementById(id);
  // ---- profile refs
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

  // ---- devices refs
  const meDevicesSection = el('meDevicesSection');
  const meDevicesStatus  = el('meDevicesStatus');
  const meDevicesEmpty   = el('meDevicesEmpty');
  const meDevicesList    = el('meDevices');

  const token = load(KEYS.TOKEN, null);
  if (!token?.access_token) {
    window.location.href = '/auth.html?next=%2Fcabinet.html';
    return;
  }

  // ===== helpers
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

  const fmtDate   = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', {year:'numeric', month:'long', day:'numeric'}); } catch { return iso || '—'; } };
  const fmtDateTime = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}); } catch { return iso || '—'; } };
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

  // ===== devices
  function chip(text) {
    const c = document.createElement('span');
    c.className = 'chip';
    c.textContent = text;
    return c;
  }

  function renderDeviceRow(dev) {
    const row = document.createElement('div');
    row.className = 'me-row';

    // left block: title + meta
    const left = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'me-value';
    const model = dev?.model || 'Неизвестное устройство';
    const os = dev?.os ? ` • ${dev.os}` : '';
    title.textContent = `${model}${os}`;

    const meta = document.createElement('div');
    meta.className = 'form-hint';
    const pieces = [];
    if (dev?.app_build) pieces.push(`сборка ${dev.app_build}`);
    if (dev?.last_seen_at) pieces.push(`активность ${fmtDateTime(dev.last_seen_at)}`);
    if (dev?.last_ip) pieces.push(`IP ${dev.last_ip}`);
    if (dev?.device_id) pieces.push(`ID ${dev.device_id}`);
    meta.textContent = pieces.join(' • ');

    left.appendChild(title);
    left.appendChild(meta);

    // right block: chips
    const right = document.createElement('div');
    right.className = 'me-chips';

    if (dev?.current) right.appendChild(chip('Текущее'));
    if (dev?.revoked) right.appendChild(chip('Отозвано'));
    if (dev?.created_at) right.appendChild(chip(`создано ${new Date(dev.created_at).toLocaleDateString('ru-RU')}`));

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  async function loadDevices(){
    if (!meDevicesSection) return;

    // показать секцию и статус
    meDevicesSection.hidden = false;
    meDevicesStatus.hidden = false;
    meDevicesEmpty.hidden = true;
    meDevicesList.innerHTML = '';

    const { ok, status, data } = await authDevices(token.access_token);

    meDevicesStatus.hidden = true;

    if (!ok) {
      // при 401/403 — молча скрываем список (скорее всего токен протух)
      if (status === 401 || status === 403) {
        meDevicesSection.hidden = true;
        return;
      }
      // иначе — показываем пустое состояние с кодом
      meDevicesEmpty.hidden = false;
      meDevicesEmpty.textContent = `Не удалось загрузить устройства (код ${status}).`;
      return;
    }

    const arr = Array.isArray(data) ? data : [];
    if (!arr.length) {
      meDevicesEmpty.hidden = false;
      meDevicesEmpty.textContent = 'Пока нет данных об устройствах.';
      return;
    }

    // сортируем: текущие сверху, потом по последней активности (новее раньше)
    arr.sort((a, b) => {
      if (a.current && !b.current) return -1;
      if (!a.current && b.current) return 1;
      const ta = a.last_seen_at ? Date.parse(a.last_seen_at) : 0;
      const tb = b.last_seen_at ? Date.parse(b.last_seen_at) : 0;
      return tb - ta;
    });

    arr.forEach(dev => meDevicesList.appendChild(renderDeviceRow(dev)));
  }

  // ===== logout
  function setupLogout(){
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

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

      try {
        del(KEYS.TOKEN);
        del(KEYS.STATE);
        del(KEYS.CHALLENGE);
        del(KEYS.RESEND_UNTIL);
      } catch {}

      window.location.href = '/auth.html';
    });
  }

  // init (запускаем параллельно)
  loadMe();
  loadDevices();
  setupLogout();
})();
