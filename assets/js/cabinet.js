import { authMe, authLogout, authDevices } from './api.js';
import { KEYS, load, del } from './storage.js';

(() => {
  const el = (id) => document.getElementById(id);

  // redirect if no token
  const token = load(KEYS.TOKEN, null);
  if (!token?.access_token) {
    window.location.href = '/auth.html?next=%2Fcabinet.html';
    return;
  }

  const meCard = el('meCard');
  if (!meCard) return;

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
        const chipEl = document.createElement('span');
        chipEl.className = 'chip';
        chipEl.textContent = r;
        meRoles.appendChild(chipEl);
      });

      // ---- Premium info (всегда показываем строку)
      mePremium.hidden = !data?.is_premium;
      mePremiumNote.hidden = false;
        if (data?.is_premium){
          const exp = data?.premium_expires_at ? new Date(data.premium_expires_at) : null;
          mePremiumNote.textContent = exp
            ? `Premium до ${exp.toLocaleString('ru-RU',{year:'numeric',month:'long',day:'numeric'})}`
            : 'Premium активен';
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

  // ===== devices
  const chip = (text) => {
    const c = document.createElement('span');
    c.className = 'chip';
    c.textContent = text;
    return c;
  };

  function attrRow(dt, dd){
    const dte = document.createElement('dt'); dte.textContent = dt;
    const dde = document.createElement('dd'); dde.textContent = (dd ?? '—');
    return [dte, dde];
  }

  function renderDevice(dev){
    const item  = document.createElement('section');
    item.className = 'device-item';

    // header
    const head  = document.createElement('div');
    head.className = 'device-head';

    const title = document.createElement('div');
    title.className = 'device-title';
    title.textContent = dev?.model || 'Неизвестное устройство';

    const badges = document.createElement('div');
    badges.className = 'device-badges';
    if (dev?.current) badges.appendChild(chip('Текущее'));
    if (dev?.revoked) badges.appendChild(chip('Отозвано'));

    head.appendChild(title);
    head.appendChild(badges);

    // attrs
    const attrs = document.createElement('dl');
    attrs.className = 'device-attrs';

    [
      ...attrRow('ОС', dev?.os),
      ...attrRow('Сборка', dev?.app_build),
      ...attrRow('Активность', dev?.last_seen_at ? fmtDateTime(dev.last_seen_at) : null),
      ...attrRow('Создано', dev?.created_at ? fmtDate(dev.created_at) : null),
      ...attrRow('IP', dev?.last_ip),
      ...attrRow('ID устройства', dev?.device_id),
    ].forEach(n => attrs.appendChild(n));

    item.appendChild(head);
    item.appendChild(attrs);
    return item;
  }

  async function loadDevices(){
    if (!meDevicesSection) return;

    // показываем секцию сразу (чтобы пользователь видел статус)
    meDevicesSection.hidden = false;
    meDevicesStatus.hidden = false;
    meDevicesEmpty.hidden = true;
    meDevicesList.innerHTML = '';

    try {
      const { ok, status, data } = await authDevices(token.access_token);

      meDevicesStatus.hidden = true;

      if (!ok) {
        meDevicesEmpty.hidden = false;
        meDevicesEmpty.textContent =
          (status === 401 || status === 403)
            ? 'Требуется повторный вход, чтобы посмотреть устройства.'
            : `Не удалось загрузить устройства (код ${status}).`;
        return;
      }

      const arr = Array.isArray(data) ? data : [];
      if (!arr.length) {
        meDevicesEmpty.hidden = false;
        meDevicesEmpty.textContent = 'Пока нет данных об устройствах.';
        return;
      }

      // текущие — сверху, затем по активности
      arr.sort((a, b) => {
        if (a.current && !b.current) return -1;
        if (!a.current && b.current) return 1;
        return (Date.parse(b.last_seen_at || 0) - Date.parse(a.last_seen_at || 0));
      });

      arr.forEach(dev => meDevicesList.appendChild(renderDevice(dev)));
    } catch (e) {
      meDevicesStatus.hidden = true;
      meDevicesEmpty.hidden = false;
      meDevicesEmpty.textContent = 'Ошибка сети при загрузке устройств.';
      console.error('Devices load error:', e);
    }
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
        const csrf = getCookie('csrf_token');
        await authLogout(csrf);
      } catch(_) {}

      try {
        del(KEYS.TOKEN);
        del(KEYS.STATE);
        del(KEYS.CHALLENGE);
        del(KEYS.RESEND_UNTIL);
      } catch {}

      window.location.href = '/auth.html';
    });
  }

  // init — вызываем все безопасно
  loadMe();
  // чтобы ошибка в блоке устройств не «роняла» скрипт — оборачиваем
  try { loadDevices(); } catch (e) { console.error('loadDevices() failed:', e); }
  setupLogout();
})();
