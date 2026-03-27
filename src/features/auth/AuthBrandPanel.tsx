import type { ReactNode } from "react";
import { RivoLogo } from "../../components/icons";

interface AuthBrandPanelProps {
  tagline: ReactNode;
  description: string;
}

export function AuthBrandPanel({ tagline, description }: AuthBrandPanelProps) {
  return (
    <div className="hidden lg:flex flex-col bg-card border-r border-edge/60 p-12 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="flex items-center gap-2.5 relative">
        <RivoLogo className="w-8 h-8" />
        <span className="text-base font-semibold tracking-tight">rivo</span>
      </div>

      <div className="mt-auto relative">
        <p className="text-2xl font-light text-white/80 leading-snug tracking-tight">
          {tagline}
        </p>
        <p className="mt-4 text-sm text-zinc-500">{description}</p>
      </div>
    </div>
  );
}
