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
  nodeCount: number;
  viewport: Viewport;
  onZoomChange: (zoom: number) => void;
  onExportJSON: () => InfraModel;
}

export function CanvasTopBar({
  projectName,
  nodeCount,
  viewport,
  onZoomChange,
  onExportJSON,
}: CanvasTopBarProps) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const zoom = Math.round(viewport.zoom * 100);

  return (
    <>
      <header className="h-12 border-b border-edge/60 flex items-center px-4 gap-4 shrink-0 bg-page">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/projects" className="shrink-0">
            <RivoLogo className="w-5 h-5" />
          </Link>
          <span className="text-ink-dim text-sm">/</span>
          <Link
            to="/projects"
            className="text-sm text-ink-dim hover:text-ink transition-colors shrink-0"
          >
            Projects
          </Link>
          <span className="text-ink-dim text-sm">/</span>
          <span className="text-sm text-ink/90 font-medium truncate">{projectName}</span>
        </div>

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-card border border-edge/60 rounded-lg px-1 py-1">
          <button
            onClick={() => onZoomChange(Math.max(viewport.zoom - 0.1, 0.2))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-ink-dim hover:text-ink hover:bg-raised transition-colors text-base leading-none"
          >
            −
          </button>
          <span className="text-xs text-ink-dim w-12 text-center font-mono tabular-nums">
            {zoom}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(viewport.zoom + 0.1, 3))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-ink-dim hover:text-ink hover:bg-raised transition-colors text-base leading-none"
          >
            +
          </button>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setJsonOpen(true)}
          >
            View JSON
            {nodeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-raised text-ink-dim text-[10px] font-mono">
                {nodeCount}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="sm">Save</Button>
          <Button size="sm">Deploy</Button>
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
