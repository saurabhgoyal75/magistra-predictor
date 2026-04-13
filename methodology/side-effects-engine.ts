// Dynamic Side Effects Risk Calculator — v4.0 (dual-track)
// Two parallel estimates per effect:
//   Clinical: trial data + regulatory only, proper CIs, conservative
//   Real-world: all sources including community reports, broader signal

import { getDataPoints, getMetadata, type SideEffectDataPoint } from "./side-effects-db";
import { SIDE_EFFECTS, calculateRisk as calculateFallbackRisk } from "./side-effects-data";
import { loadModelConfig, getEffectConfig } from "./model-config";

export type PatientProfile = {
  sex: "male" | "female";
  age: number;
  hasGiHistory: boolean;
  hasDiabetes: boolean;
  doseTier: "low" | "medium" | "high";
  isFirstMonth: boolean;
  ethnicity?: "white" | "black" | "hispanic" | "asian" | "middle_eastern" | "mixed";
  bmi?: number;
  exerciseLevel?: "sedentary" | "light" | "moderate" | "active";
  bloodType?: string;
};

export type TrackEstimate = {
  percentage: number;
  confidenceInterval: { low: number; high: number };
  confidenceLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  dataPointCount: number;
  basis: string;    // e.g. "Published clinical trials (STEP-1, SURMOUNT-5)"
  basisNl: string;
  isFallback: boolean;
};

export type DualTrackRiskResult = {
  effectId: string;
  effectName: string;
  effectNameNl: string;
  severity: "mild" | "moderate" | "severe";
  clinical: TrackEstimate;
  realWorld: TrackEstimate;
  attribution: {
    clinical: { count: number; weight: number };
    userReports: { count: number; weight: number };
    regulatory: { count: number; weight: number };
    news: { count: number; weight: number };
  };
  onsetDays: string; onsetDaysNl: string;
  durationWeeks: string; durationWeeksNl: string;
  managementTip: string; managementTipNl: string;
  userReportedSeverity: string; userReportedSeverityNl: string;
  description: string; descriptionNl: string;
  sources: { name: string; type: string; url?: string }[];
};

// Also export the old type for backward compatibility
export type DynamicRiskResult = DualTrackRiskResult;

// --- Statistical helpers ---

function weightedAverageRate(points: SideEffectDataPoint[]): { rate: number; effectiveN: number; rates: number[] } | null {
  const withRates = points.filter((p) => p.extractedRate !== null && p.extractedRate >= 0 && p.extractedRate <= 1);
  if (withRates.length === 0) return null;

  let rates = withRates.map((p) => p.extractedRate as number);

  // Winsorize at 5th/95th percentile when >10 points (more conservative than 1st/99th)
  if (rates.length > 10) {
    const sorted = [...rates].sort((a, b) => a - b);
    const lowIdx = Math.max(0, Math.floor(sorted.length * 0.05));
    const highIdx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const low = sorted[lowIdx];
    const high = sorted[highIdx];
    rates = rates.map((r) => Math.max(low, Math.min(high, r)));
  }

  const confidenceDiscount: Record<string, number> = { high: 1.0, medium: 0.7, low: 0.3 };

  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < withRates.length; i++) {
    const p = withRates[i];
    const sampleWeight = Math.max(1, p.extractedSampleSize || 1);
    const qualityWeight = confidenceDiscount[p.extractionConfidence] || 0.5;
    const w = sampleWeight * qualityWeight;
    weightedSum += rates[i] * w;
    totalWeight += w;
  }
  return { rate: weightedSum / totalWeight, effectiveN: totalWeight, rates };
}

function computeConfidenceInterval(
  p: number,
  studyRates: number[],
  effectiveN: number,
  z = 1.96
): { low: number; high: number } {
  if (effectiveN === 0 || studyRates.length === 0) return { low: 0, high: 100 };

  const clampedP = Math.max(0.005, Math.min(0.995, p));
  const k = studyRates.length;

  // DerSimonian-Laird tau-squared
  let tauSq = 0;
  if (k > 1) {
    const mean = studyRates.reduce((a, b) => a + b, 0) / k;
    const Q = studyRates.reduce((sum, r) => sum + (r - mean) ** 2, 0);
    const df = k - 1;
    const withinVar = clampedP * (1 - clampedP) / Math.max(1, effectiveN / k);
    tauSq = Math.max(0, (Q - df * withinVar) / (df > 0 ? df : 1));
  }

  const samplingVar = clampedP * (1 - clampedP) / effectiveN;
  const totalVar = samplingVar + tauSq;
  const seLogOdds = Math.sqrt(totalVar) / (clampedP * (1 - clampedP));

  const logOdds = Math.log(clampedP / (1 - clampedP));
  const lowP = 1 / (1 + Math.exp(-(logOdds - z * seLogOdds)));
  const highP = 1 / (1 + Math.exp(-(logOdds + z * seLogOdds)));

  return {
    low: Math.max(0, Math.round(lowP * 100)),
    high: Math.min(100, Math.round(highP * 100)),
  };
}

