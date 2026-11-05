import { useRef, useState } from "react";

interface ZipUploadProps {
  value: File | null;
  onChange: (file: File | null) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ZipUpload({ value, onChange }: ZipUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const accept = (file: File) => {
    if (file.name.endsWith(".zip")) onChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) accept(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) accept(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      {!value ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            "flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors",
            isDragOver
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-edge hover:border-raised",
          ].join(" ")}
        >
          {/* Upload icon */}
          <div className="w-12 h-12 rounded-xl bg-raised flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-ink-dim" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-ink">
              {isDragOver ? "Drop your .zip here" : "Upload deployment package"}
            </p>
            <p className="text-xs text-ink-dim mt-1">
              Drag & drop or <span className="text-indigo-400">browse</span> — .zip only
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleChange}
          />
        </div>
      ) : (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-edge bg-card">
          {/* Zip icon */}
          <div className="w-10 h-10 rounded-lg bg-raised flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{value.name}</p>
            <p className="text-xs text-ink-dim mt-0.5">{formatBytes(value.size)}</p>
          </div>
          <button
            onClick={() => onChange(null)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
          >
            <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      <div className="text-xs text-ink-dim bg-raised/50 rounded-lg px-3 py-2.5">
        The .zip must contain your handler file (e.g. <code className="text-indigo-400 font-mono">index.js</code>) at the root level together with any <code className="text-indigo-400 font-mono">node_modules</code>.
      </div>
    </div>
  );
}
