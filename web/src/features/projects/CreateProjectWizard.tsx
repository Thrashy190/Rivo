import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Select } from "../../components/Select/Select";
import { projectsService } from "../../services/projects";
import { errorMessage } from "../../services/api";
import { useWorkspace } from "../workspace/workspaceContext";

type Environment   = "production" | "staging" | "development";
type Step          = 1 | 2 | 3;

interface ProjectDraft {
  name:        string;
  description: string;
  folderId:    string;
  region:      string;
  environment: Environment;
}

const AWS_REGIONS = [
  { value: "us-east-1",      label: "US East — N. Virginia" },
  { value: "us-east-2",      label: "US East — Ohio" },
  { value: "us-west-1",      label: "US West — N. California" },
  { value: "us-west-2",      label: "US West — Oregon" },
  { value: "eu-west-1",      label: "EU — Ireland" },
  { value: "eu-central-1",   label: "EU — Frankfurt" },
  { value: "ap-northeast-1", label: "Asia Pacific — Tokyo" },
  { value: "ap-southeast-1", label: "Asia Pacific — Singapore" },
  { value: "ap-southeast-2", label: "Asia Pacific — Sydney" },
  { value: "sa-east-1",      label: "South America — São Paulo" },
];

const ENVIRONMENTS: { id: Environment; label: string; description: string }[] = [
  { id: "production",  label: "Production",  description: "Live traffic, strict guardrails" },
  { id: "staging",     label: "Staging",     description: "Pre-production validation" },
  { id: "development", label: "Development", description: "Iterative changes, lower cost" },
];

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div className={[
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
            step <= current ? "bg-ink text-page" : "bg-raised text-ink-dim",
          ].join(" ")}>
            {step < current ? "✓" : step}
          </div>
          {step < total && (
            <div className={`h-px w-8 transition-colors ${step < current ? "bg-ink/40" : "bg-raised"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function CreateProjectWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { workspace, folders } = useWorkspace();
  const [step,   setStep]   = useState<Step>(1);
  const [draft,  setDraft]  = useState<ProjectDraft>(() => ({
    name: "", description: "",
    folderId: folders.some((f) => f.id === params.get("folder")) ? params.get("folder")! : "",
    region: "us-east-1", environment: "development",
  }));
  const [errors,  setErrors]  = useState<Partial<Record<keyof ProjectDraft, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const update = (field: keyof ProjectDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateStep1 = () => {
    if (!draft.name.trim()) { setErrors({ name: "Project name is required" }); return false; }
    if (draft.name.trim().length < 2) { setErrors({ name: "Name must be at least 2 characters" }); return false; }
    return true;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setLoading(true);
    try {
      const project = await projectsService.create(workspace.id, {
        name:        draft.name.trim(),
        description: draft.description.trim() || undefined,
        folderId:    draft.folderId || undefined,
        region:      draft.region,
        environment: draft.environment,
      });
      navigate(`/workspaces/${workspace.id}/projects/${project.projectId}`, { replace: true });
    } catch (err) {
      setApiError(errorMessage(err, "Failed to create project"));
      setLoading(false);
    }
  };

  const selectedFolder = folders.find((f) => f.id === draft.folderId);
  const cancel = () => navigate(draft.folderId ? `/workspaces/${workspace.id}/folders/${draft.folderId}` : `/workspaces/${workspace.id}`);

  return (
    <div className="w-full max-w-lg">
      <StepIndicator current={step} total={3} />

      {/* Step 1: name + folder */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Name your project</h2>
          <p className="text-sm text-ink-dim mb-8">A clear name helps your team identify the infrastructure at a glance.</p>

          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (validateStep1()) setStep(2); }}>
            <Input
              label="Project name"
              placeholder="e.g. production-api, data-pipeline"
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              error={errors.name}
              autoFocus
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-dim tracking-wide uppercase">
                Description <span className="normal-case text-ink-dim">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="What does this project do?"
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                className="w-full rounded-md border border-edge bg-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:outline-none focus:border-edge resize-none transition-colors"
              />
            </div>

            <Select label="Folder" value={draft.folderId} onChange={(e) => update("folderId", e.target.value)}>
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </Select>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" type="button" onClick={cancel}>Cancel</Button>
              <Button type="submit" size="sm">Continue</Button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: cloud + region */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Region</h2>
          <p className="text-sm text-ink-dim mb-8">The AWS region this project's infrastructure will run in.</p>

          <div className="flex flex-col gap-6">
            <Select label="Primary region" value={draft.region} onChange={(e) => update("region", e.target.value)}>
              {AWS_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.value} — {r.label}</option>
              ))}
            </Select>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>Back</Button>
              <Button size="sm" onClick={() => setStep(3)}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: environment + create */}
      {step === 3 && (
        <form onSubmit={handleCreate}>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Environment</h2>
          <p className="text-sm text-ink-dim mb-8">The environment affects default settings and guardrails.</p>

          <div className="flex flex-col gap-2 mb-8">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => update("environment", env.id)}
                className={[
                  "flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                  draft.environment === env.id ? "border-ink/20 bg-ink/5" : "border-edge hover:border-edge",
                ].join(" ")}
              >
                <div className={[
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                  draft.environment === env.id ? "border-ink" : "border-edge",
                ].join(" ")}>
                  {draft.environment === env.id && <div className="w-1.5 h-1.5 rounded-full bg-ink" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{env.label}</p>
                  <p className="text-xs text-ink-dim mt-0.5">{env.description}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-card/60 border border-edge/60 rounded-xl p-4 mb-6 text-xs font-mono text-ink-dim space-y-1">
            <div className="flex justify-between"><span>name</span><span className="text-ink">{draft.name}</span></div>
            <div className="flex justify-between"><span>workspace</span><span className="text-ink">{workspace.name}</span></div>
            <div className="flex justify-between"><span>folder</span><span className="text-ink">{selectedFolder?.name ?? "none"}</span></div>
            <div className="flex justify-between"><span>region</span><span className="text-ink">{draft.region}</span></div>
            <div className="flex justify-between"><span>environment</span><span className="text-ink">{draft.environment}</span></div>
          </div>

          {apiError && <p className="text-xs text-red-500 mb-4">{apiError}</p>}

          <div className="flex justify-between gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => setStep(2)}>Back</Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Creating…" : "Create project"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