function getConfidenceLevel(n: number): TrackEstimate["confidenceLevel"] {
  if (n < 5) return "very_low";
  if (n < 20) return "low";
  if (n < 100) return "moderate";
  if (n < 500) return "high";
  return "very_high";
}

// Cap total log-odds shift from modifiers to prevent implausible stacking
const MAX_TOTAL_LOG_ODDS_SHIFT = 2.5; // ~12x max cumulative OR

function applyModifiers(
  baseLogOdds: number,
  profile: PatientProfile,
  hasSexSpecificData: boolean,
  getOR: (modId: string, fallback: number) => number,
  modifiers: { femaleFactor: number; ageFactor65plus: number; giHistoryFactor: number; diabetesFactor: number; firstMonthFactor: number }
): number {
  let totalShift = 0;
  const addShift = (shift: number) => { totalShift += shift; };

  if (profile.sex === "female" && !hasSexSpecificData) addShift(Math.log(getOR("sex:female", modifiers.femaleFactor)));
  if (profile.age >= 65) addShift(Math.log(getOR("age:65plus", modifiers.ageFactor65plus)));
  if (profile.hasGiHistory) addShift(Math.log(getOR("hasGiHistory", modifiers.giHistoryFactor)));
  if (profile.hasDiabetes) addShift(Math.log(getOR("hasDiabetes", modifiers.diabetesFactor)));
  if (profile.isFirstMonth) addShift(Math.log(getOR("isFirstMonth", modifiers.firstMonthFactor)));

  // Cap total shift
  const cappedShift = Math.max(-MAX_TOTAL_LOG_ODDS_SHIFT, Math.min(MAX_TOTAL_LOG_ODDS_SHIFT, totalShift));
  return baseLogOdds + cappedShift;
}

