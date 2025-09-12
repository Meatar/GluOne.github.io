// helpers.js
export function formatRub(n) { return new Intl.NumberFormat("ru-RU").format(n); }

export const maskEmail = (em) => em && typeof em === "string" ? em : "—";

export const ageFrom = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d)) return null;
  const n = new Date();
  let age = n.getUTCFullYear() - d.getUTCFullYear();
  const m = n.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < d.getUTCDate())) age--;
  return age;
};

export const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString("ru-RU", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso || "—";
  }
};

export const fmtDateTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso || "—";
  }
};

export const mapGender = (g) => ({ male: "Мужской", female: "Женский" })[g] || "—";
export const mapDia    = (t) => ({ type1: "Тип 1", type2: "Тип 2", gestational: "Гестационный" })[t] || "—";

export const mapPaymentStatus = (s) => ({
  NEW: "Создан",
  FORM_SHOWED: "Форма оплаты открыта",
  AUTHORIZING: "Авторизация",
  "3DS_CHECKING": "Проверка 3-D Secure",
  "3DS_CHECKED": "3-D Secure пройден",
  AUTHORIZED: "Средства зарезервированы",
  PAY_CHECKING: "Платёж проверяется",
  CONFIRMING: "Подтверждение",
  CONFIRMED: "Оплачено",
  REVERSING: "Отмена",
  PARTIAL_REVERSED: "Частично отменён",
  REVERSED: "Отменён",
  REFUNDING: "Возврат",
  PARTIAL_REFUNDED: "Частичный возврат",
  REFUNDED: "Возврат завершён",
  CANCELED: "Отменён",
  DEADLINE_EXPIRED: "Истёк срок оплаты",
  REJECTED: "Отклонён",
  AUTH_FAIL: "Ошибка авторизации"
}[s] || s);
