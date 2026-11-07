import { useState } from "react";
import { createPortal } from "react-dom";
import { ZipUpload } from "../../../components/CodeEditor/ZipUpload";
import { AWS_SERVICE_CATEGORIES } from "../aws-services";
import type { CanvasNode } from "../useCanvas";
import { lambdaSource, type LambdaPackage } from "../lambdaSource";
import { MAX_PACKAGE_BYTES, packagesService } from "../../../services/packages";
import { errorMessage } from "../../../services/api";
import { formatBytes } from "../../../utils/format";

function getServiceIcon(type: string) {
  for (const cat of AWS_SERVICE_CATEGORIES) {
    const svc = cat.services.find((s) => s.id === type);
    if (svc) return svc.icon;
  }
  return null;
}

interface ZipModalProps {
  node: CanvasNode;
  workspaceId: string;
  projectId: string;
  readOnly?: boolean;
  onUploaded: (pkg: LambdaPackage) => void;
  onClose: () => void;
}

export function ZipModal({ node, workspaceId, projectId, readOnly = false, onUploaded, onClose }: ZipModalProps) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const icon = getServiceIcon(node.type);
  const source = lambdaSource(node);
  const current = source.kind === "package" ? source.package : null;
  const tooBig = !!zipFile && zipFile.size > MAX_PACKAGE_BYTES;
  const uploading = progress !== null;

  const handleUpload = async () => {
    if (!zipFile || tooBig) return;
    setError(null);
    setProgress(0);
    try {
      const id = await packagesService.upload(workspaceId, projectId, zipFile, setProgress);
      onUploaded({ id, name: zipFile.name, size: zipFile.size, uploadedAt: Date.now() });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not upload the package."));
      setProgress(null);
    }
  };

  const handleDownload = async () => {
    if (!current) return;
    setDownloading(true);
    setError(null);
    try {
      const { url } = await packagesService.download(workspaceId, projectId, current.id, current.name);
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err, "Could not download the package."));
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={uploading ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Deployment package"
          className="w-full max-w-lg bg-page border border-edge/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-edge/60 shrink-0">
            {icon && <div className="w-7 h-7 rounded-md overflow-hidden shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">
                {String(node.config.name ?? node.label)} — Deployment package
              </p>
              <p className="text-xs text-ink-dim">A .zip of up to {MAX_PACKAGE_BYTES / 1024 / 1024} MB</p>
            </div>
            <button
              onClick={onClose}
              disabled={uploading}
              aria-label="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0 disabled:opacity-40"
            >
              <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Current package */}
          {current && (
            <div className="mx-5 mt-5 flex items-center gap-3 p-3 rounded-xl border border-edge bg-card/60">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-dim">Current package</p>
                <p className="text-sm font-medium text-ink truncate">{current.name}</p>
                <p className="text-xs text-ink-dim">{formatBytes(current.size)}</p>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-edge text-ink hover:bg-raised transition-colors disabled:opacity-40"
              >
                {downloading ? "Preparing…" : "Download"}
              </button>
            </div>
          )}

          {/* Content */}
          {readOnly ? (
            current ? <div className="h-5" /> : <p className="p-5 text-sm text-ink-dim">No package uploaded for this function.</p>
          ) : (
            <div className="p-0">
              <ZipUpload value={zipFile} onChange={(f) => { setZipFile(f); setError(null); }} />
              {tooBig && (
                <p className="px-5 -mt-2 text-xs text-red-500">
                  This file is {formatBytes(zipFile.size)}. The limit is {MAX_PACKAGE_BYTES / 1024 / 1024} MB.
                </p>
              )}
              {uploading && (
                <div className="px-5 pb-2" aria-live="polite">
                  <div className="h-1.5 rounded-full bg-raised overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-ink-dim mt-1.5">Uploading… {Math.round((progress ?? 0) * 100)}%</p>
                </div>
              )}
            </div>
          )}
          {error && <p role="alert" className="px-5 pb-3 text-xs text-red-500">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-edge/60 shrink-0">
            <button
              onClick={onClose}
              disabled={uploading}
              className="text-xs text-ink-dim hover:text-ink transition-colors px-3 py-1.5 disabled:opacity-40"
            >
              {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly && (
              <button
                onClick={handleUpload}
                disabled={!zipFile || tooBig || uploading}
                className="text-xs font-medium px-4 py-1.5 rounded-lg transition-colors bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-raised disabled:text-ink-dim disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading…" : current ? "Replace package" : "Upload package"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
