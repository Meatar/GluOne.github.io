// cabinet.js
import {
  authMe,
  authRefresh,
  authLogout,
  authDevices,
  authRevokeDevice,
  authDeleteDevice,
  authChangePassword,
  authDeleteAccount,
  authSubscriptions,
  authCreateSubscriptionOrder
} from "./api.js";
import { KEYS, del } from "./storage.js";

const { useState, useEffect } = React;

// ====== Параметры Tinkoff Pay ======
const TINKOFF_SCRIPT_SRC = "https://securepay.tinkoff.ru/html/payForm/js/tinkoff_v2.js";
const TINKOFF_TERMINAL_KEY = "1756472050322DEMO"; // demo key
const AMOUNT_IN_KOPECKS = false;

function formatRub(n) { return new Intl.NumberFormat("ru-RU").format(n); }
function gatewayAmountString(amountRub) {
  const value = AMOUNT_IN_KOPECKS ? amountRub * 100 : amountRub;
  return String(value);
}

// ========= собрать скрытую форму для window.pay (fallback) =========
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
    if (window.pay || window.Tinkoff?.createPayment) {
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
    if (window.Tinkoff?.createPayment) {
      window.Tinkoff.createPayment({ ...params, view: "popup" });
      return;
    }
    if (!window.pay) throw new Error("Виджет оплаты ещё не готов");
    const form = buildTinkoffForm({ ...params, frame: "popup" });
    document.body.appendChild(form);
    try { window.pay(form); }
    finally { document.body.removeChild(form); }
  };

  // маленький self-test сборки формы
  useEffect(() => {
    const f = buildTinkoffForm({ terminalkey: "K", amount: "100", order: "o1" });
    console.assert(f.elements.namedItem("terminalkey").value === "K", "[TEST] terminalkey mismatch");
    console.assert(f.elements.namedItem("amount").value === "100", "[TEST] amount mismatch");
    console.assert(f.elements.namedItem("order").value === "o1", "[TEST] order mismatch");
  }, []);

  return { ready, error, openPayForm };
}

// ========= Хелперы форматирования =========
const maskEmail   = (em) => em && typeof em === "string" ? em : "—";
const ageFrom     = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d)) return null;
  const n = new Date();
  let age = n.getUTCFullYear() - d.getUTCFullYear();
  const m = n.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) age--;
  return age;
};
const fmtDate     = (iso) => { try { return new Date(iso).toLocaleString("ru-RU", { year:"numeric", month:"long", day:"numeric" }); } catch { return iso || "—"; } };
const fmtDateTime = (iso) => { try { return new Date(iso).toLocaleString("ru-RU", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }); } catch { return iso || "—"; } };
const mapGender   = (g) => ({ male:"Мужской", female:"Женский" })[g] || "—";
const mapDia      = (t) => ({ type1:"Тип 1", type2:"Тип 2", gestational:"Гестационный" })[t] || "—";

// ========= UI-компоненты =========
function Chip({ children }) {
  return React.createElement("span", { className: "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-white/60 text-slate-700 border-slate-200" }, children);
}
function RowButton({ icon, children, onClick }) {
  return React.createElement("button", { onClick, className: "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 border border-transparent hover:border-slate-200 transition" },
    React.createElement("span", { className: "text-slate-500" }, icon),
    React.createElement("span", { className: "text-slate-800 font-medium" }, children)
  );
}
function SectionCard({ title, children, footer }) {
  return React.createElement("div", { className: "rounded-2xl border bg-white shadow-sm border-slate-200" },
    title && React.createElement("div", { className: "px-4 py-3 border-b border-slate-200/60 text-sm font-semibold text-slate-800" }, title),
    React.createElement("div", { className: "p-4" }, children),
    footer && React.createElement("div", { className: "px-4 py-3 border-t border-slate-200/60" }, footer)
  );
}
function KeyRow({ label, value }) {
  return React.createElement("div", { className: "flex items-center justify-between py-1.5" },
    React.createElement("div", { className: "text-sm text-slate-500" }, label),
    React.createElement("div", { className: "text-sm font-medium text-slate-800 text-right" }, value)
  );
}
function DangerLink({ children, onClick }) {
  return React.createElement("button", { onClick, className: "w-full text-sm font-medium text-rose-600 hover:text-rose-700 px-2 py-2 rounded-lg text-left" }, children);
}

