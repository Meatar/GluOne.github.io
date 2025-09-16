// panels.js
import { formatRub, maskEmail, ageFrom, fmtDate, fmtDateTime, mapGender, mapDia } from "./helpers.js";
import { Chip, SectionCard, KeyRow, DangerLink } from "./ui.js";
import { DeviceItem } from "./devices.js";
import { authPaymentsList, authUpdate, authUpdateVerify, authUpdateResend } from "../api.js";
const { useState, useEffect } = React;

/* ===================== Профиль ===================== */
export function ProfilePanel({ profile, hiddenStatus = true }) {
  if (!profile) {
    return React.createElement("div", { className: "space-y-4 w-full" },
      React.createElement(SectionCard, null, React.createElement("div", { className: "text-sm text-slate-600" }, "Загружаем профиль…"))
    );
  }
  const initial = (profile.name || profile.username || profile.email || "U").trim()[0].toUpperCase();
  const roles = Array.isArray(profile.roles) ? profile.roles : [];
  return React.createElement("div", { className: "space-y-4 w-full" },
    React.createElement(SectionCard, null,
        React.createElement("div", { className: "flex items-center gap-3" },
          React.createElement("div", { className: "h-12 w-12 shrink-0 rounded-xl bg-indigo-100 text-indigo-600 font-semibold flex items-center justify-center" }, initial),
          React.createElement("div", { className: "flex-1" },
            React.createElement("div", { className: "flex items-center gap-2 flex-wrap" },
              React.createElement("div", { className: "font-semibold text-slate-900 dark:text-slate-100" }, profile.username || "Без имени"),
              profile.is_premium && React.createElement(Chip, null, "Premium")
            ),
            React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, profile.email ? maskEmail(profile.email) : "—")
          )
        ),
      React.createElement("div", { className: "mt-4" },
          !hiddenStatus && React.createElement("div", { className: "flex items-center justify-between py-1.5" },
            React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, "Статус"),
            React.createElement("span", { className: profile.is_active ? "text-emerald-700" : "text-rose-600" }, profile.is_active ? "Активен" : "Неактивен")
          ),
          React.createElement(KeyRow, { label: "Имя", value: profile.name || "—" }),
          React.createElement("div", { className: "grid grid-cols-[minmax(140px,220px)_1fr] gap-3 items-start py-2" },
            React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, "Роли"),
            React.createElement("div", {
              className: "flex flex-wrap justify-end gap-1 text-sm font-medium text-slate-800 dark:text-slate-100"
            }, roles.length ? roles.map((r) => React.createElement(Chip, { key: r }, r)) : "—")
          ),
        React.createElement(KeyRow, { label: "Пол", value: mapGender(profile.gender) }),
        React.createElement(KeyRow, { label: "Дата рождения", value: profile.birth_date ? `${fmtDate(profile.birth_date)}${ageFrom(profile.birth_date) ? ` • ${ageFrom(profile.birth_date)} лет` : ""}` : "—" }),
        React.createElement(KeyRow, { label: "Тип диабета", value: mapDia(profile.diabetes_type) })
      )
    )
  );
}

