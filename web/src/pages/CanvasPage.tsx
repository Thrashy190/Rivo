import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router";
import { useCanvas } from "../features/canvas/useCanvas";
import { CanvasTopBar } from "../features/canvas/CanvasTopBar";
import { CanvasArea } from "../features/canvas/CanvasArea";
import { Library } from "../features/canvas/Library";
import { BLUEPRINTS, type Blueprint } from "../features/canvas/blueprints";
import { getServiceIcon } from "../features/canvas/aws-services";
import { EdgeInspector, NodeInspector } from "../features/canvas/inspector/Inspector";
import { SERVICE_NODE_HEIGHT, SERVICE_NODE_WIDTH } from "../features/canvas/nodes/ServiceNode";
import { CodeModal } from "../features/canvas/modals/CodeModal";
import { ZipModal } from "../features/canvas/modals/ZipModal";
import { TerraformModal } from "../features/canvas/modals/TerraformModal";
import { withInlineCode, withPackage } from "../features/canvas/lambdaSource";
import { useWorkspace } from "../features/workspace/workspaceContext";
import { DeployPanel } from "../features/deploy/DeployPanel";
import { ApiTestModal } from "../features/deploy/ApiTestModal";
import { FullPageMessage } from "../features/workspace/FullPageMessage";
import { Button } from "../components/Button/Button";
import { useSnackbar } from "../context/SnackbarContext";
import { projectsService, DIAGRAM_FORMAT, type ApiProject } from "../services/projects";
import { ApiError, errorMessage } from "../services/api";

type LambdaModal = "code" | "zip" | null;

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "true";
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Only a preference.
  }
}

function snapshotCanvas(nodes: unknown, edges: unknown): string {
  return JSON.stringify({ nodes, edges });
}

