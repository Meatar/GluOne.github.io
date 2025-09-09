// layout.js
const { useState } = React;

export function UserMenu({ isAuthed, userName = "", onLogout }) {
  const [open, setOpen] = useState(false);
  const initial = userName?.[0]?.toUpperCase() || "U";
  const handleClick = () => {
    if (!isAuthed) { window.location.href = "https://gluone.ru/auth.html"; return; }
    setOpen((v) => !v);
  };
  return React.createElement("div", { className: "relative" },
    React.createElement("button", {
      onClick: handleClick,
      "aria-haspopup": isAuthed ? "menu" : void 0,
      "aria-expanded": open,
      className: `flex items-center justify-center rounded-full h-9 ${isAuthed ? "w-9 bg-slate-100 text-slate-800 hover:bg-slate-200" : "px-3 bg-slate-100 text-slate-900 hover:bg-slate-200 rounded-full"} border border-slate-200 text-sm font-medium`,
      title: isAuthed ? "Аккаунт" : "Войти"
    }, isAuthed ? React.createElement("span", { className: "font-semibold" }, initial) : React.createElement("span", null, "Войти")),
    isAuthed && open && React.createElement("div", { role: "menu", className: "absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1" },
      React.createElement("div", { className: "px-3 py-2 text-xs text-slate-500" }, userName),
      React.createElement("button", { onClick: () => { setOpen(false); onLogout(); }, className: "w-full text-left px-3 py-2 text-sm hover:bg-slate-50" }, "Выйти")
    )
  );
}

export function SiteHeader({ isAuthed, onLogout, userName }) {
  return React.createElement("header", { className: "sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur" },
    React.createElement("div", { className: "mx-auto max-w-screen-2xl px-5 h-14 flex items-center justify-between" },
      React.createElement("div", { className: "flex items-center gap-3" },
        React.createElement("img", { src: "assets/image/logo.png", className: "h-9 w-9 rounded-xl", alt: "GluOne logo", width: "36", height: "36" }),
        React.createElement("span", { className: "font-semibold text-slate-900" }, "GluOne")
      ),
      React.createElement("nav", { className: "hidden md:flex items-center gap-6 text-sm text-slate-600" },
        React.createElement("a", { className: "hover:text-slate-900", href: "https://gluone.ru" }, "Главная"),
        React.createElement("a", { className: "hover:text-slate-900", href: "#" }, "Поддержка")
      ),
      React.createElement("div", { className: "flex items-center gap-3" },
        React.createElement(UserMenu, { isAuthed, userName, onLogout })
      )
    )
  );
}

export function Sidebar({ current, onChange }) {
  const Item = ({ k, label, icon }) => React.createElement("button", {
    onClick: () => onChange(k),
    className: `w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${current === k ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700"}`
  }, React.createElement("span", { className: "text-base" }, icon), React.createElement("span", { className: "font-medium" }, label));
  return React.createElement("aside", { className: "hidden xl:block w-64 shrink-0" },
    React.createElement("div", { className: "sticky top-16 space-y-1" },
      React.createElement(Item, { k: "profile", label: "Профиль", icon: "👤" }),
      React.createElement(Item, { k: "subscription", label: "Подписка", icon: "💎" }),
      React.createElement(Item, { k: "security", label: "Безопасность", icon: "🔐" }),
      React.createElement(Item, { k: "devices", label: "Устройства", icon: "📱" })
    )
  );
}