// ========= Устройства =========
function DeviceItem({ device, onRevoke, onDelete }) {
  const name = device?.model || "Неизвестное устройство";
  const os = device?.os || "—";
  const build = device?.app_build || "—";
  const ip = device?.last_ip || "—";
  const created = device?.created_at ? fmtDate(device.created_at) : "—";
  const active = device?.last_seen_at ? fmtDateTime(device.last_seen_at) : "—";
  const revoked = !!device?.revoked;
  const deviceId = device?.device_id;

  return React.createElement("div", { className: "rounded-xl border border-slate-200 p-4 bg-white" },
    React.createElement("div", { className: "flex items-start justify-between" },
      React.createElement("div", { className: "font-semibold text-slate-800" }, name),
      React.createElement("span", { className: `text-xs px-2 py-0.5 rounded-full border ${revoked ? "text-slate-600 bg-slate-50 border-slate-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}` }, revoked ? "Отозвано" : "Активно")
    ),
    React.createElement("div", { className: "mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm" },
      React.createElement("div", { className: "text-slate-500" }, "OC"), React.createElement("div", { className: "text-slate-800" }, os),
      React.createElement("div", { className: "text-slate-500" }, "Сборка"), React.createElement("div", { className: "text-slate-800" }, build),
      React.createElement("div", { className: "text-slate-500" }, "Активность"), React.createElement("div", { className: "text-slate-800" }, active),
      React.createElement("div", { className: "text-slate-500" }, "Создано"), React.createElement("div", { className: "text-slate-800" }, created),
      React.createElement("div", { className: "text-slate-500" }, "IP"), React.createElement("div", { className: "text-slate-800" }, ip),
      React.createElement("div", { className: "text-slate-500" }, "ID устройства"), React.createElement("div", { className: "text-slate-800 break-all" }, deviceId)
    ),
    React.createElement("div", { className: "mt-3 flex justify-end gap-2" },
      !revoked
        ? React.createElement("button", { className: "rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800", onClick: () => onRevoke(deviceId) }, "Выйти с устройства")
        : React.createElement("button", { className: "rounded-lg bg-rose-600 text-white px-3 py-1.5 text-sm hover:bg-rose-700", onClick: () => onDelete(deviceId) }, "Удалить")
    )
  );
}

// ========= Модалка выбора устройства для оплаты =========
function TransferPremiumModal({ open, onClose, onConfirm, devices, currentDeviceId }) {
  const [selected, setSelected] = useState(currentDeviceId || null);
  useEffect(() => { if (open) setSelected(currentDeviceId || null); }, [open, currentDeviceId]);
  if (!open) return null;

  const eligible = devices.filter((d) => !d.revoked);
  return React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center" },
    React.createElement("div", { className: "absolute inset-0 bg-slate-900/40", onClick: onClose }),
    React.createElement("div", { className: "relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4" },
      React.createElement("div", { className: "text-base font-semibold text-slate-900" }, "Выбрать устройство для оплаты"),
      React.createElement("p", { className: "mt-1 text-sm text-slate-600" }, "Выберите устройство из списка."),
      React.createElement("div", { className: "mt-4 space-y-2 max-h-72 overflow-auto" },
        eligible.length === 0 && React.createElement("div", { className: "text-sm text-slate-500" }, "Нет доступных устройств."),
        eligible.map((d) =>
          React.createElement("label", { key: d.deviceId, className: "flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer" },
            React.createElement("input", {
              type: "radio",
              name: "transfer-device",
              className: "mt-1",
              checked: selected === d.deviceId,
              onChange: () => setSelected(d.deviceId)
            }),
            React.createElement("div", { className: "flex-1" },
              React.createElement("div", { className: "font-medium text-slate-800" }, d.name),
              React.createElement("div", { className: "text-xs text-slate-500" }, `${d.os || "—"} • ${d.ip} • ${d.active}`)
            )
          )
        )
      ),
      React.createElement("div", { className: "mt-4 flex justify-end gap-2" },
        React.createElement("button", { className: "rounded-lg border border-slate-200 px-3 py-1.5 text-sm", onClick: onClose }, "Отмена"),
        React.createElement("button", {
          disabled: !selected,
          className: `rounded-lg px-3 py-1.5 text-sm text-white ${selected ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"}`,
          onClick: () => {
            const d = eligible.find((x) => x.deviceId === selected);
            if (d) onConfirm(d);
          }
        }, "Выбрать")
      )
    )
  );
}

