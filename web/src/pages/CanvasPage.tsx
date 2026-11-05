import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router";
import { useCanvas } from "../features/canvas/useCanvas";
import { useServices } from "../features/canvas/useServices";
import { CanvasTopBar, type CanvasView } from "../features/canvas/CanvasTopBar";
import { IconSidebar } from "../features/canvas/IconSidebar";
import { CanvasArea } from "../features/canvas/CanvasArea";
import { ServiceConfigPanel } from "../features/canvas/ServiceConfigPanel";
import { EdgeConfigPanel } from "../features/canvas/EdgeConfigPanel";
import { resolveEdgeKind } from "../features/canvas/edgeKinds";
import { RightPanel } from "../features/canvas/RightPanel/RightPanel";
import { ServicesModal } from "../features/canvas/modals/ServicesModal";
import { CodeModal } from "../features/canvas/modals/CodeModal";
import { ZipModal } from "../features/canvas/modals/ZipModal";
import { DeploysView } from "../features/canvas/views/DeploysView";
import { projectsService } from "../services/projects";

type LambdaModal = "code" | "zip" | null;

function snapshotCanvas(nodes: unknown, edges: unknown): string {
  return JSON.stringify({ nodes, edges });
}

export function CanvasPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const projectName =
    (location.state as { projectName?: string } | null)?.projectName ?? id;

  const {
    nodes, edges, viewport, setViewport,
    addNode, moveNode, resizeNode, removeNode,
    updateNodeConfig, updateEdgeConfig, attachNode, addEdge, removeEdge,
    toJSON, resetCanvas,
  } = useCanvas();

  const { byId: serviceById } = useServices();

  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotCanvas([], []));

  // ── Load project on mount ─────────────────────────────────────────────────
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!id || bootstrapped.current) return;
    bootstrapped.current = true;

    projectsService.get(id).then(({ project }) => {
      const model = project.model;
      if (model?.nodes?.length > 0) {
        resetCanvas(model.nodes, model.edges ?? []);
        setSavedSnapshot(snapshotCanvas(model.nodes, model.edges ?? []));
      }
    }).catch(console.error);
  }, [id]);

  // ── Change detection ──────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  const currentSnapshot = snapshotCanvas(nodes, edges);
  const isDirty = currentSnapshot !== savedSnapshot;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await projectsService.update(id, nodes, edges);
      setSavedSnapshot(currentSnapshot);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Services catalog wrapper ──────────────────────────────────────────────
  const addNodeFromCatalog = (serviceId: string, position: { x: number; y: number }) => {
    const def = serviceById.get(serviceId);
    addNode(serviceId, position, def?.defaultConfig, def?.defaultSize ?? undefined);
  };

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeView,    setActiveView]    = useState<CanvasView>("canvas");
  const [animated,      setAnimated]      = useState(
    () => localStorage.getItem("rivo_canvas_animated") === "true"
  );
  const [servicesOpen,  setServicesOpen]  = useState(false);
  const [configNodeId,  setConfigNodeId]  = useState<string | null>(null);
  const [rightNodeId,   setRightNodeId]   = useState<string | null>(null);
  const [lambdaModal,   setLambdaModal]   = useState<LambdaModal>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const RIGHT_PANEL_SERVICES = new Set(["lambda", "api-gateway"]);

  const configNode = nodes.find((n) => n.id === configNodeId) ?? null;
  const rightNode  = nodes.find((n) => n.id === rightNodeId)  ?? null;

  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const edgeKind     = resolveEdgeKind(selectedEdge, nodes);

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setSelectedEdgeId(null);
    setConfigNodeId((prev) => (prev === nodeId ? null : nodeId));
    if (RIGHT_PANEL_SERVICES.has(node.type)) {
      setRightNodeId((prev) => (prev === nodeId ? null : nodeId));
    } else {
      setRightNodeId(null);
    }
  };

  const handleContainerClick = (nodeId: string) => {
    setConfigNodeId((prev) => (prev === nodeId ? null : nodeId));
    setRightNodeId(null);
  };

  const handleAddService = (serviceId: string) => {
    const x = (-viewport.x + 400) / viewport.zoom + Math.random() * 80 - 40;
    const y = (-viewport.y + 240) / viewport.zoom + Math.random() * 80 - 40;
    addNodeFromCatalog(serviceId, { x, y });
  };

  return (
    <div className="flex flex-col h-screen bg-page overflow-hidden">
      <CanvasTopBar
        projectName={projectName}
        nodeCount={nodes.length}
        viewport={viewport}
        isDirty={isDirty}
        isSaving={isSaving}
        activeView={activeView}
        animated={animated}
        onViewChange={setActiveView}
        onToggleAnimations={() => setAnimated((v) => {
          const next = !v;
          localStorage.setItem("rivo_canvas_animated", String(next));
          return next;
        })}
        onZoomChange={(zoom) => setViewport((prev) => ({ ...prev, zoom }))}
        onExportJSON={toJSON}
        onSave={handleSave}
      />

      {/* ── Canvas view ──────────────────────────────────────────────────── */}
      {activeView === "canvas" && (
        <div className="flex flex-1 overflow-hidden">
          <IconSidebar
            servicesOpen={servicesOpen}
            onToggleServices={() => setServicesOpen((v) => !v)}
          />

          <div className="relative flex flex-col flex-1 overflow-hidden">
            <CanvasArea
              nodes={nodes}
              edges={edges}
              viewport={viewport}
              selectedNodeId={configNodeId}
              onAddNode={addNodeFromCatalog}
              onMoveNode={moveNode}
              onResizeNode={resizeNode}
              onRemoveNode={removeNode}
              onRemoveEdge={removeEdge}
              onAddEdge={addEdge}
              onAttachNode={attachNode}
              animated={animated}
              onViewportChange={setViewport}
              onNodeClick={handleNodeClick}
              onContainerClick={handleContainerClick}
              onEdgeSelect={(id) => {
                setSelectedEdgeId(id);
                if (id) setConfigNodeId(null);
              }}
              onCanvasClick={() => {
                setConfigNodeId(null);
                setSelectedEdgeId(null);
                setRightNodeId(null);
              }}
            />

            {configNode && edgeKind.kind === "none" && (
              <ServiceConfigPanel
                node={configNode}
                edges={edges}
                allNodes={nodes}
                onClose={() => setConfigNodeId(null)}
                onUpdate={updateNodeConfig}
                onEdgeClick={(edgeId) => {
                  setConfigNodeId(null);
                  setSelectedEdgeId(edgeId);
                }}
              />
            )}

            {edgeKind.kind === "route" && selectedEdge && (
              <EdgeConfigPanel
                edge={selectedEdge}
                apiGwNode={edgeKind.apiGw}
                lambdaNode={edgeKind.lambda}
                onClose={() => setSelectedEdgeId(null)}
                onUpdate={updateEdgeConfig}
              />
            )}
          </div>

          {rightNode && (
            <RightPanel
              node={rightNode}
              edges={edges}
              allNodes={nodes}
              onClose={() => setRightNodeId(null)}
              onOpenCode={() => setLambdaModal("code")}
              onOpenZip={() => setLambdaModal("zip")}
            />
          )}
        </div>
      )}

      {/* ── Deploys view ─────────────────────────────────────────────────── */}
      {activeView === "deploys" && (
        <div className="flex-1 overflow-hidden">
          <DeploysView projectName={projectName} />
        </div>
      )}

      {servicesOpen && (
        <ServicesModal
          onClose={() => setServicesOpen(false)}
          onAddService={handleAddService}
        />
      )}

      {lambdaModal === "code" && rightNode?.type === "lambda" && (
        <CodeModal node={rightNode} onClose={() => setLambdaModal(null)} />
      )}
      {lambdaModal === "zip" && rightNode?.type === "lambda" && (
        <ZipModal node={rightNode} onClose={() => setLambdaModal(null)} />
      )}
    </div>
  );
}
