import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { editor, IDisposable, Position } from "monaco-editor";
import { CodeEditor, type CodeLanguage, type OnMount } from "../../../components/CodeEditor/CodeEditor";
import { getServiceIcon } from "../aws-services";
import type { CanvasEdge, CanvasNode } from "../useCanvas";
import { connectedVariables, functionFiles, MAX_FUNCTION_FILES, MAX_INLINE_CODE_BYTES, validFilePath } from "../lambdaSource";
import { formatBytes } from "../../../utils/format";
import { snippetsFor } from "./codeSnippets";

type Family = "python" | "javascript" | "ruby" | "go" | "java";

function runtimeFamily(runtime: string): Family {
  if (runtime.startsWith("python")) return "python";
  if (runtime.startsWith("ruby")) return "ruby";
  if (runtime.startsWith("java")) return "java";
  if (runtime.startsWith("go") || runtime.startsWith("provided")) return "go";
  return "javascript";
}

const EXTENSION: Record<Family, string> = { python: ".py", javascript: ".js", ruby: ".rb", go: ".go", java: ".java" };

// The file the handler points at: app.handler runs app.py, app.js or app.rb,
// as the Terraform generator writes it.
function handlerFile(handler: string, family: Family): string {
  if (family === "go") return "main.go";
  if (family === "java") return "Handler.java";
  const module = handler.includes(".") ? handler.slice(0, handler.lastIndexOf(".")) : "app";
  return `${module}${EXTENSION[family]}`;
}

function languageOf(path: string): CodeLanguage {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, CodeLanguage> = {
    py: "python", js: "javascript", mjs: "javascript", cjs: "javascript", ts: "typescript", rb: "ruby", go: "go", java: "java",
    json: "json", html: "html", htm: "html", css: "css", md: "markdown", yaml: "yaml", yml: "yaml",
  };
  return map[ext] ?? "plaintext";
}

const LANGUAGE_NAMES: Partial<Record<CodeLanguage, string>> = {
  python: "Python", javascript: "JavaScript", typescript: "TypeScript", ruby: "Ruby", go: "Go", java: "Java",
  json: "JSON", html: "HTML", css: "CSS", markdown: "Markdown", yaml: "YAML", plaintext: "Plain text",
};

const STARTER: Record<Family, string> = {
  python: `import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    logger.info(json.dumps({"event": event, "requestId": context.aws_request_id}))
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"message": "Hello from Lambda"}),
    }
`,
  javascript: `exports.handler = async (event) => {
  console.log(JSON.stringify(event));
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello from Lambda" }),
  };
};
`,
  ruby: `require 'json'

def handler(event:, context:)
  puts event.to_json
  { statusCode: 200, body: { message: 'Hello from Lambda' }.to_json }
end
`,
  go: `package main

import (
	"context"

	"github.com/aws/aws-lambda-go/lambda"
)

func handler(ctx context.Context) (map[string]string, error) {
	return map[string]string{"message": "Hello from Lambda"}, nil
}

func main() {
	lambda.Start(handler)
}
`,
  java: `import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;

public class Handler implements RequestHandler<Object, String> {
    @Override
    public String handleRequest(Object input, Context context) {
        return "Hello from Lambda";
    }
}
`,
};

const bytesOf = (files: Record<string, string>) => Object.values(files).reduce((sum, c) => sum + new TextEncoder().encode(c).length, 0);

interface CodeModalProps {
  node: CanvasNode;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  // Roles that cannot change the project read the code without saving it.
  readOnly?: boolean;
  onSave: (code: string, files: Record<string, string>) => void;
  onClose: () => void;
}

