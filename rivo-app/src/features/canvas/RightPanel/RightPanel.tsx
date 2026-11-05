import { AWS_SERVICE_CATEGORIES } from "../aws-services";
import { LambdaPanel } from "./LambdaPanel";
import { ApiGatewayPanel } from "./ApiGatewayPanel";
import type { CanvasNode, CanvasEdge } from "../useCanvas";

interface RightPanelProps {
  node: CanvasNode;
  edges?: CanvasEdge[];
  allNodes?: CanvasNode[];
  onClose: () => void;
  onOpenCode: () => void;
  onOpenZip: () => void;
}

function getServiceIcon(type: string) {
  for (const cat of AWS_SERVICE_CATEGORIES) {
    const svc = cat.services.find((s) => s.id === type);
    if (svc) return svc.icon;
  }
  return null;
}

function NoPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <p className="text-sm text-ink-dim">No tools available for {label}</p>
    </div>
  );
}

export function RightPanel({ node, edges = [], allNodes = [], onClose, onOpenCode, onOpenZip }: RightPanelProps) {
  const icon = getServiceIcon(node.type);

  const content = (() => {
    switch (node.type) {
      case "lambda":      return <LambdaPanel node={node} onOpenCode={onOpenCode} onOpenZip={onOpenZip} />;
      case "api-gateway": return <ApiGatewayPanel node={node} edges={edges} allNodes={allNodes} />;
      default:            return <NoPanel label={node.label} />;
    }
  })();

  return (
    <div className="w-80 shrink-0 h-full bg-page border-l border-edge/60 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-edge/60 shrink-0">
        {icon && (
          <div className="w-7 h-7 rounded-md overflow-hidden shrink-0">{icon}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-ink truncate">{node.label}</p>
          <p className="text-[10px] text-ink-dim font-mono truncate">{node.id}</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised transition-colors shrink-0"
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Service-specific content */}
      <div className="flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );
}