/* ===================== Подписка ===================== */
export function SubscriptionPanel({ onOpenTransfer, currentDeviceName, onPay, plans, selectedPlanId, setSelectedPlanId, amountRub, monthPrice, email, currentDeviceId, isPremium, premiumExpiresAt }) {
  return React.createElement("div", { className: "w-full" },
    React.createElement(SectionCard, { title: "Подписка Premium" },
        React.createElement("div", { className: "space-y-2 text-sm" },
          React.createElement("div", { className: "flex items-center justify-between" },
            React.createElement("span", { className: "text-slate-500 dark:text-slate-400" }, "Статус"),
            React.createElement("span", { className: `font-medium ${isPremium ? "text-emerald-700" : "text-rose-600"}` }, isPremium ? "Активна" : "Неактивна")
          ),
          isPremium && React.createElement("div", { className: "flex items-center justify-between" },
            React.createElement("span", { className: "text-slate-500 dark:text-slate-400" }, "Действует до"),
            React.createElement("span", { className: "font-medium" }, fmtDate(premiumExpiresAt))
          ),
          React.createElement("div", { className: "flex items-center justify-between" },
            React.createElement("span", { className: "text-slate-500 dark:text-slate-400" }, "Устройство"),
            React.createElement("span", { className: "font-medium" }, currentDeviceName)
          )
        ),
        React.createElement("div", { className: "mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end" },
          React.createElement("div", { className: "flex flex-col gap-1" },
            React.createElement("label", { className: "text-sm text-slate-600 dark:text-slate-400" }, "Период оплаты"),
            React.createElement("select", {
              value: selectedPlanId,
              onChange: (e) => setSelectedPlanId(e.target.value),
              className: "rounded-lg border border-slate-200 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800 dark:border-slate-600"
            }, plans.map((p) => React.createElement("option", { key: p.id, value: String(p.id) }, `${p.duration_months} мес. — ${formatRub(p.price)} ₽`)))
          ),
          React.createElement("div", { className: "text-right" },
            React.createElement("div", { className: "text-xs text-slate-500 dark:text-slate-400" }, "Итого к оплате"),
            React.createElement("div", { className: "text-2xl font-extrabold text-slate-900 leading-none dark:text-slate-100" }, formatRub(amountRub), " ₽"),
            selectedPlanId && React.createElement("div", { className: "text-xs text-slate-500 mt-1 dark:text-slate-400" }, `${formatRub(monthPrice)} ₽/мес× ${plans.find((p) => String(p.id) === selectedPlanId)?.duration_months}`)
          )
        ),
        // Скрываем E-mail плательщика по требованиям
        React.createElement("div", { className: "mt-5 flex gap-3" },
          (() => {
            const disabled = !selectedPlanId || !currentDeviceId;
            const cls = disabled ? "bg-slate-400 cursor-not-allowed dark:bg-slate-600" : "bg-indigo-600 hover:bg-indigo-700";
            return React.createElement(
              "button",
              { disabled, onClick: onPay, className: `rounded-xl px-5 py-3 font-semibold text-white text-base ${cls}` },
              isPremium ? "Продлить" : "Купить"
            );
          })(),
          React.createElement("button", { onClick: onOpenTransfer, className: "rounded-xl border border-slate-200 px-5 py-3 font-semibold text-base bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700" }, "Сменить устройство")
        )
      )
    );
  }

