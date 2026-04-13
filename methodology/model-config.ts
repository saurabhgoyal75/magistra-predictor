// Model Config — Single source of truth for the self-evolving predictor
// The daily pipeline writes this config; the engine + frontend read it.

import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";

// ── Types ──

export type ParameterStatus = "active" | "candidate" | "retired";
export type ParameterType = "select" | "number" | "boolean";
export type BilingualString = { en: string; nl: string };
export type TabId = "sideEffects" | "weight" | "muscle" | "discontinuation";

export type SelectOption = {
  value: string;
  label: BilingualString;
};

export type InputParameter = {
  id: string;
  type: ParameterType;
  options?: SelectOption[];
  min?: number;
  max?: number;
  label: BilingualString;
  required: boolean;
  default?: string | number | boolean;
  evidenceLevel: "strong" | "moderate" | "emerging" | "insufficient";
  dataPointCount: number;
  section: "core" | "extended";
  displayOrder: number;
  status: ParameterStatus;
  activeSince?: string;
  tabs: TabId[];
};

export type Modifier = {
  logOdds: number;
  oddsRatio: number;
  pValue: number | null;
  n: number;
  source: "empirical" | "clinical_literature";
  lastUpdated: string;
};

export type EffectConfig = {
  id: string;
  name: BilingualString;
  description: BilingualString;
  severity: "mild" | "moderate" | "severe";
  baseRates: { low: number; medium: number; high: number };
  modifiers: Record<string, Modifier>;
  userReportedRate: number;
  userReportedSeverity: BilingualString;
  onsetDays: BilingualString;
  durationWeeks: BilingualString;
  managementTip: BilingualString;
  sources: { name: string; type: string; url?: string; weight: number }[];
  dataPointCount: number;
  lastUpdated: string;
};

export type CandidateInfo = {
  id: string;
  currentN: number;
  requiredN: number;
  significantEffects: string[];
  firstSeen: string;
  notes: string;
};

export type ChangelogEntry = {
  version: number;
  date: string;
  changes: {
    type: "modifier_updated" | "parameter_promoted" | "parameter_retired" | "base_rate_updated" | "effect_added";
    effect?: string;
    modifier?: string;
    from?: number;
    to?: number;
    reason: string;
  }[];
  autoApplied: boolean;
};

export type ModelThresholds = {
  autoApplyModifier: { minN: number; maxPValue: number; maxOddsRatioChange: number };
  flagForReview: { minN: number; maxPValue: number };
  promoteParameter: { minN: number; minSignificantEffects: number; maxPValue: number };
  demoteParameter: { maxN: number; minDaysSinceLastEvidence: number };
};

export type ModelConfig = {
  version: number;
  generatedAt: string;
  inputParameters: InputParameter[];
  effects: EffectConfig[];
  candidateParameters: CandidateInfo[];
  changelog: ChangelogEntry[];
  thresholds: ModelThresholds;
};

// ── Loader ──

const CONFIG_KV_KEY = "model:config";
const LOCAL_CONFIG_PATH = path.join(process.cwd(), "data", "model-config.json");

let cachedConfig: ModelConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function loadModelConfig(): Promise<ModelConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) return cachedConfig;

  try {
    // Try KV first (production)
    if (process.env.KV_REST_API_URL) {
      const config = await kv.get<ModelConfig>(CONFIG_KV_KEY);
      if (config) {
        cachedConfig = config;
        cacheTime = now;
        return config;
      }
    }
  } catch {
    // Fall through to local file
  }

  try {
    // Local file (dev or fallback)
    if (fs.existsSync(LOCAL_CONFIG_PATH)) {
      const raw = fs.readFileSync(LOCAL_CONFIG_PATH, "utf-8");
      const config = JSON.parse(raw) as ModelConfig;
      cachedConfig = config;
      cacheTime = now;
      return config;
    }
  } catch {
    // No config available
  }

  return null;
}

export function getActiveParameters(config: ModelConfig, tab?: TabId): InputParameter[] {
  return config.inputParameters
    .filter(p => p.status === "active" && (!tab || p.tabs.includes(tab)))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getEffectConfig(config: ModelConfig, effectId: string): EffectConfig | undefined {
  return config.effects.find(e => e.id === effectId);
}
