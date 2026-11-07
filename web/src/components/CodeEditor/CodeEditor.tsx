import { lazy, Suspense } from "react";
import type { OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useTheme } from "../../hooks/useTheme";

// Monaco is large, so it only loads when an editor opens.
const Editor = lazy(async () => {
  await import("./monacoSetup");
  return import("@monaco-editor/react");
});

export type CodeLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "java"
  | "ruby"
  | "hcl"
  | "html"
  | "css"
  | "json"
  | "yaml"
  | "markdown"
  | "plaintext";

export type { OnMount };

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage;
  height?: string;
  readOnly?: boolean;
  // Each path keeps its own model, with its own undo history and cursor.
  path?: string;
  // The full editor, like VS Code's: minimap, sticky scroll, context menu.
  full?: boolean;
  tabSize?: number;
  onMount?: OnMount;
}

// Monaco's own themes are VS Code's Dark+ and Light+.
function useMonacoTheme() {
  const { theme } = useTheme();
  if (theme === "light") return "vs";
  if (theme === "dark") return "vs-dark";
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) return "vs";
  return "vs-dark";
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  height = "100%",
  readOnly = false,
  path,
  full = false,
  tabSize = 2,
  onMount,
}: CodeEditorProps) {
  const theme = useMonacoTheme();

  const options: editor.IStandaloneEditorConstructionOptions = {
    fontSize: full ? 13 : 12,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontLigatures: full,
    lineHeight: full ? 21 : 20,
    minimap: { enabled: full, renderCharacters: false, maxColumn: 100 },
    scrollBeyondLastLine: full,
    wordWrap: full ? "off" : "on",
    tabSize,
    insertSpaces: true,
    detectIndentation: false,
    readOnly,
    padding: { top: 12, bottom: 12 },
    overviewRulerLanes: full ? 3 : 0,
    hideCursorInOverviewRuler: !full,
    renderLineHighlight: "line",
    smoothScrolling: true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    contextmenu: full,
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: full ? "active" : false, indentation: true },
    stickyScroll: { enabled: full },
    renderWhitespace: full ? "selection" : "none",
    folding: true,
    showFoldingControls: "mouseover",
    quickSuggestions: full ? { other: true, comments: false, strings: true } : true,
    suggest: { preview: true, showWords: true },
    linkedEditing: true,
    formatOnPaste: false,
    mouseWheelZoom: full,
  };

  return (
    <Suspense fallback={<div style={{ height }} className="bg-card" aria-busy="true" />}>
      <Editor
        height={height}
        language={language}
        value={value}
        path={path}
        theme={theme}
        onChange={(v) => onChange(v ?? "")}
        onMount={onMount}
        options={options}
      />
    </Suspense>
  );
}
