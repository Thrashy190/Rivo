import Editor from "@monaco-editor/react";
import { useTheme } from "../../hooks/useTheme";

export type CodeLanguage = "javascript" | "typescript" | "python" | "go" | "java" | "ruby";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage;
  height?: string;
  readOnly?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = "javascript",
  height = "100%",
  readOnly = false,
}: CodeEditorProps) {
  const { theme } = useTheme();

  // Resolve which monaco theme to use
  const resolvedTheme = (() => {
    if (theme === "light") return "light";
    if (theme === "dark") return "vs-dark";
    // system — check the class that was applied
    if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
      return "light";
    }
    return "vs-dark";
  })();

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={resolvedTheme}
      onChange={(v) => onChange(v ?? "")}
      options={{
        fontSize: 12,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        readOnly,
        padding: { top: 12, bottom: 12 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        renderLineHighlight: "line",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        contextmenu: false,
      }}
    />
  );
}