// ========= Хедер/сайдбар =========
function UserMenu({ isAuthed, userName = "", onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = userName?.[0]?.toUpperCase() || "U";
  const handleClick = () => {
    if (!isAuthed) { window.location.href = "https://gluone.ru/auth.html"; return; }
    setOpen((v) => !v);
  };
  return React.createElement("div", { className: "relative" },
    React.createElement("button", {
      onClick: handleClick,
      "aria-haspopup": isAuthed ? "menu" : void 0,
      "aria-expanded": open,
      className: `flex items-center justify-center rounded-full h-9 ${isAuthed ? "w-9 bg-slate-100 text-slate-800 hover:bg-slate-200" : "px-3 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-full"} border border-slate-200 text-sm font-medium`,
      title: isAuthed ? "Аккаунт" : "Войти"
    }, isAuthed ? React.createElement("span", { className: "font-semibold" }, initial) : React.createElement("span", null, "Войти")),
    isAuthed && open && React.createElement("div", { role: "menu", className: "absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1" },
      React.createElement("div", { className: "px-3 py-2 text-xs text-slate-500" }, userName),
      React.createElement("button", { onClick: () => { setOpen(false); onLogout(); }, className: "w-full text-left px-3 py-2 text-sm hover:bg-slate-50" }, "Выйти")
    )
  );
}
function SiteHeader({ isAuthed, onLogout, userName }) {
  return React.createElement("header", { className: "sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur" },
    React.createElement("div", { className: "mx-auto max-w-screen-2xl px-5 h-14 flex items-center justify-between" },
      React.createElement("div", { className: "flex items-center gap-3" },
        React.createElement("img", { src: "assets/image/logo.png", className: "h-9 w-9 rounded-xl", alt: "GluOne logo", width: "36", height: "36" }),
        React.createElement("span", { className: "font-semibold text-slate-900" }, "GluOne")
      ),
      React.createElement("nav", { className: "hidden md:flex items-center gap-6 text-sm text-slate-600" },
        React.createElement("a", { className: "hover:text-slate-900", href: "https://gluone.ru" }, "Главная"),
        React.createElement("a", { className: "hover:text-slate-900", href: "#" }, "Поддержка")
      ),
      React.createElement("div", { className: "flex items-center gap-3" },
        React.createElement(UserMenu, { isAuthed, userName, onLogout })
      )
    )
  );
}
function Sidebar({ current, onChange }) {
  const Item = ({ k, label, icon }) => React.createElement("button", {
    onClick: () => onChange(k),
    className: `w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${current === k ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"}`
  }, React.createElement("span", { className: "text-base" }, icon), React.createElement("span", { className: "font-medium" }, label));
  return React.createElement("aside", { className: "hidden xl:block w-64 shrink-0" },
    React.createElement("div", { className: "sticky top-16 space-y-1" },
      React.createElement(Item, { k: "profile", label: "Профиль", icon: "👤" }),
      React.createElement(Item, { k: "subscription", label: "Подписка", icon: "💎" }),
      React.createElement(Item, { k: "security", label: "Безопасность", icon: "🔐" }),
      React.createElement(Item, { k: "devices", label: "Устройства", icon: "📱" })
    )
  );
}

// ========= Панели =========
function ProfilePanel({ profile }) {
  if (!profile) {
    return React.createElement("div", { className: "space-y-4 max-w-6xl" },
      React.createElement(SectionCard, null, React.createElement("div", { className: "text-sm text-slate-600" }, "Загружаем профиль…"))
    );
  }
  const initial = (profile.username || profile.email || "U").trim()[0].toUpperCase();
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  return React.createElement("div", { className: "space-y-4 max-w-6xl" },
    React.createElement(SectionCard, null,
      React.createElement("div", { className: "flex items-center gap-3" },
        React.createElement("div", { className: "h-12 w-12 shrink-0 rounded-xl bg-indigo-100 text-indigo-600 font-semibold flex items-center justify-center" }, initial),
        React.createElement("div", { className: "flex-1" },
          React.createElement("div", { className: "flex items-center gap-2 flex-wrap" },
            React.createElement("div", { className: "font-semibold text-slate-900" }, profile.username || "Без имени"),
            profile.is_premium && React.createElement(Chip, null, "Premium")
          ),
          React.createElement("div", { className: "text-sm text-slate-500" }, profile.email ? maskEmail(profile.email) : "—")
        )
      ),
      React.createElement("div", { className: "mt-4" },
        React.createElement(KeyRow, { label: "Статус", value: React.createElement("span", { className: profile.is_active ? "text-emerald-700" : "text-rose-600" }, profile.is_active ? "Активен" : "Неактивен") }),
        React.createElement("div", { className: "flex items-center justify-between py-1.5" },
          React.createElement("div", { className: "text-sm text-slate-500" }, "Роли"),
          React.createElement("div", { className: "flex gap-1" }, roles.map((r) => React.createElement(Chip, { key: r }, r)))
        ),
        React.createElement(KeyRow, { label: "Пол", value: mapGender(profile.gender) }),
        React.createElement(KeyRow, { label: "Дата рождения", value: profile.birth_date ? `${fmtDate(profile.birth_date)}${ageFrom(profile.birth_date) ? ` • ${ageFrom(profile.birth_date)} лет` : ""}` : "—" }),
        React.createElement(KeyRow, { label: "Тип диабета", value: mapDia(profile.diabetes_type) })
      )
    )
  );
}
function SubscriptionPanel({ onOpenTransfer, currentDeviceName, onPay, payReady, plans, selectedPlanId, setSelectedPlanId, amountRub, monthPrice, email, currentDeviceId }) {
  return React.createElement("div", { className: "max-w-6xl" },
    React.createElement(SectionCard, { title: "Подписка Premium" },
      React.createElement("div", { className: "space-y-2 text-sm" },
        React.createElement("div", { className: "flex items-center justify-between" },
          React.createElement("span", { className: "text-slate-500" }, "Статус"),
          React.createElement("span", { className: "font-medium text-emerald-700" }, "Активна")
        ),
        React.createElement("div", { className: "flex items-center justify-between" },
          React.createElement("span", { className: "text-slate-500" }, "Устройство"),
          React.createElement("span", { className: "font-medium" }, currentDeviceName)
        )
      ),
      React.createElement("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end" },
        React.createElement("div", { className: "flex flex-col gap-1" },
          React.createElement("label", { className: "text-sm text-slate-600" }, "Период оплаты"),
          React.createElement("select", {
            value: selectedPlanId,
            onChange: (e) => setSelectedPlanId(e.target.value),
            className: "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
          }, plans.map((p) => React.createElement("option", { key: p.id, value: p.id }, `${p.duration_months} мес. — ${formatRub(p.price)} ₽`)))
        ),
        React.createElement("div", { className: "text-right" },
          React.createElement("div", { className: "text-xs text-slate-500" }, "Итого к оплате"),
          React.createElement("div", { className: "text-lg font-semibold text-slate-900" }, formatRub(amountRub), " ₽"),
          selectedPlanId && React.createElement("div", { className: "text-xs text-slate-500" }, `${formatRub(monthPrice)} ₽/мес × ${plans.find((p) => p.id === selectedPlanId)?.duration_months}`)
        )
      ),
      React.createElement("div", { className: "mt-3 flex flex-col gap-1" },
        React.createElement("label", { className: "text-sm text-slate-600" }, "E-mail плательщика"),
        React.createElement("input", { value: email, readOnly: true, className: "rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-700" })
      ),
      React.createElement("div", { className: "mt-4 flex gap-3" },
        React.createElement("button", { disabled: !payReady || !selectedPlanId || !currentDeviceId, onClick: onPay, className: `rounded-xl px-4 py-2 font-medium text-white ${payReady ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"}` }, "Продлить"),
        React.createElement("button", { onClick: onOpenTransfer, className: "rounded-xl border border-slate-200 px-4 py-2 font-medium" }, "Сменить устройство")
      ),
      !payReady && React.createElement("div", { className: "mt-2 text-xs text-slate-500" }, "Загружаем виджет оплаты…")
    )
  );
}
function SecurityPanel({ username, onChangePassword, onDeleteAccount }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!oldPass || !newPass) { setMsg("Заполните оба поля."); return; }
    setLoading(true);
    try {
      const res = await onChangePassword(oldPass, newPass);
      setMsg(res.msg);
      if (res.ok) { setOldPass(""); setNewPass(""); }
    } finally { setLoading(false); }
  };

  return React.createElement("div", { className: "max-w-6xl space-y-4" },
    React.createElement(SectionCard, { title: "Смена пароля" },
      React.createElement("form", { className: "space-y-3", onSubmit: handleSubmit },
        React.createElement("p", { className: "text-sm text-slate-600" }, "Рекомендуем менять пароль раз в 6–12 месяцев."),
        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
          React.createElement("div", { className: "flex flex-col gap-1" },
            React.createElement("label", { className: "text-sm text-slate-600" }, "Текущий пароль"),
            React.createElement("input", { type: "password", autoComplete: "current-password", value: oldPass, onChange: (e) => setOldPass(e.target.value), placeholder: "Введите текущий пароль", className: "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" })
          ),
          React.createElement("div", { className: "flex flex-col gap-1" },
            React.createElement("label", { className: "text-sm text-slate-600" }, "Новый пароль"),
            React.createElement("input", { type: "password", autoComplete: "new-password", value: newPass, onChange: (e) => setNewPass(e.target.value), placeholder: "Введите новый пароль", className: "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" })
          )
        ),
        msg && React.createElement("div", { className: "text-sm text-slate-600" }, msg),
        React.createElement("div", { className: "flex items-center justify-end" },
          React.createElement("button", { disabled: loading, className: "rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800" }, loading ? "Обновляем…" : "Обновить")
        )
      )
    ),
    React.createElement(SectionCard, null,
      React.createElement(DangerLink, { onClick: onDeleteAccount }, "Удалить аккаунт")
    )
  );
}
function DevicesPanel({ devices, onRevoke, onDelete }) {
  return React.createElement("div", { className: "space-y-4" },
    React.createElement(SectionCard, { title: "Устройства", footer: React.createElement("div", { className: "text-sm text-slate-500" }, "Всего устройств: ", devices.length) },
      React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
        devices.map((dev) => React.createElement(DeviceItem, { key: dev.device_id, device: dev, onRevoke, onDelete }))
      )
    )
  );
}

