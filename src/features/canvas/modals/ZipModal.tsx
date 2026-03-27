import { useState } from "react";
import { createPortal } from "react-dom";
import { ZipUpload } from "../../../components/CodeEditor/ZipUpload";
import { AWS_SERVICE_CATEGORIES } from "../aws-services";
import type { CanvasNode } from "../useCanvas";

function getServiceIcon(type: string) {
  for (const cat of AWS_SERVICE_CATEGORIES) {
    const svc = cat.services.find((s) => s.id === type);
    if (svc) return svc.icon;
  }
  return null;
}

interface ZipModalProps {
  node: CanvasNode;
  onClose: () => void;
}

export function ZipModal({ node, onClose }: ZipModalProps) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);

  const icon = getServiceIcon(node.type);

  const handleUpload = () => {
    if (!zipFile) return;
    setUploaded(true);
    setTimeout(() => { setUploaded(false); onClose(); }, 1800);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none">
        <div className="w-full max-w-lg bg-page border border-edge/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-edge/60 shrink-0">
            {icon && (
              <div className="w-7 h-7 rounded-md overflow-hidden shrink-0">{icon}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {String(node.config.name ?? node.label)} — Upload package
              </p>
              <p className="text-xs text-ink-dim">
                Deployment package (.zip)
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
            >
              <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            <ZipUpload value={zipFile} onChange={setZipFile} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-edge/60 shrink-0">
            <button
              onClick={onClose}
              className="text-xs text-ink-dim hover:text-ink transition-colors px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!zipFile}
              className={[
                "text-xs font-medium px-4 py-1.5 rounded-lg transition-colors",
                zipFile
                  ? uploaded
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                  : "bg-raised text-ink-dim cursor-not-allowed",
              ].join(" ")}
            >
              {uploaded ? "Uploaded ✓" : "Upload package"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
