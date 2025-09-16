// devices.js
import { fmtDate, fmtDateTime } from "./helpers.js";
const { useState, useEffect } = React;

export function DeviceItem({ device, onRevoke, onDelete, disableDelete }) {
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

    return React.createElement(
      "div",
      { className: "rounded-xl border border-slate-200 p-4 bg-white dark:bg-slate-800 dark:border-slate-700" },
      React.createElement(
        "div",
        { className: "flex items-start justify-between" },
        React.createElement("div", { className: "font-semibold text-slate-800 dark:text-slate-100" }, name),
        React.createElement(
          "span",
          {
            className: `text-xs px-2 py-0.5 rounded-full border ${
              revoked
                ? "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-700 dark:border-slate-600"
                : "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-900 dark:border-emerald-700"
            }`,
          },
          revoked ? "Отозвано" : "Активно"
        )
      ),

    // Блок атрибутов: широкая правая колонка
    React.createElement(
      "div",
      {
        className:
          "mt-3 grid grid-cols-[minmax(140px,220px)_1fr] gap-x-6 gap-y-2 text-sm",
      },
        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "OC"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, os),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "Сборка"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, build),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "Активность"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, active),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "Создано"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, created),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "IP"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, ip),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "Премиум"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, isPremium ? "Активен" : "Нет"),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "Действует до"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, isPremium ? premiumUntil : "—"),

        React.createElement("div", { className: "text-slate-500 dark:text-slate-400" }, "ID устройства"),
        React.createElement("div", { className: "text-slate-800 break-words dark:text-slate-100" }, deviceId)
      ),

      React.createElement(
        "div",
        { className: "mt-3 flex justify-end gap-2" },
        !revoked
          ? React.createElement(
              "button",
              {
                className:
                  "rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600",
                onClick: () => onRevoke(deviceId),
              },
              "Выйти с устройства"
            )
          : React.createElement(
              "button",
              {
                className: `rounded-lg px-3 py-1.5 text-sm text-white ${
                  disableDelete
                    ? "bg-slate-400 cursor-not-allowed dark:bg-slate-600"
                    : "bg-rose-600 hover:bg-rose-700"
                }`,
                disabled: disableDelete,
                onClick: () => onDelete(deviceId),
              },
              "Удалить"
            )
      )
  );
}

export function TransferPremiumModal({
  open,
  onClose,
  onConfirm,
  devices,
  currentDeviceId,
  sourceName,
  title,
  description,
}) {
  const [selected, setSelected] = useState(currentDeviceId || null);
  useEffect(() => {
    if (open) setSelected(currentDeviceId || null);
  }, [open, currentDeviceId]);
  if (!open) return null;

  const eligible = devices.filter((d) => !d.revoked);
  const chosen = eligible.find((x) => x.deviceId === selected);

    return React.createElement(
      "div",
      { className: "fixed inset-0 z-50 flex items-center justify-center" },
      React.createElement("div", { className: "absolute inset-0 bg-slate-900/40", onClick: onClose }),
      React.createElement(
        "div",
        { className: "relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-4 dark:bg-slate-800 dark:border-slate-700" },
        React.createElement("div", { className: "text-base font-semibold text-slate-900 dark:text-slate-100" }, title || "Выбрать устройство для оплаты"),
        React.createElement("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-400" }, description || "Выберите устройство из списка."),
        React.createElement(
          "div",
          { className: "mt-4 space-y-2 max-h-72 overflow-auto" },
          eligible.length === 0 &&
            React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, "Нет доступных устройств."),
          eligible.map((d) =>
            React.createElement(
              "label",
              { key: d.deviceId, className: "flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:hover:bg-slate-700" },
              React.createElement("input", {
                type: "radio",
                name: "transfer-device",
                className: "mt-1",
                checked: selected === d.deviceId,
                onChange: () => setSelected(d.deviceId),
              }),
              React.createElement(
                "div",
                { className: "flex-1" },
                React.createElement("div", { className: "font-medium text-slate-800 dark:text-slate-100" }, d.name),
                React.createElement("div", { className: "text-xs text-slate-500 dark:text-slate-400" }, `${d.os || "—"} • ${d.ip} • ${d.active}`)
              )
            )
          )
        ),
        sourceName &&
          selected &&
          React.createElement(
            "p",
            { className: "mt-2 text-sm text-slate-600 dark:text-slate-400" },
            `Премиум будет перенесён с устройства "${sourceName}" на "${chosen?.name || ""}".`
          ),
        React.createElement(
          "div",
          { className: "mt-4 flex justify-end gap-2" },
          React.createElement("button", { className: "rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100", onClick: onClose }, "Отмена"),
          React.createElement(
            "button",
            {
              disabled: !selected,
              className: `rounded-lg px-3 py-1.5 text-sm text-white ${
                selected
                  ? "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  : "bg-slate-400 cursor-not-allowed dark:bg-slate-600"
              }`,
              onClick: () => {
                const d = eligible.find((x) => x.deviceId === selected);
                if (d) onConfirm(d);
              },
            },
            "Выбрать"
          )
        )
      )
    );
  }
