import { useState } from "react";

// ─── Token types ──────────────────────────────────────────────────────────────

type TokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "whitespace";


const tokenColors: Record<TokenType, string> = {
  key:        "text-indigo-400",
  string:     "text-emerald-400",
  number:     "text-amber-400",
  boolean:    "text-sky-400",
  null:       "text-rose-400",
  punctuation:"text-ink-dim",
  whitespace: "",
};

// ─── Recursive renderer ───────────────────────────────────────────────────────

function JsonNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const indent = "  ".repeat(depth);
  const innerIndent = "  ".repeat(depth + 1);

  if (value === null) {
    return <span className={tokenColors.null}>null</span>;
  }

  if (typeof value === "boolean") {
    return <span className={tokenColors.boolean}>{value ? "true" : "false"}</span>;
  }

  if (typeof value === "number") {
    return <span className={tokenColors.number}>{value}</span>;
  }

  if (typeof value === "string") {
    return <span className={tokenColors.string}>"{value}"</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className={tokenColors.punctuation}>[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-ink-dim hover:text-ink transition-colors"
        >
          {collapsed ? "▶" : "▼"}
        </button>
        <span className={tokenColors.punctuation}>[</span>
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="text-ink-dim text-[10px] mx-1 px-1 rounded bg-raised hover:bg-edge transition-colors"
          >
            {value.length} items
          </button>
        ) : (
          <>
            {"\n"}
            {value.map((item, i) => (
              <span key={i} className="block">
                {innerIndent}
                <JsonNode value={item} depth={depth + 1} />
                {i < value.length - 1 && <span className={tokenColors.punctuation}>,</span>}
              </span>
            ))}
            {indent}
          </>
        )}
        <span className={tokenColors.punctuation}>]</span>
      </span>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className={tokenColors.punctuation}>{"{}"}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-ink-dim hover:text-ink transition-colors mr-0.5"
        >
          {collapsed ? "▶" : "▼"}
        </button>
        <span className={tokenColors.punctuation}>{"{"}</span>
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="text-ink-dim text-[10px] mx-1 px-1 rounded bg-raised hover:bg-edge transition-colors"
          >
            {entries.length} keys
          </button>
        ) : (
          <>
            {"\n"}
            {entries.map(([k, v], i) => (
              <span key={k} className="block">
                {innerIndent}
                <span className={tokenColors.key}>"{k}"</span>
                <span className={tokenColors.punctuation}>: </span>
                <JsonNode value={v} depth={depth + 1} />
                {i < entries.length - 1 && <span className={tokenColors.punctuation}>,</span>}
              </span>
            ))}
            {indent}
          </>
        )}
        <span className={tokenColors.punctuation}>{"}"}</span>
      </span>
    );
  }

  return <span className="text-ink-dim">{String(value)}</span>;
}

// ─── Public component ─────────────────────────────────────────────────────────

interface JsonViewerProps {
  data: unknown;
  /** Max height of the scrollable area */
  maxHeight?: string;
}

export function JsonViewer({ data, maxHeight = "60vh" }: JsonViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge/60 shrink-0">
        <span className="text-[10px] font-semibold text-ink-dim uppercase tracking-widest">
          InfraModel JSON
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-ink-dim hover:text-ink transition-colors px-2 py-1 rounded hover:bg-raised"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Tree */}
      <div
        className="overflow-auto px-4 py-4"
        style={{ maxHeight }}
      >
        <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap select-text">
          <JsonNode value={data} depth={0} />
        </pre>
      </div>
    </div>
  );
}