export async function calculateDynamicRisk(
  effectId: string,
  profile: PatientProfile
): Promise<DualTrackRiskResult> {
  const staticEffect = SIDE_EFFECTS.find((e) => e.id === effectId);
  if (!staticEffect) throw new Error(`Unknown effect: ${effectId}`);

  const allPoints = await getDataPoints({ sideEffect: effectId });

  // Filter by profile relevance
  const relevantPoints = allPoints.filter((p) => {
    if (p.extractedDemographics.sex !== "unspecified" && p.extractedDemographics.sex !== profile.sex) return false;
    if (p.extractedDoseTier !== "unspecified" && p.extractedDoseTier !== profile.doseTier) return false;
    if (profile.ethnicity && p.extractedDemographics.ethnicity && p.extractedDemographics.ethnicity !== "unspecified" && p.extractedDemographics.ethnicity !== profile.ethnicity) return false;
    if (profile.exerciseLevel && p.extractedLifestyle?.exerciseLevel && p.extractedLifestyle.exerciseLevel !== "unspecified" && p.extractedLifestyle.exerciseLevel !== profile.exerciseLevel) return false;
    return true;
  });

  // Split by source type
  const clinicalPoints = relevantPoints.filter((p) => p.sourceType === "clinical" || p.sourceType === "regulatory");
  const communityPoints = relevantPoints.filter((p) => p.sourceType === "user_report" || p.sourceType === "news");

  // Model config for empirical modifiers
  const modelConfig = await loadModelConfig();
  const configEffect = modelConfig ? getEffectConfig(modelConfig, effectId) : null;
  const getModifierOR = (modId: string, fallbackOR: number): number => {
    if (configEffect?.modifiers[modId]) return configEffect.modifiers[modId].oddsRatio;
    return fallbackOR;
  };

  const hasSexSpecificData = relevantPoints.some((p) => p.extractedDemographics.sex !== "unspecified");

  // ═══════════════════════════════════════════════
  // TRACK 1: CLINICAL — trial data only, conservative
  // ═══════════════════════════════════════════════
  let clinical: TrackEstimate;

  const clinicalResult = weightedAverageRate(clinicalPoints);

  if (clinicalResult && clinicalResult.rates.length >= 1) {
    // We have actual clinical data
    let rate = clinicalResult.rate;

    // Dose adjustment if data lacks dose specificity
    const hasDoseData = clinicalPoints.some((p) => p.extractedDoseTier !== "unspecified");
    if (!hasDoseData) {
      const medianRate = staticEffect.clinicalRates.medium;
      const targetRate = staticEffect.clinicalRates[profile.doseTier];
      if (medianRate > 0) rate = rate * (targetRate / medianRate);
    }

    const clampedRate = Math.max(0.001, Math.min(0.999, rate));
    const logOdds = applyModifiers(
      Math.log(clampedRate / (1 - clampedRate)),
      profile, hasSexSpecificData, getModifierOR, staticEffect.modifiers
    );
    const adjustedRate = 1 / (1 + Math.exp(-logOdds));
    const pct = Math.max(1, Math.min(95, Math.round(adjustedRate * 100)));
    const ci = computeConfidenceInterval(adjustedRate, clinicalResult.rates, clinicalResult.effectiveN);

    clinical = {
      percentage: pct,
      confidenceInterval: ci,
      confidenceLevel: getConfidenceLevel(clinicalPoints.length),
      dataPointCount: clinicalPoints.length,
      basis: `${clinicalPoints.length} clinical studies and regulatory reports`,
      basisNl: `${clinicalPoints.length} klinische studies en regulatoire rapporten`,
      isFallback: false,
    };
  } else {
    // Fallback: use published trial base rates — clearly labeled
    const baseRate = staticEffect.clinicalRates[profile.doseTier];
    const clampedRate = Math.max(0.001, Math.min(0.999, baseRate));
    const logOdds = applyModifiers(
      Math.log(clampedRate / (1 - clampedRate)),
      profile, false, getModifierOR, staticEffect.modifiers
    );
    const adjustedRate = 1 / (1 + Math.exp(-logOdds));
    const pct = Math.max(1, Math.min(95, Math.round(adjustedRate * 100)));

    // For fallback: CI from published trial ranges (low to high dose rate)
    const lowRate = Math.round(staticEffect.clinicalRates.low * 100);
    const highRate = Math.round(staticEffect.clinicalRates.high * 100);

    clinical = {
      percentage: pct,
      confidenceInterval: { low: Math.max(0, lowRate), high: Math.min(95, highRate) },
      confidenceLevel: "low",
      dataPointCount: 0,
      basis: "Published clinical trials (no personalised data yet)",
      basisNl: "Gepubliceerde klinische studies (nog geen gepersonaliseerde data)",
      isFallback: true,
    };
  }

  // ═══════════════════════════════════════════════
  // TRACK 2: REAL-WORLD — community reports ONLY (user reports + news/forums)
  // Deliberately separate from clinical to make the gap visible.
  // ═══════════════════════════════════════════════
  let realWorld: TrackEstimate;
  const communityResult = weightedAverageRate(communityPoints);

  if (communityResult && communityResult.rates.length >= 1) {
    // We have actual community data
    let rate = communityResult.rate;

    // Dose adjustment
    const hasDoseData = communityPoints.some((p) => p.extractedDoseTier !== "unspecified");
    if (!hasDoseData) {
      const medianRate = staticEffect.clinicalRates.medium;
      const targetRate = staticEffect.clinicalRates[profile.doseTier];
      if (medianRate > 0) rate = rate * (targetRate / medianRate);
    }

    const clampedRate = Math.max(0.001, Math.min(0.999, rate));
    const logOdds = applyModifiers(
      Math.log(clampedRate / (1 - clampedRate)),
      profile, hasSexSpecificData, getModifierOR, staticEffect.modifiers
    );
    const adjustedRate = 1 / (1 + Math.exp(-logOdds));
    const pct = Math.max(1, Math.min(95, Math.round(adjustedRate * 100)));
    const ci = computeConfidenceInterval(adjustedRate, communityResult.rates, communityResult.effectiveN);

    realWorld = {
      percentage: pct,
      confidenceInterval: ci,
      confidenceLevel: getConfidenceLevel(communityPoints.length),
      dataPointCount: communityPoints.length,
      basis: `${communityPoints.length} community reports (Reddit, forums, patient experiences, news)`,
      basisNl: `${communityPoints.length} gemeenschapsrapporten (Reddit, forums, patiëntervaringen, nieuws)`,
      isFallback: false,
    };
  } else {
    // No community data — fall back to user-reported baseline from static data
    const userRate = staticEffect.userReportedRate;
    const clampedRate = Math.max(0.001, Math.min(0.999, userRate));
    const logOdds = applyModifiers(
      Math.log(clampedRate / (1 - clampedRate)),
      profile, false, getModifierOR, staticEffect.modifiers
    );
    const adjustedRate = 1 / (1 + Math.exp(-logOdds));
    const pct = Math.max(1, Math.min(95, Math.round(adjustedRate * 100)));

    // CI from user-reported rate with wider uncertainty to reflect community variability
    const ciWidth = Math.max(10, Math.round(pct * 0.4));

    realWorld = {
      percentage: pct,
      confidenceInterval: { low: Math.max(0, pct - ciWidth), high: Math.min(95, pct + ciWidth) },
      confidenceLevel: "low",
      dataPointCount: 0,
      basis: "Aggregate patient-reported baseline (no personalised community data yet)",
      basisNl: "Geaggregeerde patiënt-gerapporteerde baseline (nog geen gepersonaliseerde gemeenschapsdata)",
      isFallback: true,
    };
  }

  // Attribution
  const totalForAttrib = relevantPoints.length || 1;

  return {
    effectId,
    effectName: staticEffect.name, effectNameNl: staticEffect.nameNl,
    severity: staticEffect.severity,
    clinical,
    realWorld,
    attribution: {
      clinical: { count: clinicalPoints.filter(p => p.sourceType === "clinical").length, weight: clinicalPoints.length > 0 ? Math.round((clinicalPoints.length / totalForAttrib) * 100) : 0 },
      userReports: { count: communityPoints.filter(p => p.sourceType === "user_report").length, weight: communityPoints.filter(p => p.sourceType === "user_report").length > 0 ? Math.round((communityPoints.filter(p => p.sourceType === "user_report").length / totalForAttrib) * 100) : 0 },
      regulatory: { count: clinicalPoints.filter(p => p.sourceType === "regulatory").length, weight: clinicalPoints.filter(p => p.sourceType === "regulatory").length > 0 ? Math.round((clinicalPoints.filter(p => p.sourceType === "regulatory").length / totalForAttrib) * 100) : 0 },
      news: { count: communityPoints.filter(p => p.sourceType === "news").length, weight: communityPoints.filter(p => p.sourceType === "news").length > 0 ? Math.round((communityPoints.filter(p => p.sourceType === "news").length / totalForAttrib) * 100) : 0 },
    },
    onsetDays: staticEffect.onsetDays, onsetDaysNl: staticEffect.onsetDaysNl,
    durationWeeks: staticEffect.durationWeeks, durationWeeksNl: staticEffect.durationWeeksNl,
    managementTip: staticEffect.managementTip, managementTipNl: staticEffect.managementTipNl,
    userReportedSeverity: staticEffect.userReportedSeverity, userReportedSeverityNl: staticEffect.userReportedSeverityNl,
    description: staticEffect.description, descriptionNl: staticEffect.descriptionNl,
    sources: relevantPoints.length > 0
      ? relevantPoints.slice(0, 10).map((p) => ({ name: p.sourceName, type: p.sourceType, url: p.sourceUrl }))
      : staticEffect.sources,
  };
}

export async function calculateAllRisks(profile: PatientProfile): Promise<DualTrackRiskResult[]> {
  const modelConfig = await loadModelConfig();
  const effectIds = modelConfig
    ? modelConfig.effects.map((e) => e.id)
    : SIDE_EFFECTS.map((e) => e.id);
  const results = await Promise.all(effectIds.map((id) => calculateDynamicRisk(id, profile)));
  // Sort by the higher of the two track percentages
  return results.sort((a, b) => Math.max(b.clinical.percentage, b.realWorld.percentage) - Math.max(a.clinical.percentage, a.realWorld.percentage));
}
