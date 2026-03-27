import { useEffect, useRef } from "react";

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}

export interface DropdownMenuSection {
  heading?: string;
  /** Standard clickable items */
  items?: DropdownMenuItem[];
  /** Custom content rendered instead of (or alongside) items */
  content?: React.ReactNode;
}

interface DropdownMenuProps {
  sections: DropdownMenuSection[];
  align?: "left" | "right";
  onClose: () => void;
  header?: React.ReactNode;
}

export function DropdownMenu({ sections, align = "right", onClose, header }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      className={[
        "absolute top-full mt-2 z-50 min-w-[200px] rounded-xl border border-edge bg-popover shadow-xl shadow-black/20 py-1.5 overflow-hidden",
        align === "right" ? "right-0" : "left-0",
      ].join(" ")}
    >
      {header && (
        <div className="px-3 py-2.5 border-b border-edge/60 mb-1">{header}</div>
      )}

      {sections.map((section, si) => (
        <div key={si}>
          {si > 0 && <div className="my-1 border-t border-edge/60" />}

          {section.heading && (
            <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-ink-dim uppercase tracking-widest">
              {section.heading}
            </p>
          )}

          {section.content && (
            <div className="px-3 py-1.5">{section.content}</div>
          )}

          {section.items?.map((item, ii) => (
            <button
              key={ii}
              role="menuitem"
              type="button"
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={[
                "flex items-center gap-2.5 w-full px-3 py-1.5 text-sm transition-colors text-left",
                item.variant === "danger"
                  ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  : "text-ink/80 hover:bg-card hover:text-ink",
              ].join(" ")}
            >
              {item.icon && (
                <span className="shrink-0 w-4 h-4 flex items-center justify-center opacity-70">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
