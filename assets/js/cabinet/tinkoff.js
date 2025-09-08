// tinkoff.js
const { useState, useEffect } = React;

export const TINKOFF_SCRIPT_SRC = "https://securepay.tinkoff.ru/html/payForm/js/tinkoff_v2.js";
export const TINKOFF_TERMINAL_KEY = "1756472050322DEMO"; // demo key
const AMOUNT_IN_KOPECKS = false;

export function gatewayAmountString(amountRub) {
  const value = AMOUNT_IN_KOPECKS ? amountRub * 100 : amountRub;
  return String(value);
}

export function buildTinkoffForm(params) {
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

export function useTinkoffScript() {
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

  return { ready, error, openPayForm };
}
