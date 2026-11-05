import { useSnackbar, type Snack, type SnackbarType } from "../../context/SnackbarContext";

const ICONS: Record<SnackbarType, string> = {
  success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  error:   "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  info:    "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

const COLORS: Record<SnackbarType, string> = {
  success: "text-emerald-400",
  error:   "text-red-400",
  warning: "text-amber-400",
  info:    "text-blue-400",
};

const BG: Record<SnackbarType, string> = {
  success: "border-emerald-800/60",
  error:   "border-red-800/60",
  warning: "border-amber-800/60",
  info:    "border-blue-800/60",
};

function SnackItem({ snack }: { snack: Snack }) {
  const { dismiss } = useSnackbar();

  return (
    <div
      className={`flex items-start gap-3 w-80 bg-zinc-900 border ${BG[snack.type]} rounded-lg px-4 py-3 shadow-xl`}
      role="alert"
    >
      <svg
        className={`w-5 h-5 shrink-0 mt-0.5 ${COLORS[snack.type]}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[snack.type]} />
      </svg>

      <p className="flex-1 text-sm text-zinc-200 leading-snug">{snack.message}</p>

      <button
        onClick={() => dismiss(snack.id)}
        className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function SnackbarContainer() {
  const { snacks } = useSnackbar();

  if (snacks.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {snacks.map((snack) => (
        <div key={snack.id} className="pointer-events-auto">
          <SnackItem snack={snack} />
        </div>
      ))}
    </div>
  );
}