// ========= Приложение =========
function AccountApp() {
  const [section, setSection] = useState("profile");
  const [isAuthed, setIsAuthed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [currentPremiumDeviceId, setCurrentPremiumDeviceId] = useState(null);
  const [currentPremiumDeviceName, setCurrentPremiumDeviceName] = useState("—");

  // первичная загрузка: сначала refresh → потом me
  useEffect(() => {
    (async () => {
      await authRefresh().catch(()=>{});
      let me = await authMe();
      if (!me.ok && me.status === 401) {
        // единоразовый короткий ретрай, если access ещё не «встал»
        await new Promise(r => setTimeout(r, 200));
        me = await authMe();
      }

      if (me.ok) {
        setProfile(me.data);
        setIsAuthed(true);
      } else {
        setIsAuthed(false);
        if (me.status === 401 || me.status === 404) {
          window.location.href = "/auth.html?next=%2Fcabinet.html";
          return;
        }
      }

      const dev = await authDevices();
      if (dev.ok) setDevices(dev.data || []);

      const subs = await authSubscriptions();
      if (subs.ok && Array.isArray(subs.data)) {
        setPlans(subs.data);
        if (subs.data.length) setSelectedPlanId(subs.data[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!devices.length) {
      setCurrentPremiumDeviceId(null);
      setCurrentPremiumDeviceName("Нет устройств");
      return;
    }
    const last = devices.slice().sort((a, b) => new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0))[0];
    if (last) {
      setCurrentPremiumDeviceId(last.device_id);
      setCurrentPremiumDeviceName(last.model || "Неизвестное устройство");
    }
  }, [devices]);

  const reloadDevices = async () => {
    const dev = await authDevices();
    if (dev.ok) setDevices(dev.data || []);
  };

  const handleRevokeDevice = async (id) => {
    const confirmExit = confirm("Выйти с устройства?");
    if (!confirmExit) return;
    await authRevokeDevice(id);
    await reloadDevices();
  };

  const handleDeleteDevice = async (id) => {
    const confirmDel = confirm("Удалить запись об устройстве?");
    if (!confirmDel) return;
    await authDeleteDevice(id);
    await reloadDevices();
  };

  const handleLogout = async () => {
    try { await authLogout(); } catch {}
    try { del(KEYS.STATE); del(KEYS.CHALLENGE); del(KEYS.RESEND_UNTIL); del(KEYS.TOKEN); } catch {}
    window.location.href = "/auth.html";
  };

  const handleChangePassword = async (oldPwd, newPwd) => {
    const username = profile?.username || profile?.email;
    try {
      const res = await authChangePassword(username, oldPwd, newPwd);
      if (res.status === 204) return { ok: true, msg: "Пароль успешно изменён." };
      if (res.status === 401) return { ok: false, msg: "Неверные учётные данные." };
      if (res.status === 403) return { ok: false, msg: "Пользователь неактивен." };
      if (res.status === 422) {
        const msg = Array.isArray(res.data?.detail) ? res.data.detail.map((e) => e?.msg).filter(Boolean).join("; ") : "Проверьте корректность полей.";
        return { ok: false, msg };
      }
      if (res.status === 429) return { ok: false, msg: "Слишком много попыток. Попробуйте позже." };
      return { ok: false, msg: `Ошибка: ${res.status}` };
    } catch (err) {
      console.error("change-password error", err);
      return { ok: false, msg: "Ошибка сети. Повторите попытку." };
    }
  };

  const handleDeleteAccount = async () => {
    const username = prompt("Логин");
    const password = prompt("Пароль");
    if (!username || !password) return;
    try {
      const res = await authDeleteAccount(username, password);
      if (res.status === 204) {
        try { del(KEYS.STATE); del(KEYS.CHALLENGE); del(KEYS.RESEND_UNTIL); del(KEYS.TOKEN); } catch {}
        window.location.href = "/";
      } else {
        alert(`Ошибка: ${res.status}`);
      }
    } catch (err) {
      alert("Ошибка сети. Повторите попытку.");
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const amountRub = selectedPlan ? selectedPlan.price : 0;
  const monthPrice = selectedPlan ? Math.round(selectedPlan.price / selectedPlan.duration_months) : 0;
  const accountEmail = profile?.email || "";

  const { ready: payReady, error: payError, openPayForm } = useTinkoffScript();

  const handlePay = async () => {
    if (!selectedPlan || !payReady || !currentPremiumDeviceId) {
      alert(devices.length ? "Не выбрано устройство для подписки." : "У вас нет устройств. Добавьте устройство для оплаты.");
      return;
    }
    const userId = profile?.user_id;
    if (!userId) { alert("Не удалось определить пользователя."); return; }

    try {
      const order = await authCreateSubscriptionOrder(userId, currentPremiumDeviceId, selectedPlan.id);
      const orderId = order?.data?.order_id;
      if (!order.ok || !orderId) {
        alert("Не удалось создать заказ. Попробуйте ещё раз.");
        return;
      }
      openPayForm({
        terminalkey: TINKOFF_TERMINAL_KEY,
        language: "ru",
        amount: gatewayAmountString(amountRub),
        order: orderId,
        description: selectedPlan.sku,
        email: accountEmail
      });
    } catch (e) {
      console.error(e);
      alert("Не удалось открыть оплату. Попробуйте ещё раз.");
    }
  };

  const handleConfirmTransfer = (device) => {
    setCurrentPremiumDeviceId(device.deviceId);
    setCurrentPremiumDeviceName(device.name);
    setTransferOpen(false);
  };

  return React.createElement("div", { className: "min-h-screen w-full bg-slate-50 flex flex-col" },
    React.createElement(SiteHeader, { isAuthed, onLogout: handleLogout, userName: profile?.username || profile?.email }),

    React.createElement(TransferPremiumModal, {
      open: transferOpen,
      onClose: () => setTransferOpen(false),
      onConfirm: handleConfirmTransfer,
      devices: devices.map((d) => ({ name: d.model || "Неизвестное устройство", os: d.os, ip: d.last_ip, active: fmtDateTime(d.last_seen_at), deviceId: d.device_id, revoked: d.revoked })),
      currentDeviceId: currentPremiumDeviceId
    }),

    React.createElement("main", { className: "flex-1 mx-auto max-w-screen-2xl px-5 py-6 flex gap-6" },
      React.createElement(Sidebar, { current: section, onChange: setSection }),
      React.createElement("div", { className: "flex-1 min-w-0" },
        React.createElement("div", { className: "xl:hidden mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2" },
          [
            { key: "profile", label: "Профиль" },
            { key: "subscription", label: "Подписка" },
            { key: "security", label: "Безопасность" },
            { key: "devices", label: "Устройства" }
          ].map((t) =>
            React.createElement("button", {
              key: t.key, onClick: () => setSection(t.key),
              className: `rounded-lg px-3 py-2 text-sm border ${section === t.key ? "bg-white border-slate-300" : "bg-slate-100 border-transparent"}`
            }, t.label)
          )
        ),
        section === "profile" && React.createElement(ProfilePanel, { profile }),
        section === "subscription" && React.createElement(SubscriptionPanel, {
          onOpenTransfer: () => setTransferOpen(true),
          currentDeviceName: currentPremiumDeviceName,
          onPay: handlePay,
          payReady,
          plans,
          selectedPlanId,
          setSelectedPlanId,
          amountRub,
          monthPrice,
          email: accountEmail,
          currentDeviceId: currentPremiumDeviceId
        }),
        section === "security" && React.createElement(SecurityPanel, { username: profile?.username || profile?.email, onChangePassword: handleChangePassword, onDeleteAccount: handleDeleteAccount }),
        section === "devices" && React.createElement(DevicesPanel, { devices, onRevoke: handleRevokeDevice, onDelete: handleDeleteDevice }),
        payError && React.createElement("div", { className: "mt-3 text-sm text-rose-600" }, payError)
      )
    ),

    React.createElement("footer", { className: "mt-auto border-t border-slate-200 bg-white" },
      React.createElement("div", { className: "mx-auto max-w-screen-2xl px-5 py-6 text-sm text-slate-500 flex flex-wrap items-center justify-between gap-3" },
        React.createElement("div", null, "© ", (new Date()).getFullYear(), " GluOne. Все права защищены."),
        React.createElement("div", { className: "flex items-center gap-4" },
          React.createElement("a", { className: "hover:text-slate-700", href: "#" }, "Политика конфиденциальности"),
          React.createElement("a", { className: "hover:text-slate-700", href: "#" }, "Условия"),
          React.createElement("a", { className: "hover:text-slate-700", href: "#" }, "Контакты")
        )
      )
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(AccountApp, null));
