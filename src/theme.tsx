import { create } from "zustand";
import { Sun, Moon } from "lucide-react";
import { motion } from "motion/react";
const initial =
  localStorage.getItem("theme") ||
  (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
document.documentElement.dataset.theme = initial;
export const useTheme = create<{
  theme: string;
  setTheme: (theme: string) => void;
}>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    localStorage.setItem("theme", theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
}));
export function ThemeControl() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-control" role="group" aria-label="Color theme">
      {(["light", "dark"] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-label={`${value === "light" ? "Light" : "Dark"} theme`}
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
        >
          {theme === value && (
            <motion.span
              className="theme-selected"
              layoutId="theme-selection"
              transition={{ type: "spring", bounce: 0, duration: 0.2 }}
            />
          )}
          {value === "light" ? <Sun size={15} /> : <Moon size={15} />}
          <span>{value === "light" ? "Light" : "Dark"}</span>
        </button>
      ))}
    </div>
  );
}
