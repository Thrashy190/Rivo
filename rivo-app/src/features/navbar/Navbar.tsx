import { Link, useLocation } from "react-router";
import { RivoLogo } from "../../components/icons";

const navItems = [
  { label: "Projects", to: "/projects" },
  { label: "Docs", to: "/docs" },
];

export function Navbar() {
  const location = useLocation();

  return (
    <header className="h-12 border-b border-zinc-800/60 flex items-center px-6 gap-8 sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md">
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
                isActive ? "text-white" : "text-zinc-500 hover:text-zinc-200",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button className="flex items-center gap-2.5 group">
        <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300 select-none group-hover:border-zinc-600 transition-colors">
          J
        </div>
        <span className="text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors hidden sm:block">
          Jane Smith
        </span>
      </button>
    </header>
  );
}
