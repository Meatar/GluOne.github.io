// React version of the personal cabinet.
// Built directly in the browser via Babel Standalone.

const { useState, useEffect } = React;

// ========= Параметры Tinkoff Pay =========
const TINKOFF_SCRIPT_SRC = "https://securepay.tinkoff.ru/html/payForm/js/tinkoff_v2.js";
const TINKOFF_TERMINAL_KEY = "1756472050322DEMO"; // demo key

// ========= Тарифы =========
const PRICE_RUB_PER_MONTH = 150;
const AMOUNT_IN_KOPECKS = false;

const PERIODS = {
  "1m": { label: "1 месяц", months: 1 },
  "3m": { label: "3 месяца", months: 3 },
  "6m": { label: "6 месяцев", months: 6 },
  "12m": { label: "12 месяцев", months: 12 }
};

function periodAmountRub(period) {
  return PRICE_RUB_PER_MONTH * PERIODS[period].months;
}

function formatRub(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function gatewayAmountString(amountRub) {
  const value = AMOUNT_IN_KOPECKS ? amountRub * 100 : amountRub;
  return String(value);
}

// ========= Утилита: собрать скрытую форму для window.pay =========
function buildTinkoffForm(params) {
  const form = document.createElement("form");
  form.style.display = "none";
  form.setAttribute("name", "payform-tbank-auto");
  Object.entries(params).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = name === "amount" ? "text" : "hidden";
    input.name = name;
    input.value = String(value || "");
    form.appendChild(input);
  });
  return form;
}

// ========= Hook: загрузка скрипта оплаты =========
function useTinkoffScript() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (window.pay) {
      setReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${TINKOFF_SCRIPT_SRC}"]`);
    if (existing) {
      const onLoad = () => setReady(true);
      const onErr = () => setError("Не удалось загрузить виджет оплаты.");
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onErr);
      return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onErr);
      };
    }
    const s = document.createElement("script");
    s.src = TINKOFF_SCRIPT_SRC;
    s.async = true;
    s.onload = () => setReady(true);
    s.onerror = () => setError("Не удалось загрузить виджет оплаты.");
    document.head.appendChild(s);
  }, []);

  const openPayForm = (params) => {
    if (!window.pay) throw new Error("Виджет оплаты ещё не готов");
    const form = buildTinkoffForm(params);
    document.body.appendChild(form);
    try {
      window.pay(form);
    } finally {
      document.body.removeChild(form);
    }
  };

  useEffect(() => {
    const f = buildTinkoffForm({ terminalkey: "K", amount: "100", order: "o1" });
    console.assert(f.elements.namedItem("terminalkey").value === "K", "[TEST] terminalkey value mismatch");
    console.assert(f.elements.namedItem("amount").value === "100", "[TEST] amount value mismatch");
    console.assert(f.elements.namedItem("order").value === "o1", "[TEST] order value mismatch");
  }, []);

  return { ready, error, openPayForm };
}

// ========= Утилиты UI =========
function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-white/60 text-slate-700 border-slate-200">
      {children}
    </span>
  );
}

function RowButton({ icon, children, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50 border border-transparent hover:border-slate-200 transition">
      <span className="text-slate-500">{icon}</span>
      <span className="text-slate-800 font-medium">{children}</span>
    </button>
  );
}

function SectionCard({ title, children, footer }) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm border-slate-200">
      {title && (
        <div className="px-4 py-3 border-b border-slate-200/60 text-sm font-semibold text-slate-800">{title}</div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="px-4 py-3 border-t border-slate-200/60">{footer}</div>}
    </div>
  );
}

function KeyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800 text-right">{value}</div>
    </div>
  );
}

function DangerLink({ children }) {
  return (
    <button className="w-full text-sm font-medium text-rose-600 hover:text-rose-700 px-2 py-2 rounded-lg text-left">
      {children}
    </button>
  );
}