/* ===================== Безопасность ===================== */
function DeleteAccountModal({ open, onClose, onSubmit, defaultLogin = "" }) {
  const [login, setLogin] = useState(defaultLogin || "");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async () => {
    setError("");
    const res = await onSubmit(login.trim(), pass);
    if (!res?.ok) setError(res?.msg || "Не удалось удалить аккаунт.");
  };

  return React.createElement("div", { className: "fixed inset-0 z-50 grid place-items-center" },
    React.createElement("div", { className: "absolute inset-0 bg-slate-900/40", onClick: onClose }),
    React.createElement("div", { className: "relative w-[min(520px,96vw)] rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700" },
      React.createElement("div", { className: "text-xl font-bold text-slate-900 dark:text-slate-100" }, "Удаление аккаунта"),
      React.createElement("p", { className: "mt-1 text-sm text-slate-600 dark:text-slate-400" }, "Подтвердите удаление — укажите логин и пароль. Действие нельзя отменить."),
      React.createElement("div", { className: "mt-4 grid gap-3" },
        React.createElement("div", { className: "flex flex-col gap-1" },
          React.createElement("label", { className: "text-sm text-slate-700 dark:text-slate-300" }, "Логин"),
          React.createElement("input", {
            value: login, onChange: (e) => setLogin(e.target.value),
            autoComplete: "username",
            className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-12 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800 dark:border-slate-600"
          })
        ),
        React.createElement("div", { className: "flex flex-col gap-1" },
          React.createElement("label", { className: "text-sm text-slate-700 dark:text-slate-300" }, "Пароль"),
          React.createElement("div", { className: "relative" },
            React.createElement("input", {
              type: showPass ? "text" : "password",
              value: pass, onChange: (e) => setPass(e.target.value),
              autoComplete: "current-password",
              className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-12 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white pr-12 dark:bg-slate-800 dark:border-slate-600"
            }),
            React.createElement("button", {
              type: "button",
              onClick: () => setShowPass(v => !v),
              "aria-label": showPass ? "Скрыть пароль" : "Показать пароль",
              title: showPass ? "Скрыть пароль" : "Показать пароль",
              className: "absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            }, showPass ? "🙈" : "👁️")
          )
        ),
        error && React.createElement("div", { className: "text-sm text-rose-600" }, error)
      ),
      React.createElement("div", { className: "mt-5 flex justify-end gap-2" },
        React.createElement("button", { onClick: onClose, className: "rounded-lg border border-slate-200 px-4 h-11 text-sm bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700" }, "Отмена"),
        React.createElement("button", { onClick: submit, className: "rounded-lg bg-rose-600 text-white px-4 h-11 text-sm font-semibold hover:bg-rose-700" }, "Удалить")
      )
    )
  );
}

function VerifyEmailModal({ open, onClose, onSubmit, email, onResend }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [resendLeft, setResendLeft] = useState(0);
  const refs = React.useRef([]);

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      refs.current = [];
      setError("");
      setMsg("");
      setResendLeft(45);
      setTimeout(() => refs.current[0]?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (resendLeft <= 0) return;
    const tId = setInterval(() => setResendLeft((s) => s - 1), 1000);
    return () => clearInterval(tId);
  }, [resendLeft]);

  if (!open) return null;

  const handleChange = (idx, val) => {
    const v = (val || "").replace(/\D/g, "").slice(-1);
    setDigits((d) => {
      const nd = d.slice();
      nd[idx] = v;
      return nd;
    });
    if (v && idx < refs.current.length - 1) refs.current[idx + 1]?.focus();
  };

  const handleKey = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const handleResend = async () => {
    if (resendLeft > 0) return;
    setError(""); setMsg("");
    setResendLeft(45);
    const res = await onResend?.();
    if (res?.ok) setMsg("Новый код отправлен.");
    else { setError(res?.msg || "Не удалось отправить код"); setResendLeft(0); }
  };

  const submit = async () => {
    const code = digits.join("");
    setError(""); setMsg("");
    const res = await onSubmit(code);
    if (!res?.ok) setError(res?.msg || "Неверный код");
  };

  const masked = maskEmail(email);

  return React.createElement("div", { className: "fixed inset-0 z-50 grid place-items-center" },
    React.createElement("div", { className: "absolute inset-0 bg-slate-900/40", onClick: onClose }),
    React.createElement("div", { className: "relative w-[min(520px,96vw)] rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 dark:bg-slate-800 dark:border-slate-700" },
      React.createElement("div", { style: { textAlign: "center" } },
        React.createElement("div", { className: "circle-icon", "aria-hidden": "true" },
          React.createElement("svg", { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none" },
            React.createElement("rect", { x: 3, y: 5, width: 18, height: 14, rx: 3, stroke: "currentColor", "stroke-width": 2 }),
            React.createElement("path", { d: "M4 7l8 6 8-6", stroke: "currentColor", "stroke-width": 2, fill: "none" })
          )
        ),
        React.createElement("h1", { className: "auth-title" }, "Код подтверждения"),
        React.createElement("p", { className: "auth-sub" }, "Мы отправили код на e-mail ", React.createElement("span", null, masked))
      ),
      React.createElement("form", { onSubmit: (e) => { e.preventDefault(); submit(); }, style: { marginTop: 24 } },
        React.createElement("div", { className: "otp-grid otp-grid--4", "aria-label": "Поля ввода кода из письма" },
          digits.map((d, i) => React.createElement("input", {
            key: i,
            ref: (el) => refs.current[i] = el,
            className: "otp-input",
            inputMode: "numeric",
            maxLength: 1,
            value: d,
            onChange: (e) => handleChange(i, e.target.value),
            onKeyDown: (e) => handleKey(i, e)
          }))
        ),
        error && React.createElement("p", { className: "form-error", style: { marginTop: 10 } }, error),
        React.createElement("div", { className: "resend-wrap", style: { marginTop: 14, textAlign: "center" } },
          React.createElement("span", { className: "form-hint" }, "Не получили код?"),
          React.createElement("button", { type: "button", onClick: handleResend, className: "link-btn", disabled: resendLeft > 0 }, "Отправить повторно"),
          React.createElement("div", { className: "form-hint", style: { marginTop: 6 } }, "Повторная отправка доступна через ", React.createElement("span", null, fmt(resendLeft)))
        ),
        React.createElement("div", { className: "note note--confirm", role: "note", style: { marginTop: 18 } },
          React.createElement("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
            React.createElement("circle", { cx: 12, cy: 12, r: 9, stroke: "currentColor", "stroke-width": 2 }),
            React.createElement("path", { d: "M12 8h.01M11 12h2v5h-2z", stroke: "currentColor", "stroke-width": 2 })
          ),
          React.createElement("div", null, "Код действует в течение 10 минут. Если письмо не пришло, проверьте папку «Спам» или правильность адреса.")
        ),
        msg && React.createElement("p", { className: "form-hint", style: { marginTop: 10 } }, msg),
        React.createElement("div", { className: "mt-5 flex justify-end gap-2" },
          React.createElement("button", { type: "button", onClick: onClose, className: "rounded-lg border border-slate-200 px-4 h-11 text-sm bg-white hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:hover:bg-slate-700" }, "Отмена"),
          React.createElement("button", { type: "submit", className: "rounded-lg bg-indigo-600 text-white px-4 h-11 text-sm font-semibold hover:bg-indigo-700" }, "Подтвердить")
        )
      )
    )
  );
}

export function SecurityPanel({ profile, onChangePassword, onDeleteAccount, onProfileReload }) {
  const username = profile?.username || profile?.email || "";

  const [name, setName] = useState(profile?.name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [gender, setGender] = useState(profile?.gender || "");
  const [birthDate, setBirthDate] = useState(profile?.birth_date || "");
  const [dia, setDia] = useState(profile?.diabetes_type || "type1");
  const [msgUpd, setMsgUpd] = useState("");
  const [loadingUpd, setLoadingUpd] = useState(false);
  const [verifyCtx, setVerifyCtx] = useState(null); // { challengeId, email }

  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  useEffect(() => {
    setName(profile?.name || "");
    setEmail(profile?.email || "");
    setGender(profile?.gender || "");
    setBirthDate(profile?.birth_date || "");
    setDia(profile?.diabetes_type || "type1");
  }, [profile]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const payload = {};
    if (name !== profile?.name) payload.name = name;
    if (email !== profile?.email) payload.email = email;
    if (gender !== profile?.gender) payload.gender = gender;
    if (birthDate !== profile?.birth_date) payload.birth_date = birthDate;
    if (dia !== profile?.diabetes_type) payload.diabetes_type = dia;
    if (!Object.keys(payload).length) { setMsgUpd("Изменений нет."); return; }
    setLoadingUpd(true); setMsgUpd("");
    try {
      const res = await authUpdate(payload);
      if (res?.data?.challenge_id) {
        setVerifyCtx({ challengeId: res.data.challenge_id, email: payload.email || email });
        setMsgUpd("Отправлен код подтверждения.");
      } else if (res.ok) {
        setMsgUpd("Данные обновлены.");
        await onProfileReload?.();
      } else if (res.status === 422) {
        const msg = Array.isArray(res.data?.detail) ? res.data.detail.map((e) => e?.msg).filter(Boolean).join("; ") : "Проверьте корректность полей.";
        setMsgUpd(msg);
      } else {
        setMsgUpd(`Ошибка: ${res.status}`);
      }
    } catch {
      setMsgUpd("Ошибка сети. Повторите попытку.");
    } finally {
      setLoadingUpd(false);
    }
  };

    const handleVerify = async (code) => {
      if (!verifyCtx) return { ok: false, msg: "Нет кода" };
      try {
        const res = await authUpdateVerify(verifyCtx.challengeId, code);
        if (res.ok) {
          await onProfileReload?.();
          setVerifyCtx(null);
          setMsgUpd("E-mail подтверждён.");
          return { ok: true };
        }
        const msg = Array.isArray(res.data?.detail) ? res.data.detail.map((e) => e?.msg).filter(Boolean).join("; ") : `Ошибка: ${res.status}`;
        return { ok: false, msg };
      } catch {
        return { ok: false, msg: "Ошибка сети. Повторите попытку." };
      }
    };

    const handleResend = async () => {
      try {
        const res = await authUpdateResend(verifyCtx?.challengeId);
        if (res?.data?.challenge_id) {
          setVerifyCtx((v) => ({ ...(v || {}), challengeId: res.data.challenge_id }));
          return { ok: true };
        }
        const msg = Array.isArray(res.data?.detail) ? res.data.detail.map((e) => e?.msg).filter(Boolean).join("; ") : `Ошибка: ${res.status}`;
        return { ok: false, msg };
      } catch {
        return { ok: false, msg: "Ошибка сети. Повторите попытку." };
      }
    };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await onChangePassword(oldPass, newPass);
    setMsg(res.msg);
    setLoading(false);
  };

  return React.createElement("div", { className: "space-y-6 w-full" },
    React.createElement(SectionCard, { title: "Изменение учётных данных" },
      React.createElement("form", { className: "space-y-5", onSubmit: handleProfileUpdate },
        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "Имя"),
            React.createElement("input", {
              value: name,
              onChange: (e) => setName(e.target.value),
              className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800"
            })
          ),
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "E-mail"),
            React.createElement("input", {
              type: "email",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800"
            })
          ),
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "Пол"),
            React.createElement("select", {
              value: gender,
              onChange: (e) => setGender(e.target.value),
              className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800"
            },
              React.createElement("option", { value: "" }, "—"),
              React.createElement("option", { value: "male" }, "Мужской"),
              React.createElement("option", { value: "female" }, "Женский")
            )
          ),
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "Дата рождения"),
            React.createElement("input", {
              type: "date",
              value: birthDate || "",
              onChange: (e) => setBirthDate(e.target.value),
              className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800"
            })
          ),
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "Тип диабета"),
            React.createElement("select", {
              value: dia,
              onChange: (e) => setDia(e.target.value),
              className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800"
            },
              React.createElement("option", { value: "type1" }, "Тип 1"),
              React.createElement("option", { value: "type2" }, "Тип 2"),
              React.createElement("option", { value: "gestational" }, "Гестационный")
            )
          )
        ),
        msgUpd && React.createElement("div", { className: "text-base text-slate-600 dark:text-slate-400" }, msgUpd),
        React.createElement("div", { className: "flex items-center justify-end" },
          React.createElement("button", { disabled: loadingUpd, className: "rounded-xl bg-slate-900 text-white px-6 h-12 text-base font-semibold hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600" }, loadingUpd ? "Обновляем…" : "Обновить")
        )
      )
    ),
    React.createElement(SectionCard, { title: "Смена пароля" },
      React.createElement("form", { className: "space-y-5", onSubmit: handleSubmit },
        React.createElement("p", { className: "text-base text-slate-600 dark:text-slate-400" }, "Рекомендуем менять пароль раз в 6–12 месяцев."),
        React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "Текущий пароль"),
            React.createElement("div", { className: "relative" },
              React.createElement("input", {
                type: showOld ? "text" : "password",
                autoComplete: "current-password",
                value: oldPass,
                onChange: (e) => setOldPass(e.target.value),
                placeholder: "Введите текущий пароль",
                className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800 pr-12"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowOld((v) => !v),
                "aria-label": showOld ? "Скрыть пароль" : "Показать пароль",
                title: showOld ? "Скрыть пароль" : "Показать пароль",
                className: "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              }, showOld ? "🙈" : "👁️")
            )
          ),
          React.createElement("div", { className: "flex flex-col gap-2" },
            React.createElement("label", { className: "text-base font-medium text-slate-700 dark:text-slate-300" }, "Новый пароль"),
            React.createElement("div", { className: "relative" },
              React.createElement("input", {
                type: showNew ? "text" : "password",
                autoComplete: "new-password",
                value: newPass,
                onChange: (e) => setNewPass(e.target.value),
                placeholder: "Введите новый пароль",
                className: "w-full rounded-xl border border-slate-300 dark:border-slate-600 px-4 h-14 text-base outline-none focus:ring-2 focus:ring-indigo-100 bg-white dark:bg-slate-800 pr-12"
              }),
              React.createElement("button", {
                type: "button",
                onClick: () => setShowNew((v) => !v),
                "aria-label": showNew ? "Скрыть пароль" : "Показать пароль",
                title: showNew ? "Скрыть пароль" : "Показать пароль",
                className: "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              }, showNew ? "🙈" : "👁️")
            )
          )
        ),
        msg && React.createElement("div", { className: "text-base text-slate-600 dark:text-slate-400" }, msg),
        React.createElement("div", { className: "flex items-center justify-end" },
          React.createElement("button", { disabled: loading, className: "rounded-xl bg-slate-900 text-white px-6 h-12 text-base font-semibold hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600" }, loading ? "Обновляем…" : "Обновить")
        )
      )
    ),
    React.createElement(SectionCard, null,
      React.createElement(DangerLink, { onClick: () => setOpenDelete(true) }, "Удалить аккаунт")
    ),
    React.createElement(DeleteAccountModal, {
      open: openDelete,
      onClose: () => setOpenDelete(false),
      onSubmit: async (login, pass) => {
        const r = await onDeleteAccount(login, pass);
        if (r?.ok) return { ok: true };
        return r;
      },
      defaultLogin: username || ""
    }),
    React.createElement(VerifyEmailModal, {
      open: !!verifyCtx,
      email: verifyCtx?.email,
      onClose: () => setVerifyCtx(null),
      onSubmit: handleVerify,
      onResend: handleResend
    })
  );
}

