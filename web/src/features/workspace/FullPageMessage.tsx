import type { ReactNode } from "react";
import { Link } from "react-router";
import { RivoLogo } from "../../components/icons";

export function FullPageMessage({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 text-center">
      <Link to="/" aria-label="Rivo home" className="mb-6">
        <RivoLogo className="w-10 h-10" />
      </Link>
      <h1 className="text-base font-semibold text-ink">{title}</h1>
      {message && <p className="text-sm text-ink-dim mt-2 max-w-sm leading-relaxed">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
