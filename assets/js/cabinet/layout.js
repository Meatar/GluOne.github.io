// layout.js
const { useState } = React;

export function UserMenu({ isAuthed, userName = "", onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = userName?.[0]?.toUpperCase() || "U";

  const handleClick = () => {
    if (!isAuthed) {
      window.location.href = "https://gluone.ru/auth";
      return;
    }
    setOpen((v) => !v);
  };

  return React.createElement(
    "div",
    { className: "relative" },
    React.createElement(
      "button",
      {
        onClick: handleClick,
        "aria-haspopup": isAuthed ? "menu" : void 0,
        "aria-expanded": open,
        className: `flex items-center justify-center rounded-full h-9 ${
          isAuthed
            ? "w-9 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            : "px-3 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-full dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        } border border-slate-200 dark:border-slate-700 text-sm font-medium`,
        title: isAuthed ? "Аккаунт" : "Войти",
      },
      isAuthed
        ? React.createElement("span", { className: "font-semibold" }, initial)
        : React.createElement("span", null, "Войти")
    ),
    isAuthed &&
      open &&
      React.createElement(
        "div",
        {
          role: "menu",
          className:
            "absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1 dark:border-slate-700 dark:bg-slate-800",
        },
        React.createElement(
          "div",
          { className: "px-3 py-2 text-xs text-slate-500 dark:text-slate-400" },
          userName
        ),
        React.createElement(
          "button",
          {
            onClick: () => {
              setOpen(false);
              onLogout();
            },
            className:
              "w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700",
          },
          "Выйти"
        )
      )
  );
}

export function SiteHeader({ isAuthed, onLogout, userName }) {
  return React.createElement(
    "header",
    {
      className:
        "sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90",
    },
    React.createElement(
      "div",
      { className: "mx-auto max-w-screen-2xl px-5 h-14 flex items-center justify-between" },
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            window.location.href = "https://gluone.ru/";
          },
          className:
            "flex items-center gap-3 rounded-xl px-2 py-1 text-left text-slate-900 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900/20 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-slate-100/30",
        },
        React.createElement("img", {
          src: "assets/image/logo.png",
          className: "h-9 w-9 rounded-xl",
          alt: "GluOne logo",
          width: "36",
          height: "36",
        }),
        React.createElement(
          "span",
          { className: "font-semibold" },
          "GluOne"
        )
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(UserMenu, { isAuthed, userName, onLogout })
      )
    )
  );
}

const DEFAULT_SIDEBAR_ITEMS = [
  { key: "profile", label: "Профиль", icon: "👤" },
  { key: "subscription", label: "Подписка", icon: "💎" },
  { key: "security", label: "Безопасность", icon: "🔐" },
  { key: "devices", label: "Устройства", icon: "📱" },
  { key: "payments", label: "Оплаты", icon: "💳" }
];

export function Sidebar({ current, onChange, items = DEFAULT_SIDEBAR_ITEMS }) {
  const nav = Array.isArray(items) && items.length ? items : DEFAULT_SIDEBAR_ITEMS;

  const Item = ({ itemKey, label, icon }) =>
    React.createElement(
      "button",
      {
        onClick: () => onChange(itemKey),
        className: `w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
          current === itemKey
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-100"
            : "hover:bg-slate-50 text-slate-700 dark:hover:bg-slate-700 dark:text-slate-300"
        }`,
      },
      React.createElement("span", { className: "text-base" }, icon),
      React.createElement("span", { className: "font-medium" }, label)
    );

  return React.createElement(
    "aside",
    { className: "cab-sidebar w-64 shrink-0" },
    React.createElement(
      "div",
      { className: "sticky top-16 space-y-1" },
      nav.map(({ key, label, icon }) =>
        React.createElement(Item, { key, itemKey: key, label, icon })
      )
    )
  );
}