/* ===================== Устройства ===================== */
export function DevicesPanel({ devices, onRevoke, onDelete }) {
  return React.createElement("div", { className: "space-y-4" },
      React.createElement(SectionCard, { title: "Устройства", footer: React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, "Всего устройств: ", devices.length) },
      React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3" },
        devices.map((dev) => {
          const disableDelete = devices.length === 1 && dev.is_premium;
          return React.createElement(DeviceItem, { key: dev.device_id, device: dev, onRevoke, onDelete, disableDelete });
        })
      )
    )
  );
}

export function PaymentsPanel() {
  const [payments, setPayments] = useState(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authPaymentsList();
        // API: HTTP 200 -> JSON-массив платежей (а не { payments: [...] })
        const list = Array.isArray(res?.data) ? res.data
                    : Array.isArray(res?.data?.payments) ? res.data.payments
                    : [];
        const sorted = list.slice().sort((a, b) => {
          const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
          return db - da;
        });
        if (!cancelled) setPayments(res?.ok ? sorted : []);
      } catch (e) {
        console.error("payments load failed", e);
        if (!cancelled) setPayments([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const content = payments === null
    ? React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, "Загружаем…")
    : payments.length === 0
      ? React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, "Платежи не найдены.")
      : React.createElement("div", { className: "overflow-x-auto" },
          React.createElement("table", { className: "min-w-full text-sm" },
            React.createElement("thead", { className: "text-left text-slate-500 dark:text-slate-400" },
              React.createElement("tr", null,
                ["Наименование", "Номер заказа", "Сумма", "Валюта", "Статус", "Создано"].map((h) =>
                  React.createElement("th", { key: h, className: "px-3 py-2 whitespace-nowrap" }, h)
                )
              )
            ),
            React.createElement("tbody", { className: "divide-y divide-slate-200 dark:divide-slate-700" },
              payments.map((p) =>
                React.createElement(
                  "tr",
                  { key: p.order_id || p.payment_id },
                  React.createElement("td", { className: "px-3 py-2 whitespace-nowrap" }, p.subscription_plan_name || "—"),
                  React.createElement("td", { className: "px-3 py-2 whitespace-nowrap font-mono text-xs" }, p.order_id || "—"),
                  React.createElement("td", { className: "px-3 py-2 whitespace-nowrap" }, formatRub(p.amount_rub ?? 0)),
                  React.createElement("td", { className: "px-3 py-2 whitespace-nowrap" }, p.currency || "—"),
                  React.createElement("td", { className: "px-3 py-2 whitespace-nowrap" }, p.status || "—"),
                  React.createElement("td", { className: "px-3 py-2 whitespace-nowrap" }, p.created_at ? fmtDateTime(p.created_at) : "—")
                )
              )
            )
          )
        );

  return React.createElement("div", { className: "w-full" },
    React.createElement(SectionCard, { title: "Оплаты" }, content)
  );
}

