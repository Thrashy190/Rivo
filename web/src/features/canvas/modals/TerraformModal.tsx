import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CodeEditor, type CodeLanguage } from "../../../components/CodeEditor/CodeEditor";
import { Button } from "../../../components/Button/Button";
import { projectsService, type TerraformExport } from "../../../services/projects";
import { errorMessage } from "../../../services/api";

interface TerraformModalProps {
  workspaceId: string;
  projectId: string;
  // Terraform comes from the saved diagram, so unsaved changes are not in it.
  isDirty: boolean;
  canSave: boolean;
  onSave: () => Promise<boolean>;
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
}

function languageOf(path: string): CodeLanguage {
  if (path.endsWith(".tf")) return "hcl";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".rb")) return "ruby";
  if (/\.(m?js|cjs)$/.test(path)) return "javascript";
  return "plaintext";
}

export function TerraformModal({ workspaceId, projectId, isDirty, canSave, onSave, onSelectNode, onClose }: TerraformModalProps) {
  // Each run generates again; the last answer stays on screen meanwhile.
  const [run, setRun] = useState(0);
  const [answer, setAnswer] = useState<{ run: number; result: TerraformExport | null; error: string | null }>({
    run: -1,
    result: null,
    error: null,
  });
  const [selected, setSelected] = useState("providers.tf");

  useEffect(() => {
    let active = true;
    projectsService
      .exportTerraform(workspaceId, projectId)
      .then((result) => active && setAnswer({ run, result, error: null }))
      .catch((err: unknown) =>
        active && setAnswer((prev) => ({ run, result: prev.result, error: errorMessage(err, "Could not generate Terraform.") })),
      );
    return () => {
      active = false;
    };
  }, [workspaceId, projectId, run]);

  const loading = answer.run !== run;
  const result = answer.result;
  const error = loading ? null : answer.error;
  const generate = () => setRun((n) => n + 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveAndGenerate = async () => {
    if (await onSave()) generate();
  };

  const file = result?.files.find((f) => f.path === selected) ?? result?.files[0];
  const tfCount = result?.files.filter((f) => f.path.endsWith(".tf")).length ?? 0;

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Terraform"
          className="w-full max-w-6xl h-[min(86vh,820px)] bg-page border border-edge rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        >
          <header className="flex items-center gap-4 px-5 py-4 border-b border-edge shrink-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
                <path d="M7.3 3.6 12 6.3v5.4L7.3 9V3.6ZM12.7 6.3l4.7-2.7V9l-4.7 2.7V6.3ZM2 .6l4.7 2.7v5.4L2 6V.6ZM7.3 9.6 12 12.3v5.4l-4.7-2.7V9.6Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">Terraform</p>
              <p className="text-xs text-ink-dim">
                {result ? `${tfCount} files generated from the saved diagram` : "Generated from the saved diagram"}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={generate} disabled={loading}>
              {loading ? "Generating…" : "Regenerate"}
            </Button>
            <Button size="sm" onClick={() => result && window.location.assign(result.url)} disabled={!result || loading}>
              Download .zip
            </Button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
            >
              <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          {isDirty && (
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-amber-500/30 bg-amber-500/[0.07] text-xs text-ink shrink-0">
              <span className="flex-1">Your unsaved changes are not in this Terraform.</span>
              {canSave && (
                <Button size="sm" variant="secondary" onClick={() => void saveAndGenerate()}>
                  Save and regenerate
                </Button>
              )}
            </div>
          )}

          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-sm text-ink">{error}</p>
              <Button size="sm" variant="secondary" onClick={generate}>
                Try again
              </Button>
            </div>
          ) : !result ? (
            <div className="flex-1 flex items-center justify-center text-sm text-ink-dim" aria-busy="true">
              Generating Terraform…
            </div>
          ) : (
            <div className="flex-1 flex min-h-0">
              <nav aria-label="Files" className="w-60 shrink-0 border-r border-edge overflow-y-auto py-3">
                {result.files.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => setSelected(f.path)}
                    aria-current={f.path === file?.path}
                    className={[
                      "w-full text-left px-4 py-1.5 text-xs font-mono truncate transition-colors",
                      f.path === file?.path ? "bg-indigo-500/10 text-indigo-500" : "text-ink-dim hover:text-ink hover:bg-card",
                    ].join(" ")}
                  >
                    {f.path}
                  </button>
                ))}
                {result.packages.map((p) => (
                  <p key={p.path} className="px-4 py-1.5 text-xs font-mono text-ink-dim/70 truncate" title="In the .zip">
                    {p.path}
                  </p>
                ))}

                <div className="mx-4 mt-4 pt-4 border-t border-edge">
                  <p className="text-[11px] font-medium text-ink mb-1.5">Apply it</p>
                  <pre className="text-[11px] leading-relaxed font-mono text-ink-dim whitespace-pre-wrap">
                    {"terraform init\nterraform apply"}
                  </pre>
                  <p className="mt-2 text-[11px] leading-snug text-ink-dim">
                    With credentials for the AWS account. Deploying from Rivo comes next.
                  </p>
                </div>
              </nav>

              <div className="flex-1 min-w-0 flex flex-col">
                {result.warnings.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border-b border-edge bg-amber-500/[0.05] px-5 py-3 shrink-0">
                    <p className="text-[11px] font-semibold text-ink mb-1.5">
                      {result.warnings.length === 1 ? "1 thing to know" : `${result.warnings.length} things to know`}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {result.warnings.map((w, i) => (
                        <li key={i} className="text-[11px] leading-snug text-ink-dim">
                          {w.nodeId ? (
                            <button onClick={() => onSelectNode(w.nodeId!)} className="text-left hover:text-ink underline decoration-dotted underline-offset-2">
                              {w.message}
                            </button>
                          ) : (
                            w.message
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  {result.preview && file ? (
                    <CodeEditor key={file.path} value={file.content} onChange={() => {}} language={languageOf(file.path)} readOnly />
                  ) : (
                    <p className="p-6 text-sm text-ink-dim">These files are too large to preview. Download the .zip to see them.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
