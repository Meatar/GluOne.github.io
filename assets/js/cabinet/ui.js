// ui.js

export function Chip({ children }) {
  return React.createElement(
    "span",
    {
      className:
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium bg-white/60 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600",
    },
    children
  );
}

export function RowButton({ icon, children, onClick }) {
  return React.createElement(
    "button",
    {
      onClick,
      className:
        "w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50 border border-transparent hover:border-slate-200 transition dark:hover:bg-slate-700 dark:hover:border-slate-600",
    },
    React.createElement("span", { className: "text-slate-500 dark:text-slate-400" }, icon),
    React.createElement("span", { className: "text-slate-800 font-medium dark:text-slate-100" }, children)
  );
}

export function SectionCard({ title, children, footer }) {
  return React.createElement(
    "div",
    { className: "w-full rounded-2xl border bg-white shadow-sm border-slate-200 dark:bg-slate-800 dark:border-slate-700" },
    title &&
      React.createElement(
        "div",
        { className: "px-5 py-4 border-b border-slate-200/60 text-sm font-semibold text-slate-800 dark:border-slate-700/60 dark:text-slate-100" },
        title
      ),
    React.createElement("div", { className: "p-5" }, children),
    footer &&
      React.createElement("div", { className: "px-5 py-4 border-t border-slate-200/60" }, footer)
  );
}

/**
 * Широкие ряды: сетка (лейбл | значение) с широкой правой колонкой.
 * Значение переносится по словам/символам, чтобы длинные строки не сжимали карточку.
 */
export function KeyRow({ label, value }) {
  return React.createElement(
    "div",
    {
      className: "grid grid-cols-[minmax(140px,220px)_1fr] gap-3 items-baseline py-2",
    },
    React.createElement("div", { className: "text-sm text-slate-500 dark:text-slate-400" }, label),
    React.createElement(
      "div",
      { className: "text-sm font-medium text-slate-800 break-words dark:text-slate-100" },
      value
    )
  );
}

export function DangerLink({ children, onClick }) {
  return React.createElement(
    "button",
    {
      onClick,
      className:
        "w-full text-sm font-medium text-rose-600 hover:text-rose-700 px-2 py-2 rounded-lg text-left dark:text-rose-400 dark:hover:text-rose-300",
    },
    children
  );
}
