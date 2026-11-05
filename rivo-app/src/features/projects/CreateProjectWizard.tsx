import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { Select } from "../../components/Select/Select";

// ─── Types ────────────────────────────────────────────────────────────────────

type CloudProvider = "aws" | "azure" | "gcp";
type Environment = "production" | "staging" | "development";
type Step = 1 | 2 | 3;

interface ProjectDraft {
  name: string;
  description: string;
  provider: CloudProvider;
  region: string;
  environment: Environment;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East — N. Virginia" },
  { value: "us-east-2", label: "US East — Ohio" },
  { value: "us-west-1", label: "US West — N. California" },
  { value: "us-west-2", label: "US West — Oregon" },
  { value: "eu-west-1", label: "EU — Ireland" },
  { value: "eu-central-1", label: "EU — Frankfurt" },
  { value: "ap-northeast-1", label: "Asia Pacific — Tokyo" },
  { value: "ap-southeast-1", label: "Asia Pacific — Singapore" },
  { value: "ap-southeast-2", label: "Asia Pacific — Sydney" },
  { value: "sa-east-1", label: "South America — São Paulo" },
];

const PROVIDERS: { id: CloudProvider; name: string; available: boolean; color: string }[] = [
  { id: "aws", name: "Amazon Web Services", available: true, color: "#FF9900" },
  { id: "azure", name: "Microsoft Azure", available: false, color: "#0089D6" },
  { id: "gcp", name: "Google Cloud", available: false, color: "#4285F4" },
];

const ENVIRONMENTS: { id: Environment; label: string; description: string }[] = [
  { id: "production", label: "Production", description: "Live traffic, strict guardrails" },
  { id: "staging", label: "Staging", description: "Pre-production validation" },
  { id: "development", label: "Development", description: "Iterative changes, lower cost" },
];

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={[
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
              step < current
                ? "bg-white text-zinc-950"
                : step === current
                ? "bg-white text-zinc-950"
                : "bg-zinc-800 text-zinc-600",
            ].join(" ")}
          >
            {step < current ? "✓" : step}
          </div>
          {step < total && (
            <div
              className={`h-px w-8 transition-colors ${step < current ? "bg-white/40" : "bg-zinc-800"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function CreateProjectWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<ProjectDraft>({
    name: "",
    description: "",
    provider: "aws",
    region: "us-east-1",
    environment: "production",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectDraft, string>>>({});

  const update = (field: keyof ProjectDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // ── Step 1: name & description ─────────────────────────────────────────────
  const validateStep1 = () => {
    if (!draft.name.trim()) {
      setErrors({ name: "Project name is required" });
      return false;
    }
    if (draft.name.trim().length < 2) {
      setErrors({ name: "Name must be at least 2 characters" });
      return false;
    }
    return true;
  };

  // ── Submit / create ────────────────────────────────────────────────────────
  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    const id = `proj_${Date.now()}`;
    navigate(`/projects/${id}`, {
      state: { projectName: draft.name, region: draft.region, environment: draft.environment },
    });
  };

  return (
    <div className="w-full max-w-lg">
      <StepIndicator current={step} total={3} />

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Name your project</h2>
          <p className="text-sm text-zinc-500 mb-8">
            A clear name helps your team identify the infrastructure at a glance.
          </p>

          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (validateStep1()) setStep(2);
            }}
          >
            <Input
              label="Project name"
              placeholder="e.g. production-api, data-pipeline"
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              error={errors.name}
              autoFocus
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400 tracking-wide uppercase">
                Description{" "}
                <span className="normal-case text-zinc-600">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="What does this project do?"
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none transition-colors"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Continue
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Cloud & region</h2>
          <p className="text-sm text-zinc-500 mb-8">
            Choose where your infrastructure will be deployed.
          </p>

          <div className="flex flex-col gap-6">
            {/* Cloud provider */}
            <div>
              <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-3">
                Cloud provider
              </p>
              <div className="flex flex-col gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    disabled={!p.available}
                    onClick={() => p.available && update("provider", p.id)}
                    className={[
                      "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                      draft.provider === p.id && p.available
                        ? "border-white/20 bg-white/5"
                        : "border-zinc-800 hover:border-zinc-700",
                      !p.available ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200">{p.name}</p>
                      {!p.available && (
                        <p className="text-xs text-zinc-600">Coming soon</p>
                      )}
                    </div>
                    {draft.provider === p.id && p.available && (
                      <div className="w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Region */}
            <Select
              label="Primary region"
              value={draft.region}
              onChange={(e) => update("region", e.target.value)}
            >
              {AWS_REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.value} — {r.label}
                </option>
              ))}
            </Select>

            <div className="flex justify-between gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <form onSubmit={handleCreate}>
          <h2 className="text-xl font-semibold tracking-tight mb-1">Environment</h2>
          <p className="text-sm text-zinc-500 mb-8">
            The environment affects default settings and guardrails.
          </p>

          <div className="flex flex-col gap-2 mb-8">
            {ENVIRONMENTS.map((env) => (
              <button
                key={env.id}
                type="button"
                onClick={() => update("environment", env.id)}
                className={[
                  "flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                  draft.environment === env.id
                    ? "border-white/20 bg-white/5"
                    : "border-zinc-800 hover:border-zinc-700",
                ].join(" ")}
              >
                <div
                  className={[
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    draft.environment === env.id ? "border-white" : "border-zinc-600",
                  ].join(" ")}
                >
                  {draft.environment === env.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{env.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{env.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 mb-6 text-xs font-mono text-zinc-500 space-y-1">
            <div className="flex justify-between">
              <span>name</span>
              <span className="text-zinc-300">{draft.name}</span>
            </div>
            <div className="flex justify-between">
              <span>provider</span>
              <span className="text-zinc-300">{draft.provider}</span>
            </div>
            <div className="flex justify-between">
              <span>region</span>
              <span className="text-zinc-300">{draft.region}</span>
            </div>
            <div className="flex justify-between">
              <span>environment</span>
              <span className="text-zinc-300">{draft.environment}</span>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="submit" size="sm">
              Create project
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
