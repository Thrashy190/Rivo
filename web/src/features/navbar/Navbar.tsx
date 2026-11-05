import { Link, useLocation } from "react-router";
import { RivoLogo } from "../../components/icons";

const navItems = [
  { label: "Projects", to: "/projects" },
  { label: "Docs", to: "/docs" },
];

export function Navbar() {
  const location = useLocation();

  return (
    <header className="h-12 border-b border-edge/60 flex items-center px-6 gap-8 sticky top-0 z-50 bg-page/90 backdrop-blur-md">
      <Link to="/projects" className="flex items-center gap-2 shrink-0">
        <RivoLogo className="w-6 h-6" />
        <span className="text-sm font-semibold tracking-tight">Rivo</span>
      </Link>

      <nav className="flex items-center gap-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                isActive ? "text-ink" : "text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button className="flex items-center gap-2.5 group">
        <div className="w-7 h-7 rounded-full bg-raised border border-edge flex items-center justify-center text-xs font-medium text-ink select-none group-hover:border-edge transition-colors">
          J
        </div>
        <span className="text-sm text-ink-dim group-hover:text-ink transition-colors hidden sm:block">
          Jane Smith
        </span>
      </button>
    </header>
  );
}