function DeviceItem({ name, os, build, ip, created, active, deviceId, revoked }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <div className="flex items-start justify-between">
        <div className="font-semibold text-slate-800">{name}</div>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${
            revoked ? "text-slate-600 bg-slate-50 border-slate-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"
          }`}>{revoked ? "Отозвано" : "Активно"}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="text-slate-500">OC</div><div className="text-slate-800">{os || "—"}</div>
        <div className="text-slate-500">Сборка</div><div className="text-slate-800">{build || "—"}</div>
        <div className="text-slate-500">Активность</div><div className="text-slate-800">{active}</div>
        <div className="text-slate-500">Создано</div><div className="text-slate-800">{created}</div>
        <div className="text-slate-500">IP</div><div className="text-slate-800">{ip}</div>
        <div className="text-slate-500">ID устройства</div><div className="text-slate-800 break-all">{deviceId}</div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {!revoked ? (
          <button className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800">Выйти с устройства</button>
        ) : (
          <button className="rounded-lg bg-rose-600 text-white px-3 py-1.5 text-sm hover:bg-rose-700">Удалить</button>
        )}
      </div>
    </div>
  );
}

// ========= Модалки =========
function TransferPremiumModal({ open, onClose, onConfirm, devices, currentDeviceId }) {
  const [selected, setSelected] = useState(null);

  if (!open) return null;
  const eligible = devices.filter(d => !d.revoked && d.deviceId !== currentDeviceId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
        <div className="text-base font-semibold text-slate-900">Перенести Premium на устройство</div>
        <p className="mt-1 text-sm text-slate-600">Выберите доступное устройство. Текущее устройство исключено из списка.</p>

        <div className="mt-4 space-y-2 max-h-72 overflow-auto">
          {eligible.length === 0 && (
            <div className="text-sm text-slate-500">Нет доступных устройств для переноса.</div>
          )}
          {eligible.map((d) => (
            <label key={d.deviceId} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer">
              <input type="radio" name="transfer-device" className="mt-1" checked={selected === d.deviceId} onChange={() => setSelected(d.deviceId)} />
              <div className="flex-1">
                <div className="font-medium text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-500">{d.os || "—"} • {d.ip} • {d.active}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm" onClick={onClose}>Отмена</button>
          <button disabled={!selected} className={`rounded-lg px-3 py-1.5 text-sm text-white ${selected ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"}`} onClick={() => {
            const d = eligible.find(x => x.deviceId === selected);
            if (d) onConfirm(d);
          }}>Перенести</button>
        </div>
      </div>
    </div>
  );
}

