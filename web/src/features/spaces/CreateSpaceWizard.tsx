import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button/Button";
import { Input } from "../../components/Input/Input";
import { spacesService } from "../../services/spaces";

const PRESET_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
];

interface SpaceDraft {
  name:        string;
  description: string;
  color:       string;
}

export function CreateSpaceWizard() {
  const navigate = useNavigate();
  const [draft,    setDraft]    = useState<SpaceDraft>({ name: "", description: "", color: PRESET_COLORS[0].value });
  const [errors,   setErrors]   = useState<{ name?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const update = <K extends keyof SpaceDraft>(field: K, value: SpaceDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (field === "name") setErrors({});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) { setErrors({ name: "Space name is required" }); return; }
    if (draft.name.trim().length < 2) { setErrors({ name: "Name must be at least 2 characters" }); return; }

    setApiError(null);
    setLoading(true);
    try {
      const { space } = await spacesService.create({
        name:        draft.name,
        description: draft.description || undefined,
        color:       draft.color,
      });
      navigate(`/spaces/${space.spaceId}`, {
        state: { spaceName: space.name, spaceColor: space.color },
      });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to create space");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <h2 className="text-xl font-semibold tracking-tight mb-1">Create a space</h2>
      <p className="text-sm text-zinc-500 mb-8">Spaces group related projects. Your team can share a space.</p>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Input
          label="Space name"
          placeholder="e.g. Backend Team, Data Platform"
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
          error={errors.name}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400 tracking-wide uppercase">
            Description <span className="normal-case text-zinc-600">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="What does this space contain?"
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 resize-none transition-colors"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-zinc-400 tracking-wide uppercase mb-3">Color</p>
          <div className="flex gap-2.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => update("color", c.value)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {draft.color === c.value && (
                  <span className="flex items-center justify-center w-full h-full">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/90 block" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3">
          <span className="w-4 h-4 rounded-sm shrink-0" style={{ backgroundColor: draft.color }} />
          <span className="text-sm text-zinc-300">{draft.name.trim() || "Space name"}</span>
        </div>

        {apiError && <p className="text-xs text-red-400 -mt-2">{apiError}</p>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" size="sm" type="button" onClick={() => navigate("/projects")}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Creating…" : "Create space"}
          </Button>
        </div>
      </form>
    </div>
  );
}
