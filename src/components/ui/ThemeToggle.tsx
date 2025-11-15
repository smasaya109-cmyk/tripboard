"use client";

import { useTheme } from "@/components/ThemeProvider";

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={toggleTheme}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
        isDark ? "bg-slate-800" : "bg-slate-300"
      }`}
    >
      <div className="absolute inset-0 flex items-center justify-between px-1 text-[10px] text-slate-100/80">
        <span className={isDark ? "opacity-40" : "opacity-100"}>☀︎</span>
        <span className={isDark ? "opacity-100" : "opacity-40"}>☾</span>
      </div>
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          isDark ? "translate-x-6" : "translate-x-1"
        }`}
      />
      <span className="sr-only">ライト / ダークテーマの切り替え</span>
    </button>
  );
};
