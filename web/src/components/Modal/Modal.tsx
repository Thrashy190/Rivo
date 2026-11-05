import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** sm=480 md=640 lg=800 xl=1024 */
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

export function Modal({ open, onClose, title, size = "md", children }: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isAnimating = useRef(false);

  const animateClose = () => {
    if (isAnimating.current) return;
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.15 });
    gsap.to(panelRef.current, {
      opacity: 0, y: 10, scale: 0.97,
      duration: 0.15, ease: "power2.in",
      onComplete: onClose,
    });
  };

  // Animate in
  useEffect(() => {
    if (!open) return;
    isAnimating.current = true;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18 });
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: 16, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power2.out", onComplete: () => { isAnimating.current = false; } }
    );
  }, [open]);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") animateClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, animateClose]);

  // Scroll lock
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={animateClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-full bg-popover border border-edge rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden",
          sizeClasses[size],
        ].join(" ")}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-edge/60 shrink-0">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button
              onClick={animateClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
            >
              <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
