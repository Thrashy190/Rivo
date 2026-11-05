interface AvatarProps {
  /** Single letter or initials shown inside the avatar */
  initials: string;
  /** Image URL — if provided, shown instead of initials */
  src?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  /** Highlight the avatar (e.g. when its menu is open) */
  active?: boolean;
}

const sizeClasses = {
  sm: "w-7 h-7 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

export function Avatar({ initials, src, size = "md", onClick, active }: AvatarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border flex items-center justify-center font-medium select-none transition-colors shrink-0 overflow-hidden",
        sizeClasses[size],
        active
          ? "border-zinc-500 bg-raised"
          : "border-edge bg-raised hover:border-edge",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      {src ? (
        <img src={src} alt={initials} className="w-full h-full object-cover" />
      ) : (
        <span className="text-ink">{initials}</span>
      )}
    </button>
  );
}
