import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import { RivoLogo } from "../../components/icons";
import { Modal } from "../../components/Modal/Modal";
import { JsonViewer } from "../../components/JsonViewer/JsonViewer";
import type { InfraModel } from "../../types/infra";

interface CanvasTopBarProps {
  projectName: string;
  // Where the breadcrumb goes back to: the project's workspace.
  workspaceName?: string;
  workspaceHref?: string;
  region?: string;
  isDirty?: boolean;
  isSaving?: boolean;
  // False for roles that can only read: the canvas still works, but nothing is saved.
  canSave?: boolean;
  libraryOpen?: boolean;
  onToggleLibrary?: () => void;
  onExportJSON: () => InfraModel;
  onSave?: () => void;
  onOpenTerraform?: () => void;
}

export function CanvasTopBar({
  projectName,
  workspaceName = "Projects",
  workspaceHref = "/",
  region,
  isDirty = false,
  isSaving = false,
  canSave = true,
  libraryOpen = true,
  onToggleLibrary,
  onExportJSON,
  onSave,
  onOpenTerraform,
}: CanvasTopBarProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const status = !canSave ? null : isSaving ? "Saving…" : isDirty ? "Unsaved changes" : "All changes saved";

  return (
    <>
      <header className="h-14 border-b border-edge flex items-center px-3 gap-3 shrink-0 bg-page">
        {onToggleLibrary && (
          <button
            onClick={onToggleLibrary}
            aria-label={libraryOpen ? "Hide the library" : "Show the library"}
            aria-pressed={libraryOpen}
            title={libraryOpen ? "Hide the library" : "Add services"}
            className={[
              "h-8 rounded-lg flex items-center gap-1.5 transition-colors shrink-0",
              libraryOpen ? "w-8 justify-center text-ink-dim hover:text-ink hover:bg-raised" : "px-2.5 bg-card border border-edge text-ink hover:bg-raised text-xs font-medium",
            ].join(" ")}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {libraryOpen ? (
                <>
                  <rect x="2" y="2.5" width="12" height="11" rx="2" />
                  <path d="M6 2.5v11" />
                </>
              ) : (
                <path d="M8 3v10M3 8h10" />
              )}
            </svg>
            {!libraryOpen && "Add"}
          </button>
        )}

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0 flex-1">
          <Link to={workspaceHref} className="shrink-0" aria-label="Back to the workspace">
            <RivoLogo className="w-5 h-5" />
          </Link>
          <span className="text-ink-dim/50 text-sm">/</span>
          <Link to={workspaceHref} className="text-sm text-ink-dim hover:text-ink transition-colors truncate max-w-48">
            {workspaceName}
          </Link>
          <span className="text-ink-dim/50 text-sm">/</span>
          <span className="text-sm text-ink font-semibold truncate">{projectName}</span>
          {region && (
            <span className="hidden md:inline text-[10px] font-mono text-ink-dim border border-edge rounded-md px-1.5 py-0.5 shrink-0">{region}</span>
          )}
          {!canSave && <span className="text-[10px] text-ink-dim border border-edge rounded-md px-1.5 py-0.5 shrink-0">View only</span>}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-ink-dim mr-1" aria-live="polite">
              <span className={["w-1.5 h-1.5 rounded-full", isDirty ? "bg-amber-500" : "bg-emerald-500"].join(" ")} />
              {status}
            </span>
          )}

          <button
            onClick={() => setJsonOpen(true)}
            title="See the diagram as JSON"
            aria-label="See the diagram as JSON"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 2.5c-1.5 0-2 .7-2 2v1.5c0 1-.5 2-1.5 2 1 0 1.5 1 1.5 2v1.5c0 1.3.5 2 2 2M10.5 2.5c1.5 0 2 .7 2 2v1.5c0 1 .5 2 1.5 2-1 0-1.5 1-1.5 2v1.5c0 1.3-.5 2-2 2" />
            </svg>
          </button>

          {onOpenTerraform && (
            <Button size="sm" variant="secondary" onClick={onOpenTerraform} title="See and download the Terraform for this diagram">
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-indigo-500" fill="currentColor" aria-hidden="true">
                <path d="M7.3 3.6 12 6.3v5.4L7.3 9V3.6ZM12.7 6.3l4.7-2.7V9l-4.7 2.7V6.3ZM2 .6l4.7 2.7v5.4L2 6V.6ZM7.3 9.6 12 12.3v5.4l-4.7-2.7V9.6Z" />
              </svg>
              Terraform
            </Button>
          )}

          {canSave && onSave && (
            <Button size="sm" variant={isDirty ? "primary" : "secondary"} onClick={onSave} disabled={!isDirty || isSaving} title="Save (Ctrl+S)">
              {isSaving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </header>

      <Modal open={jsonOpen} onClose={() => setJsonOpen(false)} title="Diagram JSON" size="lg">
        <JsonViewer data={onExportJSON()} maxHeight="65vh" />
      </Modal>
    </>
  );
}