// A small VS Code for one function: its files on the left, tabs, Monaco (the
// editor VS Code is built on) with the minimap, the command palette (F1) and
// find and replace, and a status bar.
export function CodeModal({ node, nodes, edges, readOnly = false, onSave, onClose }: CodeModalProps) {
  const runtime = String(node.config.runtime ?? "python3.13");
  const family = runtimeFamily(runtime);
  const main = handlerFile(String(node.config.handler ?? "app.handler"), family);
  const env = useMemo(() => connectedVariables(node, nodes, edges), [node, nodes, edges]);
  const custom = Object.keys((node.config.environment as Record<string, string> | undefined) ?? {});
  const envNames = useMemo(() => [...env.map((v) => v.key), ...custom], [env, custom.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const [initial] = useState<Record<string, string>>(() => {
    const code = typeof node.config.code === "string" && node.config.code !== "" ? node.config.code : STARTER[family];
    return { ...functionFiles(node), [main]: code };
  });
  const [files, setFiles] = useState(initial);
  const [tabs, setTabs] = useState<string[]>([main]);
  const [active, setActive] = useState(main);
  const [cursor, setCursor] = useState({ line: 1, column: 1, selected: 0 });
  const [creating, setCreating] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);

  const paths = Object.keys(files).sort((a, b) => (a === main ? -1 : b === main ? 1 : a.localeCompare(b)));
  const bytes = bytesOf(files);
  const tooBig = bytes > MAX_INLINE_CODE_BYTES;
  const dirty = (p: string) => files[p] !== initial[p];
  const changed = paths.some(dirty) || Object.keys(initial).some((p) => !(p in files)) || node.config.source !== "inline";
  const tabSize = family === "python" || family === "java" ? 4 : 2;

  const keep = () => {
    if (readOnly || tooBig) return;
    const { [main]: code, ...rest } = files;
    onSave(code, rest);
    onClose();
  };
  const keepRef = useRef(keep);
  useEffect(() => {
    keepRef.current = keep;
  });

  const close = () => {
    if (!readOnly && changed && JSON.stringify(files) !== JSON.stringify(initial) && !window.confirm("Close without keeping your changes to the code?")) return;
    onClose();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // Ctrl+S keeps the code here instead of saving the diagram behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopImmediatePropagation();
        keepRef.current();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Completions for the variables and services the function is connected to.
  const disposables = useRef<IDisposable[]>([]);
  const envRef = useRef(envNames);
  useEffect(() => {
    envRef.current = envNames;
  }, [envNames]);
  useEffect(() => () => disposables.current.forEach((d) => d.dispose()), []);

  const onMount: OnMount = (ed: editor.IStandaloneCodeEditor, monaco) => {
    ed.onDidChangeCursorSelection((e) => {
      const s = e.selection;
      const model = ed.getModel();
      setCursor({ line: s.positionLineNumber, column: s.positionColumn, selected: model ? model.getValueInRange(s).length : 0 });
    });
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => keepRef.current());
    ed.focus();
    if (disposables.current.length > 0) return;
    for (const lang of ["python", "javascript"] as const) {
      disposables.current.push(
        monaco.languages.registerCompletionItemProvider(lang, {
          triggerCharacters: ['"', "'"],
          provideCompletionItems: (model: editor.ITextModel, position: Position) => {
            const word = model.getWordUntilPosition(position);
            const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
            const vars = envRef.current.map((name) => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Variable,
              detail: "Environment variable from Rivo",
              insertText: name,
              range,
            }));
            const snippets = snippetsFor(lang, envRef.current).map((s) => ({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              detail: s.detail,
              documentation: s.body,
              insertText: s.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            }));
            return { suggestions: [...vars, ...snippets] };
          },
        }),
      );
    }
  };

  const open = (p: string) => {
    setTabs((t) => (t.includes(p) ? t : [...t, p]));
    setActive(p);
  };
  const closeTab = (p: string) => {
    const next = tabs.filter((t) => t !== p);
    setTabs(next.length ? next : [main]);
    if (active === p) setActive(next[next.length - 1] ?? main);
  };

  const problemFor = (path: string, except?: string) => {
    if (!validFilePath(path)) return "Use letters, digits, '_', '-' and '.', with up to five folders.";
    if (path !== except && path in files) return "There is already a file with that name.";
    if (path === main && except !== main) return "That is the handler's file.";
    return "";
  };

  const createFile = (path: string) => {
    if (problemFor(path)) return;
    setFiles((f) => ({ ...f, [path]: "" }));
    setCreating(null);
    open(path);
  };
  const renameFile = (from: string, to: string) => {
    if (from === to) return setRenaming(null);
    if (problemFor(to, from)) return;
    setFiles((f) => {
      const { [from]: content, ...rest } = f;
      return { ...rest, [to]: content };
    });
    setTabs((t) => t.map((x) => (x === from ? to : x)));
    if (active === from) setActive(to);
    setRenaming(null);
  };
  const deleteFile = (path: string) => {
    if (path === main || !window.confirm(`Delete ${path}?`)) return;
    setFiles((f) => {
      const { [path]: _gone, ...rest } = f; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    });
    closeTab(path);
  };

  const language = languageOf(active);
  const extraCount = paths.length - 1;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Code of ${String(node.config.name ?? node.label)}`} className="fixed inset-0 z-50 flex flex-col bg-page">
      {/* Title bar */}
      <header className="flex items-center gap-3 px-4 h-12 border-b border-edge shrink-0">
        <div className="w-6 h-6 rounded-md overflow-hidden shrink-0">{getServiceIcon(node.type)}</div>
        <p className="text-sm font-semibold text-ink truncate">{String(node.config.name ?? node.label)}</p>
        <span className="text-[10px] font-mono text-ink-dim border border-edge px-1.5 py-0.5 rounded-md shrink-0">{runtime}</span>
        <span className="hidden md:inline text-[11px] text-ink-dim truncate">
          Handler <code className="font-mono text-ink">{String(node.config.handler ?? "app.handler")}</code>
        </span>
        <div className="flex-1" />
        <span className="hidden lg:inline text-[11px] text-ink-dim">F1 commands · Ctrl+F find · Ctrl+Space suggestions</span>
        {readOnly ? (
          <span className="text-[10px] text-ink-dim border border-edge rounded px-1.5 py-0.5 shrink-0">View only</span>
        ) : (
          <button
            onClick={keep}
            disabled={tooBig || !changed}
            title="Keeps the code in the diagram (Ctrl+S). Save the diagram to store it."
            className="px-3 h-8 rounded-lg text-xs font-medium transition-colors shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Use this code
          </button>
        )}
        <button
          aria-label="Close the code editor"
          onClick={close}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Explorer */}
        <aside aria-label="Explorer" className="w-60 shrink-0 border-r border-edge bg-card/40 flex flex-col min-h-0">
          <div className="flex items-center justify-between pl-4 pr-2 h-9 shrink-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim">Files</span>
            {!readOnly && extraCount < MAX_FUNCTION_FILES && (
              <button
                onClick={() => setCreating(family === "python" ? "utils.py" : `utils${EXTENSION[family]}`)}
                aria-label="New file"
                title="New file"
                className="w-6 h-6 rounded-md flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M9 1.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5L9 1.5Z M9 1.5V5h3.5 M8 8v4 M6 10h4" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pb-3">
            {paths.map((p) =>
              renaming?.from === p ? (
                <FileNameInput
                  key={p}
                  value={renaming.to}
                  problem={problemFor(renaming.to, p)}
                  onChange={(to) => setRenaming({ from: p, to })}
                  onDone={() => renameFile(p, renaming.to)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <div
                  key={p}
                  className={[
                    "group flex items-center gap-2 pl-4 pr-1.5 h-7 cursor-pointer text-xs",
                    p === active ? "bg-indigo-500/10 text-ink" : "text-ink-dim hover:bg-raised/60 hover:text-ink",
                  ].join(" ")}
                  onClick={() => open(p)}
                  onDoubleClick={() => !readOnly && p !== main && setRenaming({ from: p, to: p })}
                  title={p === main ? "The handler's file. Change it with the Handler setting." : "Double-click to rename"}
                >
                  <FileIcon path={p} />
                  <span className="font-mono truncate flex-1">{p}</span>
                  {dirty(p) && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-label="Changed" />}
                  {p === main ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-indigo-500 shrink-0 mr-1">handler</span>
                  ) : (
                    !readOnly && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFile(p);
                        }}
                        aria-label={`Delete ${p}`}
                        className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-ink-dim hover:text-red-500 transition"
                      >
                        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                          <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
                        </svg>
                      </button>
                    )
                  )}
                </div>
              ),
            )}
            {creating !== null && (
              <FileNameInput
                value={creating}
                problem={problemFor(creating)}
                onChange={setCreating}
                onDone={() => createFile(creating)}
                onCancel={() => setCreating(null)}
              />
            )}

            <div className="mt-4 mx-4 pt-3 border-t border-edge">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-dim mb-2">Environment</p>
              {envNames.length === 0 ? (
                <p className="text-[11px] leading-snug text-ink-dim">Connect a table or bucket and its name appears here.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {env.map((v) => (
                    <li key={v.key} className="text-[11px] leading-tight" title={`from ${v.from}`}>
                      <code className="font-mono text-ink">{v.key}</code>
                      <span className="block text-ink-dim truncate">{v.from}</span>
                    </li>
                  ))}
                  {custom.map((k) => (
                    <li key={k} className="text-[11px]">
                      <code className="font-mono text-ink">{k}</code>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] leading-snug text-ink-dim">
                {family === "python"
                  ? "boto3 comes with the runtime. Other packages need a .zip."
                  : family === "javascript"
                    ? "The AWS SDK v3 comes with the runtime. Other packages need a .zip."
                    : "Type a name in the editor and press Ctrl+Space for the variables."}
              </p>
            </div>
          </div>
        </aside>

        {/* Editor */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div role="tablist" aria-label="Open files" className="flex items-stretch h-9 border-b border-edge bg-card/40 overflow-x-auto shrink-0">
            {tabs.map((t) => (
              <div
                key={t}
                role="tab"
                aria-selected={t === active}
                onClick={() => setActive(t)}
                onAuxClick={(e) => e.button === 1 && closeTab(t)}
                className={[
                  "group flex items-center gap-2 pl-3 pr-1.5 text-xs border-r border-edge cursor-pointer shrink-0",
                  t === active ? "bg-page text-ink shadow-[inset_0_2px_0_0_var(--color-indigo-500)]" : "text-ink-dim hover:text-ink",
                ].join(" ")}
              >
                <FileIcon path={t} />
                <span className="font-mono">{t}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t);
                  }}
                  aria-label={`Close ${t}`}
                  className="w-5 h-5 rounded flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised"
                >
                  {dirty(t) ? (
                    <span className="w-2 h-2 rounded-full bg-ink-dim group-hover:hidden" />
                  ) : null}
                  <svg viewBox="0 0 10 10" className={["w-2.5 h-2.5", dirty(t) ? "hidden group-hover:block" : ""].join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 px-4 h-6 text-[11px] text-ink-dim shrink-0 font-mono">
            <span>{String(node.config.name ?? "function")}</span>
            {active.split("/").map((part, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-ink-dim/50">›</span>
                <span className={i === active.split("/").length - 1 ? "text-ink" : ""}>{part}</span>
              </span>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            <CodeEditor
              key={family}
              path={`file:///${node.id}/${active}`}
              value={files[active] ?? ""}
              onChange={(v) => setFiles((f) => ({ ...f, [active]: v }))}
              readOnly={readOnly}
              language={language}
              tabSize={tabSize}
              full
              onMount={onMount}
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <footer className="flex items-center gap-4 px-4 h-6 border-t border-edge bg-card/60 text-[11px] text-ink-dim shrink-0 font-mono">
        <span>
          Ln {cursor.line}, Col {cursor.column}
          {cursor.selected > 0 && ` (${cursor.selected} selected)`}
        </span>
        <span>Spaces: {tabSize}</span>
        <span>UTF-8</span>
        <span>{LANGUAGE_NAMES[language] ?? language}</span>
        <div className="flex-1" />
        <span>
          {paths.length} file{paths.length === 1 ? "" : "s"}
        </span>
        <span className={tooBig ? "text-red-500" : ""} title="The code is saved in the diagram">
          {formatBytes(bytes)} / {formatBytes(MAX_INLINE_CODE_BYTES)}
          {tooBig && " · too large: upload a .zip"}
        </span>
      </footer>
    </div>,
    document.body,
  );
}

