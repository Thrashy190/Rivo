import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/Button/Button";
import { RivoLogo } from "../../components/icons";
import { Modal } from "../../components/Modal/Modal";
import { JsonViewer } from "../../components/JsonViewer/JsonViewer";
import type { InfraModel } from "../../types/infra";
import type { Viewport } from "./useCanvas";

interface CanvasTopBarProps {
  projectName: string;
  // Where the breadcrumb goes back to: the project's workspace.
  workspaceName?: string;
  workspaceHref?: string;
  nodeCount: number;
  viewport: Viewport;
  isDirty?: boolean;
  isSaving?: boolean;
  // False for roles that can only read: the canvas still works, but nothing is saved.
  canSave?: boolean;
  animated?: boolean;
  onZoomChange: (zoom: number) => void;
  onExportJSON: () => InfraModel;
  onSave?: () => void;
  onToggleAnimations?: () => void;
}

export function CanvasTopBar({
  projectName,
  workspaceName = "Projects",
  workspaceHref = "/",
  nodeCount,
  viewport,
  isDirty = false,
  isSaving = false,
  canSave = true,
  animated = false,
  onZoomChange,
  onExportJSON,
  onSave,
  onToggleAnimations,
}: CanvasTopBarProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const zoom = Math.round(viewport.zoom * 100);

  return (
    <>
      <header className="h-12 border-b border-edge/60 flex items-center px-4 gap-0 shrink-0 bg-page">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link to={workspaceHref} className="shrink-0" aria-label="Rivo home">
            <RivoLogo className="w-5 h-5" />
          </Link>
          <span className="text-ink-dim text-sm">/</span>
          <Link
            to={workspaceHref}
            className="text-sm text-ink-dim hover:text-ink transition-colors truncate max-w-48"
          >
            {workspaceName}
          </Link>
          <span className="text-ink-dim text-sm">/</span>
          <span className="text-sm text-ink/90 font-medium truncate">{projectName}</span>
          {!canSave && (
            <span className="text-[10px] text-ink-dim border border-edge rounded px-1.5 py-0.5 shrink-0">
              View only
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 justify-end shrink-0">
          {/* Zoom controls — only visible on canvas view */}
          {onToggleAnimations && (
            <button
              onClick={onToggleAnimations}
              title={animated ? "Disable animations" : "Enable animations"}
              className={[
                "h-7 px-2.5 flex items-center gap-1.5 rounded-md border text-xs font-medium transition-colors",
                animated
                  ? "border-indigo-500/40 text-indigo-400 bg-indigo-500/10"
                  : "border-edge/60 text-ink-dim hover:text-ink hover:bg-card",
              ].join(" ")}
            >
              {/* Sparkles icon — universally understood as "animations/effects" */}
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1 L7.1 4.4 L10.5 5 L7.1 5.6 L6.5 9 L5.9 5.6 L2.5 5 L5.9 4.4 Z" fill="currentColor"/>
                <path d="M11 0.5 L11.35 2.15 L13 2.5 L11.35 2.85 L11 4.5 L10.65 2.85 L9 2.5 L10.65 2.15 Z" fill="currentColor" opacity="0.7"/>
                <path d="M2 8 L2.25 9.25 L3.5 9.5 L2.25 9.75 L2 11 L1.75 9.75 L0.5 9.5 L1.75 9.25 Z" fill="currentColor" opacity="0.5"/>
              </svg>
              FX
            </button>
          )}

          <div className="flex items-center gap-1 bg-card border border-edge/60 rounded-lg px-1 py-1">
            <button
              onClick={() => onZoomChange(Math.max(viewport.zoom - 0.1, 0.2))}
              className="w-6 h-6 flex items-center justify-center rounded-md text-ink-dim hover:text-ink hover:bg-raised transition-colors text-base leading-none"
            >
              −
            </button>
            <span className="text-xs text-ink-dim w-10 text-center font-mono tabular-nums">
              {zoom}%
            </span>
            <button
              onClick={() => onZoomChange(Math.min(viewport.zoom + 0.1, 3))}
              className="w-6 h-6 flex items-center justify-center rounded-md text-ink-dim hover:text-ink hover:bg-raised transition-colors text-base leading-none"
            >
              +
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setJsonOpen(true)}
          >
            JSON
            {nodeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-raised text-ink-dim text-[10px] font-mono">
                {nodeCount}
              </span>
            )}
          </Button>

          {canSave && onSave && (
            <Button
              size="sm"
              variant={isDirty ? "primary" : "ghost"}
              onClick={onSave}
              disabled={!isDirty || isSaving}
              title="Save (Ctrl+S)"
            >
              {isSaving ? "Saving…" : isDirty ? "Save" : "Saved"}
            </Button>
          )}
        </div>
      </header>

      <Modal
        open={jsonOpen}
        onClose={() => setJsonOpen(false)}
        title="InfraModel JSON"
        size="lg"
      >
        <JsonViewer data={onExportJSON()} maxHeight="65vh" />
      </Modal>
    </>
  );
}
