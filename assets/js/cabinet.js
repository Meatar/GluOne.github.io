import { authMe, authLogout, authDevices, authRevokeDevice, authDeleteDevice, authChangePassword, authDeleteAccount, authSubscriptions, authCreateSubscriptionOrder } from "./api.js";
import { KEYS, load, del } from "./storage.js";
const { useState, useEffect } = React;
const TINKOFF_SCRIPT_SRC = "https://securepay.tinkoff.ru/html/payForm/js/tinkoff_v2.js";
const TINKOFF_TERMINAL_KEY = "1756472050322DEMO";
const AMOUNT_IN_KOPECKS = false;
function formatRub(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}
function gatewayAmountString(amountRub) {
  const value = AMOUNT_IN_KOPECKS ? amountRub * 100 : amountRub;
  return String(value);
}
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
      const onErr = () => setError("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0432\u0438\u0434\u0436\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B.");
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
    s.onerror = () => setError("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0432\u0438\u0434\u0436\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B.");
    document.head.appendChild(s);
  }, []);
  const openPayForm = (params) => {
    if (!window.pay)
      throw new Error("\u0412\u0438\u0434\u0436\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B \u0435\u0449\u0451 \u043D\u0435 \u0433\u043E\u0442\u043E\u0432");
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
const maskEmail = (em) => em && typeof em === "string" ? em : "\u2014";
const ageFrom = (dateStr) => {
  if (!dateStr)
    return null;
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00Z");
  if (isNaN(d))
    return null;
  const n = /* @__PURE__ */ new Date();
  let age = n.getUTCFullYear() - d.getUTCFullYear();
  const m = n.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || m === 0 && n.getUTCDate() < d.getUTCDate())
    age--;
  return age;
};
const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso || "\u2014";
  }
};
const fmtDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso || "\u2014";
  }
};
const mapGender = (g) => ({ male: "\u041C\u0443\u0436\u0441\u043A\u043E\u0439", female: "\u0416\u0435\u043D\u0441\u043A\u0438\u0439" })[g] || "\u2014";
const mapDia = (t) => ({ type1: "\u0422\u0438\u043F 1", type2: "\u0422\u0438\u043F 2", gestational: "\u0413\u0435\u0441\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0439" })[t] || "\u2014";
function Chip({ children }) {
  return /* @__PURE__ */ React.createElement("span", { className: "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-white/60 text-slate-700 border-slate-200" }, children);
}
function RowButton({ icon, children, onClick }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, className: "w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50 border border-transparent hover:border-slate-200 transition" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, icon), /* @__PURE__ */ React.createElement("span", { className: "text-slate-800 font-medium" }, children));
}
function SectionCard({ title, children, footer }) {
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-2xl border bg-white shadow-sm border-slate-200" }, title && /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border-b border-slate-200/60 text-sm font-semibold text-slate-800" }, title), /* @__PURE__ */ React.createElement("div", { className: "p-4" }, children), footer && /* @__PURE__ */ React.createElement("div", { className: "px-4 py-3 border-t border-slate-200/60" }, footer));
}
function KeyRow({ label, value }) {
  return /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between py-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-500" }, label), /* @__PURE__ */ React.createElement("div", { className: "text-sm font-medium text-slate-800 text-right" }, value));
}
function DangerLink({ children, onClick }) {
  return /* @__PURE__ */ React.createElement("button", { onClick, className: "w-full text-sm font-medium text-rose-600 hover:text-rose-700 px-2 py-2 rounded-lg text-left" }, children);
}
function DeviceItem({ device, onRevoke, onDelete }) {
  const name = device?.model || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E";
  const os = device?.os || "\u2014";
  const build = device?.app_build || "\u2014";
  const ip = device?.last_ip || "\u2014";
  const created = device?.created_at ? fmtDate(device.created_at) : "\u2014";
  const active = device?.last_seen_at ? fmtDateTime(device.last_seen_at) : "\u2014";
  const revoked = !!device?.revoked;
  const deviceId = device?.device_id;
  return /* @__PURE__ */ React.createElement("div", { className: "rounded-xl border border-slate-200 p-4 bg-white" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-start justify-between" }, /* @__PURE__ */ React.createElement("div", { className: "font-semibold text-slate-800" }, name), /* @__PURE__ */ React.createElement("span", { className: `text-xs px-2 py-0.5 rounded-full border ${revoked ? "text-slate-600 bg-slate-50 border-slate-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}` }, revoked ? "\u041E\u0442\u043E\u0437\u0432\u0430\u043D\u043E" : "\u0410\u043A\u0442\u0438\u0432\u043D\u043E")), /* @__PURE__ */ React.createElement("div", { className: "mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm" }, /* @__PURE__ */ React.createElement("div", { className: "text-slate-500" }, "OC"), /* @__PURE__ */ React.createElement("div", { className: "text-slate-800" }, os), /* @__PURE__ */ React.createElement("div", { className: "text-slate-500" }, "\u0421\u0431\u043E\u0440\u043A\u0430"), /* @__PURE__ */ React.createElement("div", { className: "text-slate-800" }, build), /* @__PURE__ */ React.createElement("div", { className: "text-slate-500" }, "\u0410\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C"), /* @__PURE__ */ React.createElement("div", { className: "text-slate-800" }, active), /* @__PURE__ */ React.createElement("div", { className: "text-slate-500" }, "\u0421\u043E\u0437\u0434\u0430\u043D\u043E"), /* @__PURE__ */ React.createElement("div", { className: "text-slate-800" }, created), /* @__PURE__ */ React.createElement("div", { className: "text-slate-500" }, "IP"), /* @__PURE__ */ React.createElement("div", { className: "text-slate-800" }, ip), /* @__PURE__ */ React.createElement("div", { className: "text-slate-500" }, "ID \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430"), /* @__PURE__ */ React.createElement("div", { className: "text-slate-800 break-all" }, deviceId)), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex justify-end gap-2" }, !revoked ? /* @__PURE__ */ React.createElement("button", { className: "rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800", onClick: () => onRevoke(deviceId) }, "\u0412\u044B\u0439\u0442\u0438 \u0441 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430") : /* @__PURE__ */ React.createElement("button", { className: "rounded-lg bg-rose-600 text-white px-3 py-1.5 text-sm hover:bg-rose-700", onClick: () => onDelete(deviceId) }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C")));
}
function TransferPremiumModal({ open, onClose, onConfirm, devices, currentDeviceId }) {
  const [selected, setSelected] = useState(null);
  if (!open)
    return null;
  const eligible = devices.filter((d) => !d.revoked && d.deviceId !== currentDeviceId);
  return /* @__PURE__ */ React.createElement("div", { className: "fixed inset-0 z-50 flex items-center justify-center" }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-slate-900/40", onClick: onClose }), /* @__PURE__ */ React.createElement("div", { className: "relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4" }, /* @__PURE__ */ React.createElement("div", { className: "text-base font-semibold text-slate-900" }, "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 Premium \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E"), /* @__PURE__ */ React.createElement("p", { className: "mt-1 text-sm text-slate-600" }, "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E. \u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u043E \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430."), /* @__PURE__ */ React.createElement("div", { className: "mt-4 space-y-2 max-h-72 overflow-auto" }, eligible.length === 0 && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-500" }, "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432 \u0434\u043B\u044F \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430."), eligible.map((d) => /* @__PURE__ */ React.createElement("label", { key: d.deviceId, className: "flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer" }, /* @__PURE__ */ React.createElement("input", { type: "radio", name: "transfer-device", className: "mt-1", checked: selected === d.deviceId, onChange: () => setSelected(d.deviceId) }), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "font-medium text-slate-800" }, d.name), /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-500" }, d.os || "\u2014", " \u2022 ", d.ip, " \u2022 ", d.active))))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex justify-end gap-2" }, /* @__PURE__ */ React.createElement("button", { className: "rounded-lg border border-slate-200 px-3 py-1.5 text-sm", onClick: onClose }, "\u041E\u0442\u043C\u0435\u043D\u0430"), /* @__PURE__ */ React.createElement("button", { disabled: !selected, className: `rounded-lg px-3 py-1.5 text-sm text-white ${selected ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"}`, onClick: () => {
    const d = eligible.find((x) => x.deviceId === selected);
    if (d)
      onConfirm(d);
  } }, "\u041F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438"))));
}
function UserMenu({ isAuthed, userName = "", onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = userName?.[0]?.toUpperCase() || "U";
  const handleClick = () => {
    if (!isAuthed) {
      window.location.href = "https://gluone.ru/auth.html";
      return;
    }
    setOpen((v) => !v);
  };
  return /* @__PURE__ */ React.createElement("div", { className: "relative" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: handleClick,
      "aria-haspopup": isAuthed ? "menu" : void 0,
      "aria-expanded": open,
      className: `flex items-center justify-center rounded-full h-9 ${isAuthed ? "w-9 bg-slate-100 text-slate-800 hover:bg-slate-200" : "px-3 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-full"} border border-slate-200 text-sm font-medium`,
      title: isAuthed ? "\u0410\u043A\u043A\u0430\u0443\u043D\u0442" : "\u0412\u043E\u0439\u0442\u0438"
    },
    isAuthed ? /* @__PURE__ */ React.createElement("span", { className: "font-semibold" }, initial) : /* @__PURE__ */ React.createElement("span", null, "\u0412\u043E\u0439\u0442\u0438")
  ), isAuthed && open && /* @__PURE__ */ React.createElement("div", { role: "menu", className: "absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1" }, /* @__PURE__ */ React.createElement("div", { className: "px-3 py-2 text-xs text-slate-500" }, userName), /* @__PURE__ */ React.createElement("button", { onClick: () => {
    setOpen(false);
    onLogout();
  }, className: "w-full text-left px-3 py-2 text-sm hover:bg-slate-50" }, "\u0412\u044B\u0439\u0442\u0438")));
}
function SiteHeader({ isAuthed, onLogout, userName }) {
  return /* @__PURE__ */ React.createElement(
    "header",
    { className: "sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur" },
    /* @__PURE__ */ React.createElement(
      "div",
      { className: "mx-auto max-w-screen-2xl px-5 h-14 flex items-center justify-between" },
      /* @__PURE__ */ React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        /* @__PURE__ */ React.createElement("img", {
          src: "assets/image/logo.png",
          className: "h-9 w-9 rounded-xl",
          alt: "GluOne logo",
          width: "36",
          height: "36"
        }),
        /* @__PURE__ */ React.createElement(
          "span",
          { className: "font-semibold text-slate-900" },
          "GluOne"
        )
      ),
      /* @__PURE__ */ React.createElement(
        "nav",
        { className: "hidden md:flex items-center gap-6 text-sm text-slate-600" },
        /* @__PURE__ */ React.createElement("a", { className: "hover:text-slate-900", href: "https://gluone.ru" }, "\u0413\u043B\u0430\u0432\u043D\u0430\u044F"),
        /* @__PURE__ */ React.createElement("a", { className: "hover:text-slate-900", href: "#" }, "\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430")
      ),
      /* @__PURE__ */ React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        /* @__PURE__ */ React.createElement(UserMenu, { isAuthed, userName, onLogout })
      )
    )
  );
}
function Sidebar({ current, onChange }) {
  const Item = ({ k, label, icon }) => /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => onChange(k),
      className: `w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${current === k ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"}`
    },
    /* @__PURE__ */ React.createElement("span", { className: "text-base" }, icon),
    /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, label)
  );
  return /* @__PURE__ */ React.createElement("aside", { className: "hidden xl:block w-64 shrink-0" }, /* @__PURE__ */ React.createElement("div", { className: "sticky top-16 space-y-1" }, /* @__PURE__ */ React.createElement(Item, { k: "profile", label: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", icon: "\u{1F464}" }), /* @__PURE__ */ React.createElement(Item, { k: "subscription", label: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430", icon: "\u{1F48E}" }), /* @__PURE__ */ React.createElement(Item, { k: "security", label: "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C", icon: "\u{1F510}" }), /* @__PURE__ */ React.createElement(Item, { k: "devices", label: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430", icon: "\u{1F4F1}" })));
}
function ProfilePanel({ profile }) {
  if (!profile) {
    return /* @__PURE__ */ React.createElement("div", { className: "space-y-4 max-w-6xl" }, /* @__PURE__ */ React.createElement(SectionCard, null, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-600" }, "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u043E\u0444\u0438\u043B\u044C\u2026")));
  }
  const initial = (profile.username || profile.email || "U").trim()[0].toUpperCase();
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-4 max-w-6xl" }, /* @__PURE__ */ React.createElement(SectionCard, null, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "h-12 w-12 shrink-0 rounded-xl bg-indigo-100 text-indigo-600 font-semibold flex items-center justify-center" }, initial), /* @__PURE__ */ React.createElement("div", { className: "flex-1" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-2 flex-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "font-semibold text-slate-900" }, profile.username || "\u0411\u0435\u0437 \u0438\u043C\u0435\u043D\u0438"), profile.is_premium && /* @__PURE__ */ React.createElement(Chip, null, "Premium")), /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-500" }, profile.email ? maskEmail(profile.email) : "\u2014"))), /* @__PURE__ */ React.createElement("div", { className: "mt-4" }, /* @__PURE__ */ React.createElement(KeyRow, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: /* @__PURE__ */ React.createElement("span", { className: profile.is_active ? "text-emerald-700" : "text-rose-600" }, profile.is_active ? "\u0410\u043A\u0442\u0438\u0432\u0435\u043D" : "\u041D\u0435\u0430\u043A\u0442\u0438\u0432\u0435\u043D") }), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between py-1.5" }, /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-500" }, "\u0420\u043E\u043B\u0438"), /* @__PURE__ */ React.createElement("div", { className: "flex gap-1" }, roles.map((r) => /* @__PURE__ */ React.createElement(Chip, { key: r }, r)))), /* @__PURE__ */ React.createElement(KeyRow, { label: "\u041F\u043E\u043B", value: mapGender(profile.gender) }), /* @__PURE__ */ React.createElement(KeyRow, { label: "\u0414\u0430\u0442\u0430 \u0440\u043E\u0436\u0434\u0435\u043D\u0438\u044F", value: profile.birth_date ? `${fmtDate(profile.birth_date)}${ageFrom(profile.birth_date) ? ` \u2022 ${ageFrom(profile.birth_date)} \u043B\u0435\u0442` : ""}` : "\u2014" }), /* @__PURE__ */ React.createElement(KeyRow, { label: "\u0422\u0438\u043F \u0434\u0438\u0430\u0431\u0435\u0442\u0430", value: mapDia(profile.diabetes_type) }))));
}
function SubscriptionPanel({ onOpenTransfer, currentDeviceName, onPay, payReady, plans, selectedPlanId, setSelectedPlanId, amountRub, monthPrice, email, currentDeviceId }) {
  return /* @__PURE__ */ React.createElement("div", { className: "max-w-6xl" }, /* @__PURE__ */ React.createElement(SectionCard, { title: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 Premium" }, /* @__PURE__ */ React.createElement("div", { className: "space-y-2 text-sm" }, /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, "\u0421\u0442\u0430\u0442\u0443\u0441"), /* @__PURE__ */ React.createElement("span", { className: "font-medium text-emerald-700" }, "\u0410\u043A\u0442\u0438\u0432\u043D\u0430")), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ React.createElement("span", { className: "text-slate-500" }, "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E"), /* @__PURE__ */ React.createElement("span", { className: "font-medium" }, currentDeviceName))), /* @__PURE__ */ React.createElement("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-sm text-slate-600" }, "\u041F\u0435\u0440\u0438\u043E\u0434 \u043E\u043F\u043B\u0430\u0442\u044B"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: selectedPlanId,
      onChange: (e) => setSelectedPlanId(e.target.value),
      className: "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
    },
    plans.map((p) => /* @__PURE__ */ React.createElement("option", { key: p.id, value: p.id }, `${p.duration_months} \u043C\u0435\u0441. \u2014 ${formatRub(p.price)} \u20BD`))
  )), /* @__PURE__ */ React.createElement("div", { className: "text-right" }, /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-500" }, "\u0418\u0442\u043E\u0433\u043E \u043A \u043E\u043F\u043B\u0430\u0442\u0435"), /* @__PURE__ */ React.createElement("div", { className: "text-lg font-semibold text-slate-900" }, formatRub(amountRub), " \u20BD"), selectedPlanId && /* @__PURE__ */ React.createElement("div", { className: "text-xs text-slate-500" }, formatRub(monthPrice), " \u20BD/\u043C\u0435\u0441 \xD7 ", plans.find((p) => p.id === selectedPlanId)?.duration_months))), /* @__PURE__ */ React.createElement("div", { className: "mt-3 flex flex-col gap-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-sm text-slate-600" }, "E\u2011mail \u043F\u043B\u0430\u0442\u0435\u043B\u044C\u0449\u0438\u043A\u0430"), /* @__PURE__ */ React.createElement("input", { value: email, readOnly: true, className: "rounded-lg border border-slate-200 px-3 py-2 text-sm bg-slate-50 text-slate-700" })), /* @__PURE__ */ React.createElement("div", { className: "mt-4 flex gap-3" }, /* @__PURE__ */ React.createElement("button", { disabled: !payReady || !selectedPlanId || !currentDeviceId, onClick: onPay, className: `rounded-xl px-4 py-2 font-medium text-white ${payReady ? "bg-indigo-600 hover:bg-indigo-700" : "bg-slate-400 cursor-not-allowed"}` }, "\u041F\u0440\u043E\u0434\u043B\u0438\u0442\u044C"), /* @__PURE__ */ React.createElement("button", { onClick: onOpenTransfer, className: "rounded-xl border border-slate-200 px-4 py-2 font-medium" }, "\u0421\u043C\u0435\u043D\u0438\u0442\u044C \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E")), !payReady && /* @__PURE__ */ React.createElement("div", { className: "mt-2 text-xs text-slate-500" }, "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0432\u0438\u0434\u0436\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B\u2026")));
}
function SecurityPanel({ username, onChangePassword, onDeleteAccount }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!oldPass || !newPass) {
      setMsg("\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043E\u0431\u0430 \u043F\u043E\u043B\u044F.");
      return;
    }
    setLoading(true);
    try {
      const res = await onChangePassword(oldPass, newPass);
      setMsg(res.msg);
      if (res.ok) {
        setOldPass("");
        setNewPass("");
      }
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { className: "max-w-6xl space-y-4" }, /* @__PURE__ */ React.createElement(SectionCard, { title: "\u0421\u043C\u0435\u043D\u0430 \u043F\u0430\u0440\u043E\u043B\u044F" }, /* @__PURE__ */ React.createElement("form", { className: "space-y-3", onSubmit: handleSubmit }, /* @__PURE__ */ React.createElement("p", { className: "text-sm text-slate-600" }, "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C \u043C\u0435\u043D\u044F\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C \u0440\u0430\u0437 \u0432 6\u201312 \u043C\u0435\u0441\u044F\u0446\u0435\u0432."), /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" }, /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-sm text-slate-600" }, "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C"), /* @__PURE__ */ React.createElement("input", { type: "password", autoComplete: "current-password", value: oldPass, onChange: (e) => setOldPass(e.target.value), placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C", className: "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" })), /* @__PURE__ */ React.createElement("div", { className: "flex flex-col gap-1" }, /* @__PURE__ */ React.createElement("label", { className: "text-sm text-slate-600" }, "\u041D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C"), /* @__PURE__ */ React.createElement("input", { type: "password", autoComplete: "new-password", value: newPass, onChange: (e) => setNewPass(e.target.value), placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C", className: "rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100" }))), msg && /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-600" }, msg), /* @__PURE__ */ React.createElement("div", { className: "flex items-center justify-end" }, /* @__PURE__ */ React.createElement("button", { disabled: loading, className: "rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800" }, loading ? "\u041E\u0431\u043D\u043E\u0432\u043B\u044F\u0435\u043C\u2026" : "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C")))), /* @__PURE__ */ React.createElement(SectionCard, null, /* @__PURE__ */ React.createElement(DangerLink, { onClick: onDeleteAccount }, "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442")));
}
function DevicesPanel({ devices, onRevoke, onDelete }) {
  return /* @__PURE__ */ React.createElement("div", { className: "space-y-4" }, /* @__PURE__ */ React.createElement(SectionCard, { title: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430", footer: /* @__PURE__ */ React.createElement("div", { className: "text-sm text-slate-500" }, "\u0412\u0441\u0435\u0433\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432: ", devices.length) }, /* @__PURE__ */ React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" }, devices.map((dev) => /* @__PURE__ */ React.createElement(DeviceItem, { key: dev.device_id, device: dev, onRevoke, onDelete })))));
}
function AccountApp() {
  const [section, setSection] = useState("profile");
  const [isAuthed, setIsAuthed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [currentPremiumDeviceId, setCurrentPremiumDeviceId] = useState(null);
  const [currentPremiumDeviceName, setCurrentPremiumDeviceName] = useState("\u2014");
  const token = load(KEYS.TOKEN, null);
  const accessToken = token?.access_token;
  useEffect(() => {
    if (!accessToken) {
      window.location.href = "/auth.html?next=%2Fcabinet.html";
      return;
    }
    (async () => {
      const me = await authMe(accessToken);
      if (me.ok) {
        setProfile(me.data);
      } else if (me.status === 401 || me.status === 404) {
        window.location.href = "/auth.html?next=%2Fcabinet.html";
      }
      const dev = await authDevices(accessToken);
      if (dev.ok) {
        setDevices(dev.data || []);
      }
      const subs = await authSubscriptions(accessToken);
      if (subs.ok && Array.isArray(subs.data)) {
        setPlans(subs.data);
        if (subs.data.length)
          setSelectedPlanId(subs.data[0].id);
      }
    })();
  }, [accessToken]);
  useEffect(() => {
    if (!devices.length) {
      setCurrentPremiumDeviceId(null);
      setCurrentPremiumDeviceName("\u041D\u0435\u0442 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432");
      return;
    }
    const last = devices.slice().sort((a, b) => new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0))[0];
    if (last) {
      setCurrentPremiumDeviceId(last.device_id);
      setCurrentPremiumDeviceName(last.model || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E");
    }
  }, [devices]);
  const reloadDevices = async () => {
    const dev = await authDevices(accessToken);
    if (dev.ok)
      setDevices(dev.data || []);
  };
  const handleRevokeDevice = async (id) => {
    const confirmExit = confirm("\u0412\u044B\u0439\u0442\u0438 \u0441 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430?");
    if (!confirmExit)
      return;
    await authRevokeDevice(accessToken, id);
    await reloadDevices();
  };
  const handleDeleteDevice = async (id) => {
    const confirmDel = confirm("\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u043F\u0438\u0441\u044C \u043E\u0431 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0435?");
    if (!confirmDel)
      return;
    await authDeleteDevice(accessToken, id);
    await reloadDevices();
  };
  const getCookie = (name) => {
    const m = document.cookie.match(new RegExp("(^|; )" + name.replace(/([.$?*|{}()[\\]\/+^])/g, "\\$1") + "=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : null;
  };
  const handleLogout = async () => {
    const csrf = getCookie("csrf_token");
    try {
      await authLogout(csrf);
    } catch {
    }
    try {
      del(KEYS.TOKEN);
      del(KEYS.STATE);
      del(KEYS.CHALLENGE);
      del(KEYS.RESEND_UNTIL);
    } catch {
    }
    window.location.href = "/auth.html";
  };
  const handleChangePassword = async (oldPwd, newPwd) => {
    const username = profile?.username || profile?.email;
    try {
      const res = await authChangePassword(username, oldPwd, newPwd);
      if (res.status === 204) {
        return { ok: true, msg: "\u041F\u0430\u0440\u043E\u043B\u044C \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0451\u043D." };
      } else if (res.status === 401) {
        return { ok: false, msg: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0442\u0430\u0440\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0438\u043B\u0438 \u0443\u0447\u0451\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435." };
      } else if (res.status === 403) {
        return { ok: false, msg: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435\u0430\u043A\u0442\u0438\u0432\u0435\u043D." };
      } else if (res.status === 422) {
        const msg = Array.isArray(res.data?.detail) ? res.data.detail.map((e) => e?.msg).filter(Boolean).join("; ") : "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u0435\u0439.";
        return { ok: false, msg };
      } else if (res.status === 429) {
        return { ok: false, msg: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435." };
      } else {
        return { ok: false, msg: `\u041E\u0448\u0438\u0431\u043A\u0430: ${res.status}` };
      }
    } catch (err) {
      console.error("change-password error", err);
      return { ok: false, msg: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443." };
    }
  };
  const handleDeleteAccount = async () => {
    const username = prompt("\u041B\u043E\u0433\u0438\u043D");
    const password = prompt("\u041F\u0430\u0440\u043E\u043B\u044C");
    if (!username || !password)
      return;
    try {
      const res = await authDeleteAccount(username, password);
      if (res.status === 204) {
        try {
          del(KEYS.TOKEN);
          del(KEYS.STATE);
          del(KEYS.CHALLENGE);
          del(KEYS.RESEND_UNTIL);
        } catch {
        }
        window.location.href = "/";
      } else {
        alert(`\u041E\u0448\u0438\u0431\u043A\u0430: ${res.status}`);
      }
    } catch (err) {
      alert("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u043F\u043E\u043F\u044B\u0442\u043A\u0443.");
    }
  };
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const amountRub = selectedPlan ? selectedPlan.price : 0;
  const monthPrice = selectedPlan ? Math.round(selectedPlan.price / selectedPlan.duration_months) : 0;
  const accountEmail = profile?.email || "";
  const { ready: payReady, error: payError, openPayForm } = useTinkoffScript();
  const handlePay = async () => {
    if (!selectedPlan || !payReady || !currentPremiumDeviceId) {
      alert(devices.length ? "\u041D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043E \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0434\u043B\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438." : "\u0423 \u0432\u0430\u0441 \u043D\u0435\u0442 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432. \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B.");
      return;
    }
    try {
      const order = await authCreateSubscriptionOrder(accessToken, profile?.id, currentPremiumDeviceId, selectedPlan.id);
      const orderId = order?.data?.order_id;
      if (!order.ok || !orderId) {
        alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u043A\u0430\u0437. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.");
        return;
      }
      openPayForm({
        terminalkey: TINKOFF_TERMINAL_KEY,
        frame: "true",
        language: "ru",
        amount: gatewayAmountString(amountRub),
        order: orderId,
        description: selectedPlan.sku,
        email: accountEmail,
        customerkey: profile?.id,
        DATA: currentPremiumDeviceId ? `device_id=${currentPremiumDeviceId}` : ''
      });
    } catch (e) {
      console.error(e);
      alert("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u043F\u043B\u0430\u0442\u0443. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.");
    }
  };
  const handleConfirmTransfer = (device) => {
    setCurrentPremiumDeviceId(device.deviceId);
    setCurrentPremiumDeviceName(device.name);
    setTransferOpen(false);
  };
  return /* @__PURE__ */ React.createElement("div", { className: "min-h-screen w-full bg-slate-50 flex flex-col" }, /* @__PURE__ */ React.createElement(SiteHeader, { isAuthed, onLogout: handleLogout, userName: profile?.username || profile?.email }), /* @__PURE__ */ React.createElement(
    TransferPremiumModal,
    {
      open: transferOpen,
      onClose: () => setTransferOpen(false),
      onConfirm: handleConfirmTransfer,
      devices: devices.map((d) => ({ name: d.model || "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E", os: d.os, ip: d.last_ip, active: fmtDateTime(d.last_seen_at), deviceId: d.device_id, revoked: d.revoked })),
      currentDeviceId: currentPremiumDeviceId
    }
  ), /* @__PURE__ */ React.createElement("main", { className: "flex-1 mx-auto max-w-screen-2xl px-5 py-6 flex gap-6" }, /* @__PURE__ */ React.createElement(Sidebar, { current: section, onChange: setSection }), /* @__PURE__ */ React.createElement("div", { className: "flex-1 min-w-0" }, /* @__PURE__ */ React.createElement("div", { className: "xl:hidden mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2" }, [
    { key: "profile", label: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C" },
    { key: "subscription", label: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430" },
    { key: "security", label: "\u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C" },
    { key: "devices", label: "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430" }
  ].map((t) => /* @__PURE__ */ React.createElement("button", { key: t.key, onClick: () => setSection(t.key), className: `rounded-lg px-3 py-2 text-sm border ${section === t.key ? "bg-white border-slate-300" : "bg-slate-100 border-transparent"}` }, t.label))), section === "profile" && /* @__PURE__ */ React.createElement(ProfilePanel, { profile }), section === "subscription" && /* @__PURE__ */ React.createElement(
    SubscriptionPanel,
    {
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
    }
  ), section === "security" && /* @__PURE__ */ React.createElement(SecurityPanel, { username: profile?.username || profile?.email, onChangePassword: handleChangePassword, onDeleteAccount: handleDeleteAccount }), section === "devices" && /* @__PURE__ */ React.createElement(DevicesPanel, { devices, onRevoke: handleRevokeDevice, onDelete: handleDeleteDevice }), payError && /* @__PURE__ */ React.createElement("div", { className: "mt-3 text-sm text-rose-600" }, payError))), /* @__PURE__ */ React.createElement("footer", { className: "mt-auto border-t border-slate-200 bg-white" }, /* @__PURE__ */ React.createElement("div", { className: "mx-auto max-w-screen-2xl px-5 py-6 text-sm text-slate-500 flex flex-wrap items-center justify-between gap-3" }, /* @__PURE__ */ React.createElement("div", null, "\xA9 ", (/* @__PURE__ */ new Date()).getFullYear(), " GluOne. \u0412\u0441\u0435 \u043F\u0440\u0430\u0432\u0430 \u0437\u0430\u0449\u0438\u0449\u0435\u043D\u044B."), /* @__PURE__ */ React.createElement("div", { className: "flex items-center gap-4" }, /* @__PURE__ */ React.createElement("a", { className: "hover:text-slate-700", href: "#" }, "\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043A\u043E\u043D\u0444\u0438\u0434\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438"), /* @__PURE__ */ React.createElement("a", { className: "hover:text-slate-700", href: "#" }, "\u0423\u0441\u043B\u043E\u0432\u0438\u044F"), /* @__PURE__ */ React.createElement("a", { className: "hover:text-slate-700", href: "#" }, "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B")))));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(AccountApp, null));
