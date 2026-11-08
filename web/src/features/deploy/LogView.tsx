import { useEffect, useRef } from "react";

// The engine's log. It follows new lines while the reader is at the bottom.
export function LogView({ log, live }: { log: string; live: boolean }) {
  const ref = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <pre
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      aria-live={live ? "polite" : undefined}
      className="h-full overflow-auto rounded-lg border border-edge bg-card/60 p-3 text-[11px] leading-[1.55] font-mono text-ink whitespace-pre-wrap break-words"
    >
      {log ? colorize(log) : <span className="text-ink-dim">{live ? "Waiting for the engine to start…" : "No log."}</span>}
      {live && <span className="inline-block w-1.5 h-3 align-middle bg-ink-dim/60 animate-pulse ml-0.5" />}
    </pre>
  );
}

function colorize(log: string) {
  return log.split("\n").map((line, i) => {
    let cls = "";
    if (line.startsWith("$ ")) cls = "text-indigo-600 dark:text-indigo-400 font-semibold";
    else if (/^\s*(Error|│ Error)/.test(line) || line.includes("failed")) cls = "text-red-600 dark:text-red-400";
    else if (/^\s*[+]/.test(line) || /: Creation complete|Apply complete/.test(line)) cls = "text-emerald-600 dark:text-emerald-400";
    else if (/^\s*[-]/.test(line) || /Destroying|Destruction complete/.test(line)) cls = "text-red-600/90 dark:text-red-400/90";
    else if (/^\s*~/.test(line) || /Modifying/.test(line)) cls = "text-amber-600 dark:text-amber-400";
    else if (line.startsWith("Note:") || line.startsWith("Warning")) cls = "text-ink-dim";
    return (
      <span key={i} className={cls}>
        {line}
        {"\n"}
      </span>
    );
  });
}
