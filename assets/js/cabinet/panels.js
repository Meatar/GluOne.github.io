// panels.js
import { formatRub, maskEmail, ageFrom, fmtDate, fmtDateTime, mapGender, mapDia } from "./helpers.js";
import { Chip, SectionCard, KeyRow, DangerLink } from "./ui.js";
import { DeviceItem } from "./devices.js";
const { useState } = React;

export function ProfilePanel({ profile }) {
  if (!profile) {
    return React.createElement("div", { className: "space-y-4 w-full" },
      React.createElement(SectionCard, null, React.createElement("div", { className: "text-sm text-slate-600" }, "Загружаем профиль…"))
    );
  }
  const initial = (profile.username || profile.email || "U").trim()[0].toUpperCase();
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  return React.createElement("div", { className: "space-y-4 w-full" },
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
        // УБРАНО: строка "Статус"
        React.createElement("div", { className: "flex items-center justify-between py-1.5" },
          React.createElement("div", { className: "text-sm text-slate-500" }, "Роли"),
          React.createElement("div", { className: "flex flex-wrap gap-1 justify-end" }, roles.map((r) => React.createElement(Chip, { key: r }, r)))
        ),
        React.createElement(KeyRow, { label: "Пол", value: mapGender(profile.gender) }),
        React.createElement(KeyRow, { label: "Дата рождения", value: profile.birth_date ? `${fmtDate(profile.birth_date)}${ageFrom(profile.birth_date) ? ` • ${ageFrom(profile.birth_date)} лет` : ""}` : "—" }),
        React.createElement(KeyRow, { label: "Тип диабета", value: mapDia(profile.diabetes_type) })
      )
    )
  );
}

export function SubscriptionPanel({ onOpenTransfer, currentDeviceName, onPay, plans, selectedPlanId, setSelectedPlanId, amountRub, monthPrice, email, currentDeviceId, isPremium, premiumExpiresAt }) {
  return React.createElement("div", { className: "w-full" },
    React.createElement(SectionCard, { title: "Подписка Premium" },
      React.createElement("div", { className: "space-y-2 text-sm" },
        React.createElement("div", { className: "flex items-center justify-between" },
          React.createElement("span", { className: "text-slate-500" }, "Статус"),
          React.createElement("span", { className: `font-medium ${isPremium ? "text-emerald-700" : "text-rose-600"}` }, isPremium ? "Активна" : "Неактивна")
        ),
        isPremium && React.createElement("div", { className: "flex items-center justify-between" },
          React.createElement("span", { className: "text-slate-500" }, "Действует до"),
          React.createElement("span", { className: "font-medium" }, fmtDate(premiumExpiresAt))
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
            className: "rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
          }, plans.map((p) => React.createElement("option", { key: p.id, value: p.id }, `${p.duration_months} мес. — ${formatRub(p.price)} ₽`)))
        ),
        React.createElement("div", { className: "text-right" },
          React.createElement("div", { className: "text-xs text-slate-500" }, "Итого к оплате"),
          React.createElement("div", { className: "text-2xl font-extrabold text-slate-900 leading-none" }, formatRub(amountRub), " ₽"),
          selectedPlanId && React.createElement("div", { className: "text-xs text-slate-500 mt-1" }, `${formatRub(monthPrice)} ₽/мес× ${plans.find((p) => p.id === selectedPlanId)?.duration_months}`)
        )
      ),
      // СКРЫТО: поле "E-mail плательщика"
      // React.createElement("div", { className: "mt-4 flex flex-col gap-1" }, ...)
      React.createElement("div", { className: "mt-5 flex gap-3" },
        (() => {
          const disabled = !selectedPlanId || !currentDeviceId;
          const cls = disabled ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700";
          return React.createElement(
            "button",
            { disabled, onClick: onPay, className: `rounded-xl px-5 py-3 font-semibold text-white text-base ${cls}` },
            isPremium ? "Продлить" : "Купить"
          );
        })(),
        React.createElement("button", { onClick: onOpenTransfer, className: "rounded-xl border border-slate-200 px-5 py-3 font-semibold text-base bg-white hover:bg-slate-50" }, "Сменить устройство")
      )
    )
  );
}

export function SecurityPanel({ username, onChangePassword, onDeleteAccount }) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await onChangePassword(oldPass, newPass);
    setMsg(res.msg);
    setLoading(false);
  };

  return React.createElement("div", { className: "space-y-6 w-full" },
    React.createElement(SectionCard, { title: "Смена пароля" },
      React.createElement("form", { className: "space-y-5", onSubmit: handleSubmit },
        React.createElement("p", { className: "text-base text-slate-600" }, "Рекомендуем менять пароль раз в 6–12 месяцев."),
        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          // Текущий пароль
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700" }, "Текущий пароль"),
            React.createElement("div", { className: "relative" },
              React.createElement("input", {
                type: showOld ? "text" : "password",
                autoComplete: "current-password",
                value: oldPass,
                onChange: (e) => setOldPass(e.target.value),
                placeholder: "Введите текущий пароль",
                className: "w-full rounded-xl border border-slate-300 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white pr-12"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowOld((v) => !v),
                "aria-label": showOld ? "Скрыть пароль" : "Показать пароль",
                title: showOld ? "Скрыть пароль" : "Показать пароль",
                className: "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              }, showOld ? "🙈" : "👁️")
            )
          ),
          // Новый пароль
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700" }, "Новый пароль"),
            React.createElement("div", { className: "relative" },
              React.createElement("input", {
                type: showNew ? "text" : "password",
                autoComplete: "new-password",
                value: newPass,
                onChange: (e) => setNewPass(e.target.value),
                placeholder: "Введите новый пароль",
                className: "w-full rounded-xl border border-slate-300 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white pr-12"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowNew((v) => !v),
                "aria-label": showNew ? "Скрыть пароль" : "Показать пароль",
                title: showNew ? "Скрыть пароль" : "Показать пароль",
                className: "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
              }, showNew ? "🙈" : "👁️")
            )
          )
        ),
        msg && React.createElement("div", { className: "text-base text-slate-600" }, msg),
        React.createElement("div", { className: "flex items-center justify-end" },
          React.createElement("button", { disabled: loading, className: "rounded-xl bg-slate-900 text-white px-6 h-12 text-base font-semibold hover:bg-slate-800" }, loading ? "Обновляем…" : "Обновить")
        )
      )
    ),
    React.createElement(SectionCard, null,
      React.createElement(DangerLink, { onClick: onDeleteAccount }, "Удалить аккаунт")
    )
  );
}

export function DevicesPanel({ devices, onRevoke, onDelete }) {
  return React.createElement("div", { className: "space-y-4" },
    React.createElement(SectionCard, { title: "Устройства", footer: React.createElement("div", { className: "text-sm text-slate-500" }, "Всего устройств: ", devices.length) },
      React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
        devices.map((dev) => {
          const disableDelete = devices.length === 1 && dev.is_premium;
          return React.createElement(DeviceItem, { key: dev.device_id, device: dev, onRevoke, onDelete, disableDelete });
        })
      )
    )
  );
}
