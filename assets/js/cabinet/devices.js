// devices.js
import { fmtDate, fmtDateTime } from "./helpers.js";
const { useState, useEffect } = React;

export function DeviceItem({ device, onRevoke, onDelete }) {
  const name = device?.model || "Неизвестное устройство";
  const os = device?.os || "—";
  const build = device?.app_build || "—";
  const ip = device?.last_ip || "—";
  const created = device?.created_at ? fmtDate(device.created_at) : "—";
  const active = device?.last_seen_at ? fmtDateTime(device.last_seen_at) : "—";
  const isPremium = !!device?.is_premium;
  const premiumUntil = device?.premium_expires_at ? fmtDate(device.premium_expires_at) : "—";
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
      React.createElement("div", { className: "text-slate-500" }, "Премиум"), React.createElement("div", { className: "text-slate-800" }, isPremium ? "Активен" : "Нет"),
      React.createElement("div", { className: "text-slate-500" }, "Действует до"), React.createElement("div", { className: "text-slate-800" }, isPremium ? premiumUntil : "—"),
      React.createElement("div", { className: "text-slate-500" }, "ID устройства"), React.createElement("div", { className: "text-slate-800 break-all" }, deviceId)
    ),
    React.createElement("div", { className: "mt-3 flex justify-end gap-2" },
      !revoked
        ? React.createElement("button", { className: "rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800", onClick: () => onRevoke(deviceId) }, "Выйти с устройства")
        : React.createElement("button", { className: "rounded-lg bg-rose-600 text-white px-3 py-1.5 text-sm hover:bg-rose-700", onClick: () => onDelete(deviceId) }, "Удалить")
    )
  );
}

export function TransferPremiumModal({ open, onClose, onConfirm, devices, currentDeviceId }) {
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
