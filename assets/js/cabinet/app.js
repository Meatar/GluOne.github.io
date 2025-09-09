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
  authCreateSubscriptionOrder,
  authPremiumTransfer
} from "../api.js";
import { clearAuthStorage } from "../storage.js";
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
  const [transferContext, setTransferContext] = useState(null); // 'subscription' or 'delete'
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingDeleteName, setPendingDeleteName] = useState("");
  const [currentPremiumDeviceId, setCurrentPremiumDeviceId] = useState(null);
  const [currentPremiumDeviceName, setCurrentPremiumDeviceName] = useState("—");
  const [currentDeviceIsPremium, setCurrentDeviceIsPremium] = useState(false);
  const [currentDeviceExpiresAt, setCurrentDeviceExpiresAt] = useState(null);

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
    (async () => {
      if (section === "profile") {
        const me = await authMe();
        if (me.ok) setProfile(me.data);
      }
      if (section === "devices") {
        const dev = await authDevices();
        if (dev.ok) setDevices(dev.data || []);
      }
      if (section === "subscription") {
        const subs = await authSubscriptions();
        if (subs.ok && Array.isArray(subs.data)) {
          setPlans(subs.data);
          if (subs.data.length) {
            const found = subs.data.find((p) => p.id === selectedPlanId);
            if (!found) setSelectedPlanId(subs.data[0].id);
          }
        }
      }
    })();
  }, [section]);

  useEffect(() => {
    const active = devices.filter((d) => !d.revoked);
    if (!active.length) {
      setCurrentPremiumDeviceId(null);
      setCurrentPremiumDeviceName(devices.length ? "Нет активных устройств" : "Нет устройств");
      setCurrentDeviceIsPremium(false);
      setCurrentDeviceExpiresAt(null);
      return;
    }
    const premium = active.find((d) => d.is_premium);
    const target = premium || active.slice().sort((a, b) => new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0))[0];
    if (target) {
      setCurrentPremiumDeviceId(target.device_id);
      setCurrentPremiumDeviceName(target.model || "Неизвестное устройство");
      setCurrentDeviceIsPremium(!!target.is_premium);
      setCurrentDeviceExpiresAt(target.premium_expires_at || null);
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
    const device = devices.find((d) => d.device_id === id);
    if (!device) return;
    if (device.is_premium) {
      const eligible = devices.filter((d) => !d.revoked && d.device_id !== id);
      if (eligible.length === 0) {
        alert("Нельзя удалить последнее устройство с Premium.");
        return;
      }
      setTransferContext('delete');
      setPendingDeleteId(id);
      setPendingDeleteName(device.model || 'Неизвестное устройство');
      setTransferOpen(true);
      return;
    }
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
    if (!selectedPlan || !currentPremiumDeviceId) {
      const hasDevices = devices.length > 0;
      const hasActiveDevices = devices.some((d) => !d.revoked);
      const msg = hasDevices
        ? (hasActiveDevices ? "Не выбрано устройство для подписки." : "Нет активных устройств. Добавьте устройство для оплаты.")
        : "У вас нет устройств. Добавьте устройство для оплаты.";
      alert(msg);
      return;
    }
    const userId = profile?.user_id;
    if (!userId) { alert("Не удалось определить пользователя."); return; }

    try {
      const order = await authCreateSubscriptionOrder(userId, currentPremiumDeviceId, selectedPlan.id);
      const paymentUrl = order?.data?.payment_url;
      if (!order.ok || !paymentUrl) {
        alert("Не удалось создать заказ. Попробуйте ещё раз.");
        return;
      }
      window.location.href = paymentUrl;
    } catch (e) {
      console.error(e);
      alert("Не удалось открыть оплату. Попробуйте ещё раз.");
    }
  };

  const handleConfirmTransfer = async (device) => {
    setTransferOpen(false);
    if (transferContext === 'subscription') {
      if (currentDeviceIsPremium && currentPremiumDeviceId !== device.deviceId) {
        await authPremiumTransfer(device.deviceId);
        await reloadDevices();
        setCurrentDeviceIsPremium(true);
      } else {
        setCurrentDeviceIsPremium(!!device.isPremium);
      }
      setCurrentPremiumDeviceId(device.deviceId);
      setCurrentPremiumDeviceName(device.name);
      setCurrentDeviceExpiresAt(device.premiumExpiresAt || currentDeviceExpiresAt);
    } else if (transferContext === 'delete') {
      await authPremiumTransfer(device.deviceId);
      if (pendingDeleteId) {
        await authDeleteDevice(pendingDeleteId);
      }
      await reloadDevices();
    }
    setTransferContext(null);
    setPendingDeleteId(null);
    setPendingDeleteName("");
  };

  return React.createElement("div", { className: "min-h-screen w-full bg-slate-50 flex flex-col" },
    React.createElement(SiteHeader, { isAuthed, onLogout: handleLogout, userName: profile?.username || profile?.email }),

    React.createElement(TransferPremiumModal, {
      open: transferOpen,
      onClose: () => { setTransferOpen(false); setTransferContext(null); },
      onConfirm: handleConfirmTransfer,
      devices: devices
        .filter((d) => transferContext !== 'delete' || d.device_id !== pendingDeleteId)
        .map((d) => ({ name: d.model || "Неизвестное устройство", os: d.os, ip: d.last_ip, active: fmtDateTime(d.last_seen_at), deviceId: d.device_id, revoked: d.revoked, isPremium: d.is_premium, premiumExpiresAt: d.premium_expires_at })),
      currentDeviceId: transferContext === 'subscription' ? currentPremiumDeviceId : null,
      title: transferContext === 'delete' ? 'Перенести Premium' : 'Выбрать устройство для оплаты',
      description: transferContext === 'delete' ? 'Выберите устройство, куда перенести подписку.' : 'Выберите устройство из списка.',
      fromDeviceName: transferContext === 'delete' ? pendingDeleteName : (currentDeviceIsPremium ? currentPremiumDeviceName : null)
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
          onOpenTransfer: () => { setTransferContext('subscription'); setTransferOpen(true); },
          currentDeviceName: currentPremiumDeviceName,
          onPay: handlePay,
          plans,
          selectedPlanId,
          setSelectedPlanId,
          amountRub,
          monthPrice,
          email: accountEmail,
          currentDeviceId: currentPremiumDeviceId,
          isPremium: currentDeviceIsPremium,
          premiumExpiresAt: currentDeviceExpiresAt
        }),
        section === "security" && React.createElement(SecurityPanel, { username: profile?.username || profile?.email, onChangePassword: handleChangePassword, onDeleteAccount: handleDeleteAccount }),
        section === "devices" && React.createElement(DevicesPanel, { devices, onRevoke: handleRevokeDevice, onDelete: handleDeleteDevice }),
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
