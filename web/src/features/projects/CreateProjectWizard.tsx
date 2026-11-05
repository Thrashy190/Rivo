import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Select } from "../../components/Select/Select";
import { projectsService } from "../../services/projects";
import { spacesService, type ApiSpace } from "../../services/spaces";

type CloudProvider = "aws" | "azure" | "gcp";
type Environment   = "production" | "staging" | "development";
type Step          = 1 | 2 | 3;

interface ProjectDraft {
  name:        string;
  description: string;
  spaceId:     string;
  provider:    CloudProvider;
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

const PROVIDERS: { id: CloudProvider; name: string; available: boolean; color: string }[] = [
  { id: "aws",   name: "Amazon Web Services", available: true,  color: "#FF9900" },
  { id: "azure", name: "Microsoft Azure",     available: false, color: "#0089D6" },
  { id: "gcp",   name: "Google Cloud",        available: false, color: "#4285F4" },
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
  const [step,   setStep]   = useState<Step>(1);
  const [spaces, setSpaces] = useState<ApiSpace[]>([]);
  const [draft,  setDraft]  = useState<ProjectDraft>({
    name: "", description: "", spaceId: "",
    provider: "aws", region: "us-east-1", environment: "production",
  });
  const [errors,  setErrors]  = useState<Partial<Record<keyof ProjectDraft, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    spacesService.list().then((res) => {
      setSpaces(res.spaces);
      if (res.spaces.length > 0 && !draft.spaceId) {
        setDraft((prev) => ({ ...prev, spaceId: res.spaces[0].spaceId }));
      }
    }).catch(console.error);
  }, []);

  const update = (field: keyof ProjectDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateStep1 = () => {
    if (!draft.name.trim()) { setErrors({ name: "Project name is required" }); return false; }
    if (draft.name.trim().length < 2) { setErrors({ name: "Name must be at least 2 characters" }); return false; }
    if (!draft.spaceId) { setErrors({ spaceId: "Select a space for this project" }); return false; }
    return true;
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setLoading(true);
    try {
      const { project } = await projectsService.create({
        name:        draft.name,
        description: draft.description || undefined,
        spaceId:     draft.spaceId,
        region:      draft.region,
        environment: draft.environment,
      });
      navigate(`/projects/${project.projectId}`, {
        state: { projectName: project.name, region: project.region, environment: project.environment },
      });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  const selectedSpace = spaces.find((s) => s.spaceId === draft.spaceId);

  return (
    <div className="w-full max-w-lg">
      <StepIndicator current={step} total={3} />

      {/* Step 1: name + space */}
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

            <div>
              <p className="text-xs font-medium text-ink-dim tracking-wide uppercase mb-2">Space</p>
              {spaces.length === 0 ? (
                <p className="text-xs text-ink-dim">No spaces yet — <a href="/spaces/new" className="underline">create one first</a></p>
              ) : (
                <div className="flex flex-col gap-2">
                  {spaces.map((space) => (
                    <button
                      key={space.spaceId}
                      type="button"
                      onClick={() => update("spaceId", space.spaceId)}
                      className={[
                        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                        draft.spaceId === space.spaceId
                          ? "border-ink/20 bg-ink/5"
                          : "border-edge hover:border-edge",
                      ].join(" ")}
                    >
                      <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: space.color }} />
                      <span className="text-sm text-ink">{space.name}</span>
                      {draft.spaceId === space.spaceId && (
                        <div className="ml-auto w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-ink" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {errors.spaceId && <p className="mt-1.5 text-xs text-red-400">{errors.spaceId}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>Cancel</Button>
              <Button type="submit" size="sm">Continue</Button>
            </div>
          </form>
        </div>
      )}

      {/* Step 2: cloud + region */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Cloud & region</h2>
          <p className="text-sm text-ink-dim mb-8">Choose where your infrastructure will be deployed.</p>

          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs font-medium text-ink-dim tracking-wide uppercase mb-3">Cloud provider</p>
              <div className="flex flex-col gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    disabled={!p.available}
                    onClick={() => p.available && update("provider", p.id)}
                    className={[
                      "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      draft.provider === p.id && p.available ? "border-ink/20 bg-ink/5" : "border-edge hover:border-edge",
                      !p.available ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">{p.name}</p>
                      {!p.available && <p className="text-xs text-ink-dim">Coming soon</p>}
                    </div>
                    {draft.provider === p.id && p.available && (
                      <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-ink" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

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
                  draft.environment === env.id ? "border-white" : "border-edge",
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
            <div className="flex justify-between items-center">
              <span>space</span>
              <span className="flex items-center gap-1.5 text-ink">
                {selectedSpace && <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: selectedSpace.color }} />}
                {selectedSpace?.name}
              </span>
            </div>
            <div className="flex justify-between"><span>region</span><span className="text-ink">{draft.region}</span></div>
            <div className="flex justify-between"><span>environment</span><span className="text-ink">{draft.environment}</span></div>
          </div>

          {apiError && <p className="text-xs text-red-400 mb-4">{apiError}</p>}

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
