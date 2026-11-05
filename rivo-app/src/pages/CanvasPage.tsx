import { useState } from "react";
import { useParams, useLocation } from "react-router";
import { useCanvas } from "../features/canvas/useCanvas";
import { CanvasTopBar } from "../features/canvas/CanvasTopBar";
import { IconSidebar } from "../features/canvas/IconSidebar";
import { CanvasArea } from "../features/canvas/CanvasArea";
import { ServiceConfigPanel } from "../features/canvas/ServiceConfigPanel";
import { RightPanel } from "../features/canvas/RightPanel/RightPanel";
import { ServicesModal } from "../features/canvas/modals/ServicesModal";
import { CodeModal } from "../features/canvas/modals/CodeModal";
import { ZipModal } from "../features/canvas/modals/ZipModal";

const PROJECT_NAMES: Record<string, string> = {
  proj_01: "production-vpc",
  proj_02: "staging-cluster",
  proj_03: "data-pipeline",
  proj_04: "legacy-migration",
  proj_05: "cdn-layer",
  proj_06: "monitoring-stack",
};

// Services that open the right tools panel
const RIGHT_PANEL_SERVICES = new Set(["lambda", "api-gateway"]);

type LambdaModal = "code" | "zip" | null;

export function CanvasPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const projectName =
    (location.state as { projectName?: string } | null)?.projectName ??
    PROJECT_NAMES[id] ??
    id;

  const {
    nodes,
    edges,
    viewport,
    setViewport,
    addNode,
    moveNode,
    resizeNode,
    removeNode,
    updateNodeConfig,
    attachNode,
    addEdge,
    removeEdge,
    toJSON,
  } = useCanvas();

  // Left icon strip — services panel open/close
  const [servicesOpen, setServicesOpen] = useState(false);

  // Bottom config panel (all services, including containers)
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const configNode = nodes.find((n) => n.id === configNodeId) ?? null;

  // Right tools panel (lambda, api-gateway)
  const [rightNodeId, setRightNodeId] = useState<string | null>(null);
  const rightNode = nodes.find((n) => n.id === rightNodeId) ?? null;

  // Fullscreen modals launched from the Lambda right panel
  const [lambdaModal, setLambdaModal] = useState<LambdaModal>(null);

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setConfigNodeId((prev) => (prev === nodeId ? null : nodeId));

    if (RIGHT_PANEL_SERVICES.has(node.type)) {
      setRightNodeId((prev) => (prev === nodeId ? null : nodeId));
    } else {
      setRightNodeId(null);
    }
  };

  const handleContainerClick = (nodeId: string) => {
    // Containers open the config panel but not the right panel
    setConfigNodeId((prev) => (prev === nodeId ? null : nodeId));
    setRightNodeId(null);
  };

  const handleAddService = (serviceId: string) => {
    const x = (-viewport.x + 400) / viewport.zoom + Math.random() * 80 - 40;
    const y = (-viewport.y + 240) / viewport.zoom + Math.random() * 80 - 40;
    addNode(serviceId, { x, y });
  };

  const handleZoomChange = (zoom: number) => {
    setViewport((prev) => ({ ...prev, zoom }));
  };

  return (
    <div className="flex flex-col h-screen bg-page overflow-hidden">
      <CanvasTopBar
        projectName={projectName}
        nodeCount={nodes.length}
        viewport={viewport}
        onZoomChange={handleZoomChange}
        onExportJSON={toJSON}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left icon strip — services only */}
        <IconSidebar
          servicesOpen={servicesOpen}
          onToggleServices={() => setServicesOpen((v) => !v)}
        />

        {/* Canvas + bottom config panel */}
        <div className="relative flex flex-col flex-1 overflow-hidden">
          <CanvasArea
            nodes={nodes}
            edges={edges}
            viewport={viewport}
            selectedNodeId={configNodeId}
            onAddNode={addNode}
            onMoveNode={moveNode}
            onResizeNode={resizeNode}
            onRemoveNode={removeNode}
            onRemoveEdge={removeEdge}
            onAddEdge={addEdge}
            onAttachNode={attachNode}
            onViewportChange={setViewport}
            onNodeClick={handleNodeClick}
            onContainerClick={handleContainerClick}
          />

          {configNode && (
            <ServiceConfigPanel
              node={configNode}
              onClose={() => setConfigNodeId(null)}
              onUpdate={updateNodeConfig}
            />
          )}
        </div>

        {/* Right tools panel */}
        {rightNode && (
          <RightPanel
            node={rightNode}
            onClose={() => setRightNodeId(null)}
            onOpenCode={() => setLambdaModal("code")}
            onOpenZip={() => setLambdaModal("zip")}
          />
        )}
      </div>

      {/* Services floating panel (no backdrop — drag-and-drop works) */}
      {servicesOpen && (
        <ServicesModal
          onClose={() => setServicesOpen(false)}
          onAddService={handleAddService}
        />
      )}

      {/* Lambda fullscreen modals (launched from right panel) */}
      {lambdaModal === "code" && rightNode?.type === "lambda" && (
        <CodeModal node={rightNode} onClose={() => setLambdaModal(null)} />
      )}
      {lambdaModal === "zip" && rightNode?.type === "lambda" && (
        <ZipModal node={rightNode} onClose={() => setLambdaModal(null)} />
      )}
    </div>
  );
}
