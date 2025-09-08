// app.js
import {
  authRefresh,
  authMe,
  authLogout,
  authDevices,
  authRevokeDevice,
  authDeleteDevice,
  authChangePassword,
  authDeleteAccount,
  authSubscriptions,
  authCreateSubscriptionOrder
} from "../api.js";
import { clearAuthStorage } from "../storage.js";
import { useTinkoffScript, buildTinkoffForm, gatewayAmountString, TINKOFF_TERMINAL_KEY } from "./tinkoff.js";
import { fmtDateTime } from "./helpers.js";
import { ProfilePanel, SubscriptionPanel, SecurityPanel, DevicesPanel } from "./panels.js";
import { SiteHeader, Sidebar } from "./layout.js";
import { TransferPremiumModal } from "./devices.js";

const { useState, useEffect } = React;

export default function AccountApp() {
  const [section, setSection] = useState("profile");
  const [isAuthed, setIsAuthed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [currentPremiumDeviceId, setCurrentPremiumDeviceId] = useState(null);
  const [currentPremiumDeviceName, setCurrentPremiumDeviceName] = useState("—");

  const { ready: payReady, error: payError } = useTinkoffScript();

  useEffect(() => {
    (async () => {
      const r = await authRefresh();
      if (!r.ok) {
        setIsAuthed(false);
        window.location.href = "/auth.html?next=%2Fcabinet.html";
        return;
      }

      const me = await authMe();
      if (me.ok) {
        setProfile(me.data);
        setIsAuthed(true);
      } else {
        setIsAuthed(false);
        window.location.href = "/auth.html?next=%2Fcabinet.html";
        return;
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
    clearAuthStorage();
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
        clearAuthStorage();
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
      if (window.Tinkoff?.createPayment) {
        window.Tinkoff.createPayment({
          terminalkey: TINKOFF_TERMINAL_KEY,
          language: "ru",
          amount: gatewayAmountString(amountRub),
          order: orderId,
          description: selectedPlan.sku,
          email: accountEmail,
          view: "popup"
        });
      } else if (window.pay) {
        const form = buildTinkoffForm({
          terminalkey: TINKOFF_TERMINAL_KEY,
          language: "ru",
          amount: gatewayAmountString(amountRub),
          order: orderId,
          description: selectedPlan.sku,
          email: accountEmail,
          frame: "popup"
        });
        document.body.appendChild(form);
        try { window.pay(form); } finally { document.body.removeChild(form); }
      } else {
        alert("Виджет оплаты ещё не готов.");
      }
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
