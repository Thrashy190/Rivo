import { createContext, useContext, useRef, useState, type ReactNode } from "react";

export type SnackbarType = "success" | "error" | "info" | "warning";

export interface Snack {
  id:      string;
  message: string;
  type:    SnackbarType;
}

interface SnackbarContextValue {
  snacks:  Snack[];
  push:    (message: string, type?: SnackbarType) => void;
  dismiss: (id: string) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setSnacks((prev) => prev.filter((s) => s.id !== id));
  };

  const push = (message: string, type: SnackbarType = "info") => {
    const id = crypto.randomUUID();
    setSnacks((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => dismiss(id), 5000);
    timers.current.set(id, timer);
  };

  return (
    <SnackbarContext.Provider value={{ snacks, push, dismiss }}>
      {children}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used inside <SnackbarProvider>");
  return ctx;
}