export function CanvasPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { workspace, can } = useWorkspace();
  const { push } = useSnackbar();
  const canSave = can("projects:update");
  const canDeploy = can("deployments:run");
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    nodes, edges, viewport, setViewport,
    addNode, moveNode, resizeNode, removeNode,
    updateNodeConfig, updateEdgeConfig, attachNode, addEdge, removeEdge,
    reverseEdge, insertGraph, toJSON, resetCanvas,
  } = useCanvas();

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

  // Resolves to whether the diagram is saved afterwards.
  const handleSave = async (): Promise<boolean> => {
    if (!isDirty) return true;
    if (isSaving || conflict) return false;
    setIsSaving(true);
    try {
      etag.current = await projectsService.saveDraft(
        workspace.id,
        projectId,
        { version: DIAGRAM_FORMAT, nodes, edges },
        etag.current,
      );
      setSavedSnapshot(currentSnapshot);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setConflict(true);
      else push(errorMessage(err, "Could not save the diagram."), "error");
      return false;
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

  // ── UI state ──────────────────────────────────────────────────────────────
  const [animated, setAnimated] = useState(() => readFlag("rivo_canvas_animated", false));
  const [libraryOpen, setLibraryOpen] = useState(() => readFlag("rivo_canvas_library", true));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [lambdaModal, setLambdaModal] = useState<LambdaModal>(null);
  const [terraformOpen, setTerraformOpen] = useState(false);
  // ?deployment=<id> opens the deploy panel on that deployment.
  const linkedDeployment = searchParams.get("deployment") ?? undefined;
  const [deployOpen, setDeployOpen] = useState(Boolean(linkedDeployment));
  const [apiTestNodeId, setApiTestNodeId] = useState<string | null>(null);

  const reloadProject = useCallback(() => {
    projectsService
      .get(workspace.id, projectId)
      .then(setProject)
      .catch(() => {});
  }, [workspace.id, projectId]);
  const liveIds = useMemo(() => new Set(Object.keys(project?.endpoints ?? {})), [project?.endpoints]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const selectNode = (id: string | null) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  };
  const selectEdge = (id: string | null) => {
    setSelectedEdgeId(id);
    if (id) setSelectedNodeId(null);
  };

  // The middle of what the canvas shows, in diagram coordinates.
  const viewCenter = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 800;
    const h = rect?.height ?? 500;
    return { x: (w / 2 - viewport.x) / viewport.zoom, y: (h / 2 - viewport.y) / viewport.zoom };
  };

  // The free spot closest to the middle of the view, so a new service never
  // lands on top of another one. Spots in view come first; failing that, the
  // closest free one, and the view moves to it.
  const freeSpot = (): { x: number; y: number; inView: boolean } => {
    const c = viewCenter();
    const start = { x: c.x - SERVICE_NODE_WIDTH / 2, y: c.y - SERVICE_NODE_HEIGHT / 2 };
    const gap = 24;
    const taken = (x: number, y: number) =>
      nodes.some(
        (n) =>
          n.variant !== "container" &&
          x < n.position.x + SERVICE_NODE_WIDTH + gap &&
          n.position.x < x + SERVICE_NODE_WIDTH + gap &&
          y < n.position.y + SERVICE_NODE_HEIGHT + gap &&
          n.position.y < y + SERVICE_NODE_HEIGHT + gap,
      );
    const rect = canvasRef.current?.getBoundingClientRect();
    const inView = (x: number, y: number) =>
      !rect ||
      (x * viewport.zoom + viewport.x >= 16 &&
        y * viewport.zoom + viewport.y >= 16 &&
        (x + SERVICE_NODE_WIDTH) * viewport.zoom + viewport.x <= rect.width - 16 &&
        (y + SERVICE_NODE_HEIGHT) * viewport.zoom + viewport.y <= rect.height - 72);

    // Candidates on a half-size grid, nearest first.
    const stepX = (SERVICE_NODE_WIDTH + gap) / 2;
    const stepY = (SERVICE_NODE_HEIGHT + gap) / 2;
    const candidates: { x: number; y: number; d: number }[] = [];
    for (let dy = -12; dy <= 12; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        candidates.push({ x: start.x + dx * stepX, y: start.y + dy * stepY, d: Math.hypot(dx * stepX, dy * stepY) });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    const visible = candidates.find((p) => !taken(p.x, p.y) && inView(p.x, p.y));
    if (visible) return { x: visible.x, y: visible.y, inView: true };
    const any = candidates.find((p) => !taken(p.x, p.y));
    return any ? { x: any.x, y: any.y, inView: false } : { ...start, inView: true };
  };

  const handleAddService = (serviceId: string) => {
    const spot = freeSpot();
    if (!spot.inView) {
      const rect = canvasRef.current?.getBoundingClientRect();
      setViewport((v) => ({
        ...v,
        x: (rect?.width ?? 800) / 2 - (spot.x + SERVICE_NODE_WIDTH / 2) * v.zoom,
        y: (rect?.height ?? 500) / 2 - (spot.y + SERVICE_NODE_HEIGHT / 2) * v.zoom,
      }));
    }
    selectNode(addNode(serviceId, { x: spot.x, y: spot.y }));
  };

  const handleAddBlueprint = (bp: Blueprint) => {
    const xs = bp.graph.nodes.map((n) => n.offset.x);
    const ys = bp.graph.nodes.map((n) => n.offset.y);
    const width = Math.max(...xs) - Math.min(...xs) + SERVICE_NODE_WIDTH;
    const height = Math.max(...ys) - Math.min(...ys) + SERVICE_NODE_HEIGHT;

    // On an empty canvas it goes in the middle; otherwise below what is there,
    // and the view moves to it.
    let center = viewCenter();
    if (nodes.length > 0) {
      const minX = Math.min(...nodes.map((n) => n.position.x));
      const maxY = Math.max(...nodes.map((n) => n.position.y + (n.size?.height ?? SERVICE_NODE_HEIGHT)));
      center = { x: minX + width / 2, y: maxY + 120 + height / 2 };
      const rect = canvasRef.current?.getBoundingClientRect();
      setViewport((v) => ({
        ...v,
        x: (rect?.width ?? 800) / 2 - center.x * v.zoom,
        y: (rect?.height ?? 500) / 2 - center.y * v.zoom,
      }));
    }
    insertGraph(bp.graph, { x: center.x - width / 2 - Math.min(...xs), y: center.y - height / 2 - Math.min(...ys) });
    push(`${bp.name} added.`, "success");
  };

  const handleRemoveNode = (id: string) => {
    removeNode(id);
    if (selectedNodeId === id) setSelectedNodeId(null);
  };
  const handleRemoveEdge = (id: string) => {
    removeEdge(id);
    if (selectedEdgeId === id) setSelectedEdgeId(null);
  };

  // Delete or Backspace removes what is selected, unless someone is typing.
  const removeSelectedRef = useRef<() => void>(() => {});
  useEffect(() => {
    removeSelectedRef.current = () => {
      if (!canSave) return;
      if (selectedEdgeId) handleRemoveEdge(selectedEdgeId);
      else if (selectedNodeId) handleRemoveNode(selectedNodeId);
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      if (e.key === "Delete" || e.key === "Backspace") removeSelectedRef.current();
      if (e.key === "Escape") {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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

  const emptyState = canSave ? (
    <div className="w-[min(560px,90vw)] text-center">
      <p className="text-base font-semibold text-ink">Start your diagram</p>
      <p className="mt-1 text-sm text-ink-dim">Drop in a blueprint, or add services from the library.</p>
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {BLUEPRINTS.map((bp) => (
          <button
            key={bp.id}
            onClick={() => handleAddBlueprint(bp)}
            className="p-3 rounded-xl border border-edge bg-card/70 hover:bg-card hover:border-indigo-500/40 text-left transition-colors"
          >
            <span className="flex gap-1 mb-2.5">
              {bp.services.map((s) => (
                <span key={s} className="w-6 h-6 rounded overflow-hidden">
                  {getServiceIcon(s)}
                </span>
              ))}
            </span>
            <span className="block text-xs font-semibold text-ink">{bp.name}</span>
            <span className="block mt-0.5 text-[11px] leading-snug text-ink-dim">{bp.description}</span>
          </button>
        ))}
      </div>
    </div>
  ) : (
    <p className="text-sm text-ink-dim">This project has no services yet.</p>
  );

  return (
    <div className="flex flex-col h-screen bg-page overflow-hidden">
      <CanvasTopBar
        projectName={project?.name ?? "Loading…"}
        workspaceName={workspace.name}
        workspaceHref={`/workspaces/${workspace.id}${project?.folderId ? `/folders/${project.folderId}` : ""}`}
        region={project?.region}
        isDirty={isDirty}
        isSaving={isSaving}
        canSave={canSave}
        libraryOpen={libraryOpen && canSave}
        onToggleLibrary={
          canSave
            ? () =>
                setLibraryOpen((v) => {
                  writeFlag("rivo_canvas_library", !v);
                  return !v;
                })
            : undefined
        }
        onExportJSON={toJSON}
        onSave={() => void handleSave()}
        onOpenTerraform={() => setTerraformOpen(true)}
        onOpenDeploy={() => setDeployOpen((v) => !v)}
        deployOpen={deployOpen}
        deployStatus={project?.activeDeployment ? "deploying" : project?.status}
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
        {libraryOpen && canSave && (
          <Library
            onAddService={handleAddService}
            onAddBlueprint={handleAddBlueprint}
            onClose={() => {
              setLibraryOpen(false);
              writeFlag("rivo_canvas_library", false);
            }}
          />
        )}

        <div ref={canvasRef} className="relative flex flex-col flex-1 overflow-hidden">
          <CanvasArea
            nodes={nodes}
            edges={edges}
            viewport={viewport}
            selectedNodeId={selectedNodeId}
            selectedEdgeId={selectedEdgeId}
            readOnly={!canSave}
            animated={animated}
            emptyState={emptyState}
            liveIds={liveIds}
            onAddNode={(type, pos) => selectNode(addNode(type, pos))}
            onMoveNode={moveNode}
            onResizeNode={resizeNode}
            onRemoveNode={handleRemoveNode}
            onRemoveEdge={handleRemoveEdge}
            onAddEdge={addEdge}
            onAttachNode={attachNode}
            onViewportChange={setViewport}
            onNodeClick={(id) => selectNode(selectedNodeId === id ? null : id)}
            onEdgeSelect={selectEdge}
            onCanvasClick={() => selectNode(null)}
            onToggleAnimated={() =>
              setAnimated((v) => {
                writeFlag("rivo_canvas_animated", !v);
                return !v;
              })
            }
          />
          {deployOpen && project && (
            <DeployPanel
              workspaceId={workspace.id}
              project={project}
              nodes={nodes}
              isDirty={isDirty}
              canSave={canSave}
              canDeploy={canDeploy}
              initialDeploymentId={linkedDeployment}
              onSave={handleSave}
              onProjectChanged={reloadProject}
              onSelectNode={(id) => selectNode(id)}
              onClose={() => {
                setDeployOpen(false);
                if (linkedDeployment) setSearchParams({}, { replace: true });
              }}
            />
          )}
        </div>

        {selectedNode && (
          <NodeInspector
            key={selectedNode.id}
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            readOnly={!canSave}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={updateNodeConfig}
            onRemove={handleRemoveNode}
            onSelectEdge={selectEdge}
            onOpenCode={() => setLambdaModal("code")}
            onOpenZip={() => setLambdaModal("zip")}
            endpoints={project?.endpoints?.[selectedNode.id]}
            region={project?.region}
            onTestApi={canDeploy ? () => setApiTestNodeId(selectedNode.id) : undefined}
          />
        )}
        {selectedEdge && (
          <EdgeInspector
            key={selectedEdge.id}
            edge={selectedEdge}
            nodes={nodes}
            readOnly={!canSave}
            onClose={() => setSelectedEdgeId(null)}
            onUpdate={updateEdgeConfig}
            onReverse={reverseEdge}
            onRemove={handleRemoveEdge}
          />
        )}
      </div>

      {apiTestNodeId && project?.endpoints?.[apiTestNodeId]?.url && (() => {
        const apiNode = nodes.find((n) => n.id === apiTestNodeId);
        return apiNode ? (
          <ApiTestModal
            workspaceId={workspace.id}
            projectId={projectId}
            api={apiNode}
            nodes={nodes}
            edges={edges}
            baseUrl={project.endpoints[apiTestNodeId].url}
            onClose={() => setApiTestNodeId(null)}
          />
        ) : null;
      })()}

      {terraformOpen && (
        <TerraformModal
          workspaceId={workspace.id}
          projectId={projectId}
          isDirty={isDirty}
          canSave={canSave}
          onSave={handleSave}
          onSelectNode={(id) => {
            setTerraformOpen(false);
            selectNode(id);
          }}
          onClose={() => setTerraformOpen(false)}
        />
      )}

      {lambdaModal === "code" && selectedNode?.type === "lambda" && (
        <CodeModal
          node={selectedNode}
          nodes={nodes}
          edges={edges}
          readOnly={!canSave}
          onSave={(code, files) => {
            updateNodeConfig(selectedNode.id, withInlineCode(selectedNode, code, files));
            push("The function now uses this code. Save the diagram to keep it.", "info");
          }}
          onClose={() => setLambdaModal(null)}
        />
      )}
      {lambdaModal === "zip" && selectedNode?.type === "lambda" && (
        <ZipModal
          node={selectedNode}
          workspaceId={workspace.id}
          projectId={projectId}
          readOnly={!canSave}
          onUploaded={(pkg) => {
            updateNodeConfig(selectedNode.id, withPackage(selectedNode, pkg));
            push(`${pkg.name} is uploaded. Save the diagram to use it.`, "success");
          }}
          onClose={() => setLambdaModal(null)}
        />
      )}
    </div>
  );
}