function FileNameInput({
  value,
  problem,
  onChange,
  onDone,
  onCancel,
}: {
  value: string;
  problem: string;
  onChange: (v: string) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-3 py-1">
      <input
        autoFocus
        aria-label="File name"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          const dot = e.target.value.lastIndexOf(".");
          e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onDone();
          if (e.key === "Escape") {
            e.stopPropagation();
            onCancel();
          }
        }}
        onBlur={() => (problem ? onCancel() : onDone())}
        className={[
          "w-full h-7 rounded-md border bg-page px-2 text-xs font-mono text-ink focus:outline-none",
          problem ? "border-red-500/60" : "border-indigo-500/60",
        ].join(" ")}
      />
      {problem && <p className="mt-1 text-[10px] leading-snug text-red-500">{problem}</p>}
    </div>
  );
}

const ICON_COLORS: Record<string, string> = {
  py: "#3b82f6", js: "#eab308", mjs: "#eab308", ts: "#3b82f6", rb: "#ef4444", go: "#06b6d4", java: "#f97316",
  json: "#a855f7", html: "#f97316", css: "#0ea5e9", md: "#64748b", yaml: "#ef4444", yml: "#ef4444",
};

function FileIcon({ path }: { path: string }) {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="none" stroke={ICON_COLORS[ext] ?? "currentColor"} strokeWidth="1.4" aria-hidden="true">
      <path d="M9 1.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5L9 1.5Z M9 1.5V5h3.5" strokeLinejoin="round" />
    </svg>
  );
}