// ========= Хедер/Сайдбар =========
function UserMenu({ isAuthed, userName = "Meatar", onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = userName?.[0]?.toUpperCase() || "U";

  const handleClick = () => {
    if (!isAuthed) {
      window.location.href = "https://gluone.ru/auth.html";
      return;
    }
    setOpen(v => !v);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        aria-haspopup={isAuthed ? "menu" : undefined}
        aria-expanded={open}
        className={`flex items-center justify-center rounded-full h-9 ${
          isAuthed ? "w-9 bg-slate-100 text-slate-800 hover:bg-slate-200" : "px-3 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-full"
        } border border-slate-200 text-sm font-medium`}
        title={isAuthed ? "Аккаунт" : "Войти"}
      >
        {isAuthed ? <span className="font-semibold">{initial}</span> : <span>Войти</span>}
      </button>

      {isAuthed && open && (
        <div role="menu" className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          <div className="px-3 py-2 text-xs text-slate-500">{userName}</div>
          <button onClick={() => { setOpen(false); onLogout(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}

function SiteHeader({ isAuthed, onLogout }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500" />
          <span className="font-semibold text-slate-900">GluOne</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
          <a className="hover:text-slate-900" href="#">Главная</a>
          <a className="hover:text-slate-900" href="#">Приложение</a>
          <a className="hover:text-slate-900" href="#">Поддержка</a>
          <a className="hover:text-slate-900" href="#">Цены</a>
        </nav>
        <div className="flex items-center gap-3">
          <UserMenu isAuthed={isAuthed} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

function Sidebar({ current, onChange }) {
  const Item = ({ k, label, icon }) => (
    <button
      onClick={() => onChange(k)}
      className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
        current === k ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <aside className="hidden xl:block w-64 shrink-0">
      <div className="sticky top-16 space-y-1">
        <Item k="profile" label="Профиль" icon="👤" />
        <Item k="subscription" label="Подписка" icon="💎" />
        <Item k="security" label="Безопасность" icon="🔐" />
        <Item k="devices" label="Устройства" icon="📱" />
      </div>
    </aside>
  );
}

// ========= Панели =========
function ProfilePanel() {
  return (
    <div className="space-y-4 max-w-3xl">
      <SectionCard>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-indigo-100 text-indigo-600 font-semibold flex items-center justify-center">M</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-semibold text-slate-900">Meatar</div>
              <Chip>Premium</Chip>
            </div>
            <div className="text-sm text-slate-500">meatar@icloud.com</div>
          </div>
          <button className="text-slate-500 hover:text-slate-700 text-sm">Редактировать</button>
        </div>

        <div className="mt-4">
          <KeyRow label="Статус" value={<span className="text-emerald-700">Активен</span>} />
          <div className="flex items-center justify-between py-1.5">
            <div className="text-sm text-slate-500">Роли</div>
            <div className="flex gap-1"><Chip>admin</Chip><Chip>user</Chip></div>
          </div>
          <KeyRow label="Пол" value={"Мужской"} />
          <KeyRow label="Дата рождения" value={"17 апреля 1989 • 36 лет"} />
          <KeyRow label="Тип диабета" value={"Тип 2"} />
        </div>
      </SectionCard>
    </div>
  );
}

function SubscriptionPanel({ onOpenTransfer, currentDeviceName, onPay, payReady, selectedPeriod, setSelectedPeriod, amountRub, email }) {
  return (
    <div className="max-w-3xl">
      <SectionCard title="Подписка Premium">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Статус</span>
            <span className="font-medium text-emerald-700">Активна</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Оплачено до</span>
            <span className="font-medium">3 сентября 2025</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Устройство</span>
            <span className="font-medium">{currentDeviceName}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-slate-600">Период оплаты</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
            >
              <option value="1m">1 месяц — {formatRub(periodAmountRub("1m"))} ₽</option>
              <option value="3m">3 месяца — {formatRub(periodAmountRub("3m"))} ₽</option>
              <option value="6m">6 месяцев — {formatRub(periodAmountRub("6m"))} ₽</option>
              <option value="12m">12 месяцев — {formatRub(periodAmountRub("12m"))} ₽</option>
            </select>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">Итого к оплате</div>
            <div className="text-lg font-semibold text-slate-900">{formatRub(amountRub)} ₽</div>
            <div className="text-xs text-slate-500">{PRICE_RUB_PER_MONTH} ₽/мес × {PERIODS[selectedPeriod].months}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1">
          <label className="text-sm text-slate-600">E‑mail плательщика</label>
          <input value={email} readOnly className="rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-700" />
        </div>

        <div className="mt-4 flex gap-3">
          <button disabled={!payReady} onClick={onPay} className={`rounded-xl px-4 py-2 font-medium text-white ${payReady ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"}`}>
            Продлить
          </button>
          <button onClick={onOpenTransfer} className="rounded-xl border border-slate-200 px-4 py-2 font-medium">Сменить устройство</button>
        </div>
        {!payReady && (
          <div className="mt-2 text-xs text-slate-500">Загружаем виджет оплаты…</div>
        )}
      </SectionCard>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="max-w-3xl space-y-4">
      <SectionCard title="Смена пароля">
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <p className="text-sm text-slate-600">Рекомендуем менять пароль раз в 6–12 месяцев.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-600">Текущий пароль</label>
              <input type="password" autoComplete="current-password" placeholder="Введите текущий пароль" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-slate-600">Новый пароль</label>
              <input type="password" autoComplete="new-password" placeholder="Введите новый пароль" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800">Обновить</button>
          </div>
        </form>
      </SectionCard>

      <SectionCard>
        <DangerLink>Удалить аккаунт</DangerLink>
      </SectionCard>
    </div>
  );
}

function DevicesPanel() {
  return (
    <div className="space-y-4">
      <SectionCard title="Устройства" footer={<div className="text-sm text-slate-500">Всего устройств: 4</div>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DeviceItem name="Неизвестное устройство" os="—" build="—" ip="172.18.0.5" created="4 сентября 2025" active="04.09.2025, 15:47" deviceId="api" revoked={false} />
          <DeviceItem name="Неизвестное устройство" os="—" build="—" ip="172.18.0.5" created="3 сентября 2025" active="03.09.2025, 16:31" deviceId="my_phone_01" revoked={true} />
          <DeviceItem name="iPhone12,5" os="iOS 18.5" build="1.0 (9)" ip="172.18.0.5" created="2 сентября 2025" active="02.09.2025, 09:45" deviceId="681c1062-f23e-4f06-ac4b-6e18593754e5" revoked={true} />
          <DeviceItem name="Неизвестное устройство" os="—" build="—" ip="172.18.0.5" created="2 сентября 2025" active="02.09.2025, 09:45" deviceId="my-device-123" revoked={true} />
        </div>
      </SectionCard>
    </div>
  );
}

// ========= Главная страница кабинета =========
function AccountSiteMock() {
  const [section, setSection] = useState("profile");
  const [isAuthed, setIsAuthed] = useState(true);

  const [accountEmail] = useState("meatar@icloud.com");
  const [userId] = useState("user_123");

  const [devices] = useState([
    { name: "Неизвестное устройство", os: "—", build: "—", ip: "172.18.0.5", created: "4 сентября 2025", active: "04.09.2025, 15:47", deviceId: "api", revoked: false },
    { name: "Неизвестное устройство", os: "—", build: "—", ip: "172.18.0.5", created: "3 сентября 2025", active: "03.09.2025, 16:31", deviceId: "my_phone_01", revoked: true },
    { name: "iPhone12,5", os: "iOS 18.5", build: "1.0 (9)", ip: "172.18.0.5", created: "2 сентября 2025", active: "02.09.2025, 09:45", deviceId: "681c1062-f23e-4f06-ac4b-6e18593754e5", revoked: true },
    { name: "Неизвестное устройство", os: "—", build: "—", ip: "172.18.0.5", created: "2 сентября 2025", active: "02.09.2025, 09:45", deviceId: "my-device-123", revoked: true },
  ]);

  const [currentPremiumDeviceId, setCurrentPremiumDeviceId] = useState("681c1062-f23e-4f06-ac4b-6e18593754e5");
  const [currentPremiumDeviceName, setCurrentPremiumDeviceName] = useState("iPhone12,5");

  const [transferOpen, setTransferOpen] = useState(false);

  const { ready: payReady, error: payError, openPayForm } = useTinkoffScript();

  const [selectedPeriod, setSelectedPeriod] = useState("1m");
  const amountRub = periodAmountRub(selectedPeriod);

  const handleLogout = () => {
    setIsAuthed(false);
    window.location.href = "/auth.html";
  };

  const handleConfirmTransfer = (device) => {
    setCurrentPremiumDeviceId(device.deviceId);
    setCurrentPremiumDeviceName(device.name);
    setTransferOpen(false);
  };

  const handlePay = () => {
    if (!payReady) return;
    const orderId = `sub_${selectedPeriod}_${Date.now()}`;
    try {
      openPayForm({
        terminalkey: TINKOFF_TERMINAL_KEY,
        frame: "true",
        language: "ru",
        amount: gatewayAmountString(amountRub),
        order: orderId,
        description: `GluOne Premium — продление (${PERIODS[selectedPeriod].label})`,
        email: accountEmail,
        customerkey: userId,
      });
    } catch (e) {
      console.error(e);
      alert("Не удалось открыть оплату. Попробуйте ещё раз.");
    }
  };

  useEffect(() => {
    console.assert(periodAmountRub("1m") === 150, "[TEST] 1m should be 150");
    console.assert(periodAmountRub("3m") === 450, "[TEST] 3m should be 450");
    console.assert(periodAmountRub("6m") === 900, "[TEST] 6m should be 900");
    console.assert(periodAmountRub("12m") === 1800, "[TEST] 12m should be 1800");
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <SiteHeader isAuthed={isAuthed} onLogout={handleLogout} />

      <TransferPremiumModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onConfirm={handleConfirmTransfer}
        devices={devices}
        currentDeviceId={currentPremiumDeviceId}
      />

      <main className="mx-auto max-w-7xl px-5 py-6 flex gap-6">
        <Sidebar current={section} onChange={setSection} />

        <div className="flex-1 min-w-0">
          <div className="xl:hidden mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: "profile", label: "Профиль" },
              { key: "subscription", label: "Подписка" },
              { key: "security", label: "Безопасность" },
              { key: "devices", label: "Устройства" },
            ].map((t) => (
              <button key={t.key} onClick={() => setSection(t.key)} className={`rounded-lg px-3 py-2 text-sm border ${section === t.key ? "bg-white border-slate-300" : "bg-slate-100 border-transparent"}`}>{t.label}</button>
            ))}
          </div>
          {section === "profile" && <ProfilePanel />}
          {section === "subscription" && (
            <SubscriptionPanel
              onOpenTransfer={() => setTransferOpen(true)}
              currentDeviceName={currentPremiumDeviceName}
              onPay={handlePay}
              payReady={payReady}
              selectedPeriod={selectedPeriod}
              setSelectedPeriod={setSelectedPeriod}
              amountRub={amountRub}
              email={accountEmail}
            />
          )}
          {section === "security" && <SecurityPanel />}
          {section === "devices" && <DevicesPanel />}

          {payError && <div className="mt-3 text-sm text-rose-600">{payError}</div>}
        </div>
      </main>

      <footer className="mt-8 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-6 text-sm text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <div>© {new Date().getFullYear()} GluOne. Все права защищены.</div>
          <div className="flex items-center gap-4">
            <a className="hover:text-slate-700" href="#">Политика конфиденциальности</a>
            <a className="hover:text-slate-700" href="#">Условия</a>
            <a className="hover:text-slate-700" href="#">Контакты</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AccountSiteMock />);

