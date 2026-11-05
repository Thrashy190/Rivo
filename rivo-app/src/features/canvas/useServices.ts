import type { ServiceSchema } from "./service-config-schemas";

// ── Types that mirror the future API response ─────────────────────────────────

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  typeCategory: string;
  variant: "service" | "container";
  defaultConfig: Record<string, unknown>;
  defaultSize: { width: number; height: number } | null;
  iconUrl: string | null;
  configSchema: ServiceSchema | null;
}

export interface ServiceCategory {
  id: string;
  label: string;
  services: ServiceDefinition[];
}

interface ServicesState {
  categories: ServiceCategory[];
  byId: Map<string, ServiceDefinition>;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: ServicesState = {
  categories: [],
  byId:       new Map(),
  loading:    false,
  error:      null,
};

// There is no live `GET /services` catalog right now — the old backend that
// served it has been disconnected. Callers (CanvasSidebar, ServiceConfigPanel,
// CanvasPage) already fall back to the static catalog in aws-services.tsx and
// service-config-schemas.ts when this returns an empty state, so the canvas
// keeps working entirely off static data. Once a new lambda serves the real
// catalog, restore the fetch here — the ServicesState shape is unchanged.
export function useServices(): ServicesState {
  return EMPTY_STATE;
}
