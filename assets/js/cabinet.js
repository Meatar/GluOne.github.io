// cabinet.js
import {
  authMe, authLogout, authDevices, authRevokeDevice,
  authChangePassword, authDeleteAccount, authDeleteDevice
} from './api.js';
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

  // ---- subscription refs (новые)
  const subCard       = el('subCard');
  const subStatus     = el('subStatus');
  const subPaidTill   = el('subPaidTill');
  const subDevice     = el('subDevice');
  const subPeriod     = el('subPeriod');
  const subAmount     = el('subAmount');
  const subPerMonth   = el('subPerMonth');
  const subEmail      = el('subEmail');
  const subPayBtn     = el('subPayBtn');
  const subTransferBtn= el('subTransferBtn');
  const subMsg        = el('subMsg');

  // ---- devices refs
  const meDevicesSection = el('meDevicesSection');
  const meDevicesStatus  = el('meDevicesStatus');
  const meDevicesEmpty   = el('meDevicesEmpty');
  const meDevicesList    = el('meDevices');

  // ---- modal refs
  const modalChangePass = el('modalChangePass');
  const cpForm   = el('cpForm');
  const cpOld    = el('cpOld');
  const cpNew    = el('cpNew');
  const cpMsg    = el('cpMsg');
  const cpCancel = el('cpCancel');
  const cpSubmit = el('cpSubmit');

  const modalDelete = el('modalDelete');
  const delForm   = el('delForm');
  const delUser   = el('delUser');
  const delPass   = el('delPass');
  const delMsg    = el('delMsg');
  const delCancel = el('delCancel');
  const delSubmit = el('delSubmit');

  // перенос Premium
  const modalTransfer = el('modalTransfer');
  const trList   = el('trList');
  const trConfirm= el('trConfirm');
  const trCancel = el('trCancel');
  const trMsg    = el('trMsg');

  /* ======================== helpers ======================== */
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
  const RUB = (n) => new Intl.NumberFormat('ru-RU').format(n);

  /* ====== PayForm v2 (Т-Банк) ====== */
  const TINKOFF_SCRIPT_SRC = "https://securepay.tinkoff.ru/html/payForm/js/tinkoff_v2.js";
  const TINKOFF_TERMINAL_KEY = "1756472050322DEMO";
  const PRICE_RUB_PER_MONTH = 150;
  const PERIODS = {
    "1m": { label: "1 месяц", months: 1 },
    "3m": { label: "3 месяца", months: 3 },
    "6m": { label: "6 месяцев", months: 6 },
    "12m": { label: "12 месяцев", months: 12 },
  };
  const periodAmountRub = (k) => PRICE_RUB_PER_MONTH * (PERIODS[k]?.months || 1);

  function loadTinkoffScript() {
    return new Promise((resolve, reject) => {
      if (window.pay) return resolve(true);
      const existing = document.querySelector(`script[src="${TINKOFF_SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once:true });
        existing.addEventListener('error', () => reject(new Error('script error')), { once:true });
        return;
      }
      const s = document.createElement('script');
      s.src = TINKOFF_SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('script error'));
      document.head.appendChild(s);
    });
  }

  function buildPayForm(params){
    const form = document.createElement('form');
    form.style.display = 'none';
    form.setAttribute('name', 'payform-tbank-auto');
    Object.entries(params).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = (name === 'amount') ? 'text' : 'hidden';
      input.name = name;
      input.value = String(value ?? '');
      form.appendChild(input);
    });
    return form;
  }

  async function openPay(params){
    await loadTinkoffScript();
    if (!window.pay) throw new Error('Виджет оплаты ещё не готов');
    const form = buildPayForm(params);
    document.body.appendChild(form);
    try { window.pay(form); } finally { document.body.removeChild(form); }
  }

  /* ======================== state ======================== */
  let currentUsername = null;
  let currentUserId   = null; // если бек энд вернёт id — используем для customerKey
  let profileLoaded = false;

  // для «переноса Premium»
  let devicesCache = [];
  let currentPremiumDeviceId = null;
  let currentPremiumDeviceName = '—';

  /* ======================== profile ======================== */
  async function loadMe(){
    meMsg.textContent = 'Загружаем профиль…';
    const { ok, status, data } = await authMe(token.access_token);

    if (ok) {
      profileLoaded = true;
      currentUsername = data?.username || data?.email || null;
      currentUserId   = data?.id || null;

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

      // Премиум статус / карточка подписки
      const isPremium = !!data?.is_premium;
      const exp = data?.premium_expires_at ? new Date(data.premium_expires_at) : null;

      mePremium.hidden = !isPremium;
      mePremiumNote.hidden = false;
      mePremiumNote.textContent = isPremium
        ? (exp ? `Premium до ${exp.toLocaleString('ru-RU',{year:'numeric',month:'long',day:'numeric'})}` : 'Premium активен')
        : 'Premium не оплачен';

      // Заполним карточку подписки
      subCard.hidden = false;
      subEmail.value = data?.email || '';
      subStatus.textContent = isPremium ? 'Активна' : 'Не активна';
      subPaidTill.textContent = exp ? fmtDate(exp) : '—';
      subDevice.textContent = currentPremiumDeviceName;
      updateAmountUI(); // первичный пересчёт

      meMsg.textContent = '';
      return;
    }

    if (status === 401 || status === 404) {
      window.location.href = '/auth.html?next=%2Fcabinet.html';
    } else {
      meMsg.textContent = 'Ошибка загрузки профиля: ' + status;
    }
  }

  /* ======================== devices ======================== */
  const chip = (text, cls = '') => {
    const c = document.createElement('span');
    c.className = 'chip' + (cls ? ` ${cls}` : '');
    c.textContent = text;
    return c;
  };

  function attrRow(dt, dd){
    const dte = document.createElement('dt'); dte.textContent = dt;
    const dde = document.createElement('dd'); dde.textContent = (dd ?? '—');
    return [dte, dde];
  }

  async function onRevoke(deviceId, btn){
    if (!deviceId) return;

    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Выходим…';

    try {
      const { ok, status, data } = await authRevokeDevice(token.access_token, deviceId);

      if (ok || status === 204) {
        await loadDevices();
        meDevicesStatus.hidden = false;
        meDevicesStatus.textContent = 'Устройство разлогинено.';
        setTimeout(() => { meDevicesStatus.hidden = true; }, 2000);
      } else if (status === 401) {
        meDevicesStatus.hidden = false;
        meDevicesStatus.textContent = 'Сессия истекла. Войдите заново.';
      } else {
        const msg = Array.isArray(data?.detail)
          ? data.detail.map(e => e?.msg).filter(Boolean).join('; ')
          : `Ошибка: ${status}`;
        meDevicesStatus.hidden = false;
        meDevicesStatus.textContent = msg;
      }
    } catch (e) {
      console.error('revoke error', e);
      meDevicesStatus.hidden = false;
      meDevicesStatus.textContent = 'Ошибка сети при выходе с устройства.';
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }

  async function onDelete(deviceId, btn){
    if (!deviceId) return;

    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Удаляем…';

    try {
      const { ok, status, data } = await authDeleteDevice(token.access_token, deviceId);

      if (ok || status === 204) {
        await loadDevices();
        meDevicesStatus.hidden = false;
        meDevicesStatus.textContent = 'Запись об устройстве удалена.';
        setTimeout(() => { meDevicesStatus.hidden = true; }, 2000);
      } else if (status === 401) {
        meDevicesStatus.hidden = false;
        meDevicesStatus.textContent = 'Сессия истекла. Войдите заново.';
      } else {
        const msg = Array.isArray(data?.detail)
          ? data.detail.map(e => e?.msg).filter(Boolean).join('; ')
          : `Ошибка: ${status}`;
        meDevicesStatus.hidden = false;
        meDevicesStatus.textContent = msg;
      }
    } catch (e) {
      console.error('delete device error', e);
      meDevicesStatus.hidden = false;
      meDevicesStatus.textContent = 'Ошибка сети при удалении устройства.';
    } finally {
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }

  function renderDevice(dev){
    const item  = document.createElement('section');
    item.className = 'device-item';

    const head  = document.createElement('div');
    head.className = 'device-head';

    const title = document.createElement('div');
    title.className = 'device-title';
    title.textContent = dev?.model || 'Неизвестное устройство';

    const right = document.createElement('div');
    right.className = 'device-right';

    const badges = document.createElement('div');
    badges.className = 'device-badges';
    if (dev?.current) badges.appendChild(chip('Текущее'));
    if (dev?.revoked) badges.appendChild(chip('Отозвано'));
    if (dev?.is_premium) badges.appendChild(chip('Premium', 'chip-premium'));

    // Если устройство НЕ отозвано — показываем «Выйти ...»
    if (!dev?.revoked) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-outline device-revoke';
      btn.textContent = dev?.current ? 'Выйти здесь' : 'Выйти с устройства';
      btn.addEventListener('click', async () => {
        const ok = confirm(`Выйти с устройства "${dev?.model || dev?.device_id}"?`);
        if (!ok) return;
        await onRevoke(dev?.device_id, btn);
      });
      right.appendChild(btn);
    } else {
      // Если устройство уже отозвано — даём удалить запись
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-danger device-delete';
      delBtn.textContent = 'Удалить';
      delBtn.addEventListener('click', async () => {
        const ok = confirm(`Удалить запись об устройстве "${dev?.model || dev?.device_id}"?`);
        if (!ok) return;
        await onDelete(dev?.device_id, delBtn);
      });
      right.appendChild(delBtn);
    }

    right.appendChild(badges);
    head.appendChild(title);
    head.appendChild(right);

    const attrs = document.createElement('dl');
    attrs.className = 'device-attrs';
    [
      ...attrRow('ОС', dev?.os),
      ...attrRow('Сборка', dev?.app_build),
      ...attrRow('Активность', dev?.last_seen_at ? fmtDateTime(dev.last_seen_at) : null),
      ...attrRow('Создано', dev?.created_at ? fmtDate(dev.created_at) : null),
      ...attrRow('IP', dev?.last_ip),
      ...attrRow('ID устройства', dev?.device_id),
      ...(dev?.premium_expires_at ? attrRow('Premium до', fmtDate(dev.premium_expires_at)) : []),
    ].forEach(n => attrs.appendChild(n));

    item.appendChild(head);
    item.appendChild(attrs);
    return item;
  }

  async function loadDevices(){
    if (!meDevicesSection) return;

    meDevicesSection.hidden = false;
    meDevicesStatus.hidden = false;
    meDevicesStatus.textContent = 'Загрузка устройств…';
    meDevicesEmpty.hidden = true;
    meDevicesList.innerHTML = '';

    try {
      const { ok, status, data } = await authDevices(token.access_token);

      if (!ok) {
        meDevicesStatus.hidden = true;
        meDevicesEmpty.hidden = false;
        meDevicesEmpty.textContent =
          (status === 401 || status === 403)
            ? 'Требуется повторный вход, чтобы посмотреть устройства.'
            : `Не удалось загрузить устройства (код ${status}).`;
        return;
      }

      const arr = Array.isArray(data) ? data : [];
      devicesCache = arr.slice();

      // вычислим «текущее Premium-устройство» (если в ответе есть такая пометка)
      const cur = arr.find(d => d.is_premium) || arr.find(d => d.current) || null;
      currentPremiumDeviceId = cur?.device_id || null;
      currentPremiumDeviceName = cur?.model || '—';
      if (subDevice) subDevice.textContent = currentPremiumDeviceName;

      meDevicesStatus.hidden = true;

      if (!arr.length) {
        meDevicesEmpty.hidden = false;
        meDevicesEmpty.textContent = 'Пока нет данных об устройствах.';
        return;
      }

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

  /* ======================== модалки (общие) ======================== */
  function openModal(modal){
    modal.hidden = false; modal.setAttribute('aria-hidden','false');
    const focusable = modal.querySelector('input,button,select,textarea,[href]');
    if (focusable) focusable.focus();
    const close = (e) => { if (e.target.classList.contains('modal-backdrop')) hide(); };
    const hide = () => {
      modal.hidden = true; modal.setAttribute('aria-hidden','true');
      modal.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
    const esc = (e) => { if (e.key === 'Escape') hide(); };
    modal.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return hide;
  }

  // Кнопка-глаз для password-полей
  function installPasswordToggle(inputEl) {
    if (!inputEl) return;
    const label = inputEl.closest('.form-field');
    if (!label || label.querySelector('.toggle-pass')) return;

    const wrap = document.createElement('div');
    wrap.className = 'field-wrap';
    label.replaceChild(wrap, inputEl);
    wrap.appendChild(inputEl);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle-pass';
    btn.dataset.state = 'hidden';
    btn.setAttribute('aria-label', 'Показать пароль');
    btn.setAttribute('title', 'Показать пароль');

    btn.innerHTML = `
      <svg class="i i-eye" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
      </svg>
      <svg class="i i-eye-off" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7c2.3 0 4.2.6 5.9 1.6M22 12s-3.6 7-10 7c-2.3 0-4.2-.6-5.9-1.6" stroke="currentColor" stroke-width="2"/>
        <path d="M3 3l18 18" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;

    btn.addEventListener('click', () => {
      const willShow = (inputEl.type === 'password');
      inputEl.type = willShow ? 'text' : 'password';
      btn.dataset.state = willShow ? 'visible' : 'hidden';
      const label = willShow ? 'Скрыть пароль' : 'Показать пароль';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      inputEl.focus({ preventScroll: true });
      const v = inputEl.value; inputEl.setSelectionRange(v.length, v.length);
    });

    wrap.appendChild(btn);
  }

  /* ======================== смена пароля ======================== */
  function setupChangePassword(){
    const btn = el('changePassBtn');
    if (!btn) return;

    let closeModal = null;

    btn.addEventListener('click', () => {
      if (!profileLoaded || !currentUsername) {
        alert('Профиль ещё не загружен. Повторите попытку через пару секунд.');
        return;
      }
      cpForm.reset();
      cpMsg.textContent = '';
      closeModal = openModal(modalChangePass);
    });

    cpCancel.addEventListener('click', () => closeModal && closeModal());

    cpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!profileLoaded || !currentUsername) {
        cpMsg.textContent = 'Профиль не загружен. Повторите попытку позже.';
        return;
      }

      cpMsg.textContent = '';

      const old_password = (cpOld.value || '').trim();
      const new_password = (cpNew.value || '').trim();
      if (!old_password || !new_password) {
        cpMsg.textContent = 'Заполните оба поля.';
        return;
      }

      cpSubmit.disabled = true;
      cpSubmit.textContent = 'Сохраняем…';
      try {
        const res = await authChangePassword(currentUsername, old_password, new_password);
        if (res.status === 204) {
          cpMsg.textContent = 'Пароль успешно изменён.';
          setTimeout(() => { closeModal && closeModal(); }, 800);
        } else if (res.status === 401) {
          cpMsg.textContent = 'Неверный старый пароль или учётные данные.';
        } else if (res.status === 403) {
          cpMsg.textContent = 'Пользователь неактивен.';
        } else if (res.status === 422) {
          const msg = Array.isArray(res.data?.detail)
            ? res.data.detail.map(e => e?.msg).filter(Boolean).join('; ')
            : 'Проверьте корректность полей.';
          cpMsg.textContent = msg;
        } else if (res.status === 429) {
          cpMsg.textContent = 'Слишком много попыток. Попробуйте позже.';
        } else {
          cpMsg.textContent = `Ошибка: ${res.status}`;
        }
      } catch (err) {
        cpMsg.textContent = 'Ошибка сети. Повторите попытку.';
        console.error('change-password error', err);
      } finally {
        cpSubmit.disabled = false;
        cpSubmit.textContent = 'Изменить';
      }
    });
  }

  /* ======================== удаление аккаунта ======================== */
  function setupDeleteAccount(){
    const btn = el('deleteAccountBtn');
    if (!btn) return;

    let closeModal = null;

    btn.addEventListener('click', () => {
      delForm.reset();
      delMsg.textContent = '';
      closeModal = openModal(modalDelete);
    });

    delCancel.addEventListener('click', () => closeModal && closeModal());

    delForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      delMsg.textContent = '';

      const username = (delUser.value || '').trim();
      const password = (delPass.value || '').trim();
      if (!username || !password) {
        delMsg.textContent = 'Укажите логин и пароль.';
        return;
      }

      delSubmit.disabled = true;
      delSubmit.textContent = 'Удаляем…';
      try {
        const res = await authDeleteAccount(username, password);
        if (res.status === 204) {
          try {
            del(KEYS.TOKEN); del(KEYS.STATE); del(KEYS.CHALLENGE); del(KEYS.RESEND_UNTIL);
          } catch {}
          window.location.href = '/';
          return;
        } else if (res.status === 401) {
          delMsg.textContent = 'Неверный логин или пароль.';
        } else if (res.status === 403) {
          delMsg.textContent = 'Пользователь неактивен.';
        } else if (res.status === 422) {
          const msg = Array.isArray(res.data?.detail)
            ? res.data.detail.map(e => e?.msg).filter(Boolean).join('; ')
            : 'Проверьте корректность полей.';
          delMsg.textContent = msg;
        } else if (res.status === 429) {
          delMsg.textContent = 'Слишком много попыток. Попробуйте позже.';
        } else {
          delMsg.textContent = `Ошибка: ${res.status}`;
        }
      } catch (err) {
        delMsg.textContent = 'Ошибка сети. Повторите попытку.';
        console.error('delete-account error', err);
      } finally {
        delSubmit.disabled = false;
        delSubmit.textContent = 'Удалить';
      }
    });
  }

  /* ======================== перенос Premium (UI, без API) ======================== */
  function setupTransfer(){
    if (!subTransferBtn) return;
    let closeModal = null;
    let selectedId = null;

    const renderList = () => {
      trList.innerHTML = '';
      const eligible = devicesCache.filter(d => !d.revoked && d.device_id !== currentPremiumDeviceId);
      if (!eligible.length) {
        trList.innerHTML = `<div class="form-hint">Нет доступных устройств для переноса.</div>`;
        trConfirm.disabled = true;
        return;
      }
      eligible.forEach(d => {
        const item = document.createElement('div');
        item.className = 'transfer-item';
        item.setAttribute('role','listitem');
        item.dataset.active = 'false';
        item.innerHTML = `
          <div>
            <div class="transfer-item-title">${d.model || 'Неизвестное устройство'}</div>
            <div class="transfer-item-sub">${(d.os || '—')} • ${(d.last_ip || '—')} • ${d.last_seen_at ? fmtDateTime(d.last_seen_at) : '—'}</div>
          </div>
        `;
        item.addEventListener('click', () => {
          [...trList.children].forEach(ch => ch.dataset.active = 'false');
          item.dataset.active = 'true';
          selectedId = d.device_id;
          trConfirm.disabled = false;
        });
        trList.appendChild(item);
      });
    };

    subTransferBtn.addEventListener('click', () => {
      trMsg.textContent = '';
      renderList();
      trConfirm.disabled = true;
      closeModal = openModal(modalTransfer);
    });

    trCancel.addEventListener('click', () => closeModal && closeModal());
    trConfirm.addEventListener('click', () => {
      if (!selectedId) return;
      // Здесь должен быть вызов API «перенести Premium» (когда появится)
      currentPremiumDeviceId = selectedId;
      const d = devicesCache.find(x => x.device_id === selectedId);
      currentPremiumDeviceName = d?.model || '—';
      if (subDevice) subDevice.textContent = currentPremiumDeviceName;
      trMsg.textContent = 'Premium перенесён (локально).';
      setTimeout(() => closeModal && closeModal(), 600);
    });
  }

  /* ======================== подписка: выбор периода / оплата ======================== */
  function updateAmountUI(){
    if (!subPeriod || !subAmount || !subPerMonth) return;
    const key = subPeriod.value || '1m';
    const months = PERIODS[key]?.months || 1;
    const total = periodAmountRub(key);
    subAmount.textContent = `${RUB(total)} ₽`;
    subPerMonth.textContent = `${PRICE_RUB_PER_MONTH} ₽/мес × ${months}`;
  }

  function setupSubscription(){
    if (!subCard) return;
    subPeriod.addEventListener('change', updateAmountUI);

    subPayBtn.addEventListener('click', async () => {
      subMsg.textContent = '';
      subPayBtn.disabled = true;

      try {
        const key = subPeriod.value || '1m';
        const months = PERIODS[key]?.months || 1;
        const totalRub = periodAmountRub(key);
        const orderId = `sub_${key}_${Date.now()}`;
        const email = subEmail.value || '';
        const customerKey = (currentUserId || currentUsername || email || '').toString();

        const params = {
          terminalkey: TINKOFF_TERMINAL_KEY,
          frame: "true",
          language: "ru",
          amount: String(totalRub), // в РУБЛЯХ
          order: orderId,
          description: `GluOne Premium — продление (${PERIODS[key].label})`,
          email,
          customerKey,               // camelCase
          DATA: `plan=${key} | months=${months} | user=${customerKey}`
        };

        // Если нужна фискализация из виджета — раскомментировать:
        // const receipt = {
        //   EmailCompany: "billing@gluone.ru",
        //   Taxation: "usn_income",
        //   FfdVersion: "1.2",
        //   Items: [{
        //     Name: `GluOne Premium (${PERIODS[key].label})`,
        //     Price: Math.round(totalRub * 100),
        //     Quantity: 1.0,
        //     Amount: Math.round(totalRub * 100),
        //     PaymentMethod: "full_prepayment",
        //     PaymentObject: "service",
        //     Tax: "none",
        //     MeasurementUnit: "pc"
        //   }]
        // };
        // params.receipt = JSON.stringify(receipt);

        await openPay(params);
      } catch (e) {
        console.error(e);
        subMsg.textContent = 'Не удалось открыть оплату. Попробуйте ещё раз.';
      } finally {
        subPayBtn.disabled = false;
      }
    });
  }

  /* ======================== logout ======================== */
  function setupLogout(){
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    const CSRF_COOKIE_NAME = 'csrf_token';
    function getCookie(name){
      const m = document.cookie.match(new RegExp('(^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g,'\\$1') + '=([^;]*)'));
      return m ? decodeURIComponent(m[2]) : null;
    }

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const csrf = getCookie(CSRF_COOKIE_NAME);
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

  /* ======================== init ======================== */
  // password toggles
  installPasswordToggle(cpOld);
  installPasswordToggle(cpNew);
  installPasswordToggle(delPass);

  // boot
  loadMe();
  try { loadDevices(); } catch (e) { console.error('loadDevices() failed:', e); }
  setupChangePassword();
  setupDeleteAccount();
  setupSubscription();
  setupTransfer();
  setupLogout();
})();
