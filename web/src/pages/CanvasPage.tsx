import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router";
import { useCanvas } from "../features/canvas/useCanvas";
import { useServices } from "../features/canvas/useServices";
import { CanvasTopBar } from "../features/canvas/CanvasTopBar";
import { IconSidebar } from "../features/canvas/IconSidebar";
import { CanvasArea } from "../features/canvas/CanvasArea";
import { ServiceConfigPanel } from "../features/canvas/ServiceConfigPanel";
import { EdgeConfigPanel } from "../features/canvas/EdgeConfigPanel";
import { resolveEdgeKind } from "../features/canvas/edgeKinds";
import { RightPanel } from "../features/canvas/RightPanel/RightPanel";
import { ServicesModal } from "../features/canvas/modals/ServicesModal";
import { CodeModal } from "../features/canvas/modals/CodeModal";
import { ZipModal } from "../features/canvas/modals/ZipModal";
import { withInlineCode, withPackage } from "../features/canvas/lambdaSource";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { FullPageMessage } from "../features/workspace/FullPageMessage";
import { Button } from "../components/Button/Button";
import { useSnackbar } from "../context/SnackbarContext";
import { projectsService, DIAGRAM_FORMAT, type ApiProject } from "../services/projects";
import { ApiError, errorMessage } from "../services/api";

type LambdaModal = "code" | "zip" | null;

function snapshotCanvas(nodes: unknown, edges: unknown): string {
  return JSON.stringify({ nodes, edges });
}

export function CanvasPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { workspace, can } = useWorkspace();
  const { push } = useSnackbar();
  const canSave = can("projects:update");

  const {
    nodes, edges, viewport, setViewport,
    addNode, moveNode, resizeNode, removeNode,
    updateNodeConfig, updateEdgeConfig, attachNode, addEdge, removeEdge,
    toJSON, resetCanvas,
  } = useCanvas();

  const { byId: serviceById } = useServices();

  const [project, setProject] = useState<ApiProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotCanvas([], []));
  // The draft's version in S3. Saving sends it back, so a save never
  // overwrites someone else's newer one.
  const etag = useRef("");
  const [conflict, setConflict] = useState(false);
  // Which load the canvas shows. Editing waits for it: a draft arriving after
  // someone started drawing would replace their work.
  const [loaded, setLoaded] = useState(-1);

  // ── Load the project and its draft ───────────────────────────────────────
  const [reloads, setReloads] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([projectsService.get(workspace.id, projectId), projectsService.getDraft(workspace.id, projectId)])
      .then(([meta, draft]) => {
        if (!active) return;
        setProject(meta);
        etag.current = draft.etag;
        resetCanvas(draft.model.nodes, draft.model.edges);
        setSavedSnapshot(snapshotCanvas(draft.model.nodes, draft.model.edges));
        setConflict(false);
        setLoaded(reloads);
      })
      .catch((err: unknown) => active && setLoadError(errorMessage(err, "Could not open this project.")));
    return () => {
      active = false;
    };
  }, [workspace.id, projectId, reloads, resetCanvas]);

  // ── Change detection ──────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  const currentSnapshot = snapshotCanvas(nodes, edges);
  const isDirty = canSave && currentSnapshot !== savedSnapshot;

  const handleSave = async () => {
    if (!isDirty || isSaving || conflict) return;
    setIsSaving(true);
    try {
      etag.current = await projectsService.saveDraft(
        workspace.id,
        projectId,
        { version: DIAGRAM_FORMAT, nodes, edges },
        etag.current,
      );
      setSavedSnapshot(currentSnapshot);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else push(errorMessage(err, "Could not save the diagram."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Ctrl+S / Cmd+S saves, and leaving with unsaved changes asks first.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!isDirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [isDirty]);

  // ── Services catalog wrapper ──────────────────────────────────────────────
  const addNodeFromCatalog = (serviceId: string, position: { x: number; y: number }) => {
    const def = serviceById.get(serviceId);
    addNode(serviceId, position, def?.defaultConfig, def?.defaultSize ?? undefined);
  };

  // ── UI state ──────────────────────────────────────────────────────────────
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

  if (!loadError && loaded !== reloads) {
    return <FullPageMessage title="Opening the project…" />;
  }

  if (loadError) {
    return (
      <FullPageMessage
        title="This project can't be opened"
        message={loadError}
        action={<Button size="sm" variant="secondary" onClick={() => history.back()}>Go back</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-page overflow-hidden">
      <CanvasTopBar
        projectName={project?.name ?? "Loading…"}
        workspaceName={workspace.name}
        workspaceHref={`/workspaces/${workspace.id}${project?.folderId ? `/folders/${project.folderId}` : ""}`}
        nodeCount={nodes.length}
        viewport={viewport}
        isDirty={isDirty}
        isSaving={isSaving}
        canSave={canSave}
        animated={animated}
        onToggleAnimations={() => setAnimated((v) => {
          const next = !v;
          localStorage.setItem("rivo_canvas_animated", String(next));
          return next;
        })}
        onZoomChange={(zoom) => setViewport((prev) => ({ ...prev, zoom }))}
        onExportJSON={toJSON}
        onSave={handleSave}
      />

      {conflict && (
        <div role="alert" className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-500/30 bg-amber-500/10 text-sm">
          <span className="flex-1 text-ink">
            Someone else saved this diagram after you opened it. Reload to see their version: your unsaved changes will be lost.
          </span>
          <Button size="sm" variant="secondary" onClick={() => setReloads((n) => n + 1)}>Reload</Button>
        </div>
      )}

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

      {servicesOpen && (
        <ServicesModal
          onClose={() => setServicesOpen(false)}
          onAddService={handleAddService}
        />
      )}

      {lambdaModal === "code" && rightNode?.type === "lambda" && (
        <CodeModal
          node={rightNode}
          readOnly={!canSave}
          onSave={(code) => {
            updateNodeConfig(rightNode.id, withInlineCode(rightNode, code));
            push("The function now uses this code. Save the diagram to keep it.", "info");
          }}
          onClose={() => setLambdaModal(null)}
        />
      )}
      {lambdaModal === "zip" && rightNode?.type === "lambda" && (
        <ZipModal
          node={rightNode}
          workspaceId={workspace.id}
          projectId={projectId}
          readOnly={!canSave}
          onUploaded={(pkg) => {
            updateNodeConfig(rightNode.id, withPackage(rightNode, pkg));
            push(`${pkg.name} is uploaded. Save the diagram to use it.`, "success");
          }}
          onClose={() => setLambdaModal(null)}
        />
      )}
    </div>
  );
}
