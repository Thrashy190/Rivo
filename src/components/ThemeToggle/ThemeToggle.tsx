import { useTheme, type Theme } from "../../hooks/useTheme";
import { SunIcon, MoonIcon, MonitorIcon } from "../icons";

const OPTIONS: { value: Theme; icon: React.ReactNode; label: string }[] = [
  { value: "light",  icon: <SunIcon className="w-3.5 h-3.5" />,     label: "Light"  },
  { value: "system", icon: <MonitorIcon className="w-3.5 h-3.5" />, label: "System" },
  { value: "dark",   icon: <MoonIcon className="w-3.5 h-3.5" />,    label: "Dark"   },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center gap-0.5 bg-raised rounded-lg p-0.5"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.label}
          onClick={() => setTheme(opt.value)}
          className={[
            "flex items-center justify-center w-7 h-7 rounded-md transition-colors",
            theme === opt.value
              ? "bg-card text-ink shadow-sm"
              : "text-ink-dim hover:text-ink",
          ].join(" ")}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
