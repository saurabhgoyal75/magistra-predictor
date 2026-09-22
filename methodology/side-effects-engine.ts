// SNAPSHOT — do not edit here. Copied from `src/lib/side-effects-engine.ts` in the Magistra
// platform repo by `scripts/sync-github-mirror.mjs` on 2026-09-22.
// Published for peer review: this is the code that computes what the live
// API returns. It is not runnable standalone — import paths assume the
// application tree. Report a defect at https://magistra.health/en/contact.
// Dynamic Side Effects Risk Calculator — v5.0 (dual-track)
// Two parallel figures per effect, computed from disjoint data streams and
// never blended. They are NOT the same quantity and must not be subtracted:
//   Clinical: an incidence estimate, pooled from eligible clinical/regulatory
//     rate points only (see rate-base.ts), with n and distinct-source count.
//   Community: a reporting FREQUENCY — the share of distinct community reports
//     mentioning the effect. Averaging self-reported percentages from forum
//     posts was withdrawn 2026-08-14 (a mention share is not an incidence),
//     as was the v4.0 "convergence"/gap framing that compared the two.
//   The canonical field name is `reportingFrequency` (2026-09-01, decision
//   rename-realworld-field-2026-08-28); `realWorld` is kept as a deprecated
//   alias, same value, for one release. Likewise `TrackEstimate.confidenceLevel`
//   and `PooledClinicalEstimate.confidence` are source-diversity buckets, not
//   precision statements — `sourceDiversity` is the canonical name for both
//   (decision confidence-label-source-diversity-2026-08-29), old names kept
//   as deprecated aliases, same value.

import { getDataPoints, getMetadata, type SideEffectDataPoint } from "./side-effects-db";
import { SIDE_EFFECTS, calculateRisk as calculateFallbackRisk } from "./side-effects-data";
import { loadModelConfig, getEffectConfig } from "./model-config";
import { buildRateBase, classifyRatePoint, confidenceFromSources, buildReportingFrequency, poolingWeight, wilsonInterval } from "./rate-base";

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
  /** Present (and true) on every normal estimate; absent only on the
   *  discriminant's other branch, UnavailableEstimate — see there. */
  available?: true;
  percentage: number;
  confidenceInterval: { low: number; high: number };
  /** @deprecated use `sourceDiversity` — same value, this name stays one release for back-compat */
  confidenceLevel: "very_low" | "low" | "moderate" | "high" | "very_high";
  /** Bucketed count of DISTINCT sources behind the estimate — not a statement about precision. Canonical name; see confidenceLevel. */
  sourceDiversity: "very_low" | "low" | "moderate" | "high" | "very_high";
  dataPointCount: number;
  /** rate-bearing points that survived the eligibility rules (see rate-base.ts) */
  ratePointCount: number;
  /** DISTINCT sources behind the estimate — the number that matters */
  rateSourceCount: number;
  basis: string;    // e.g. "Published clinical trials (STEP-1, SURMOUNT-5)"
  basisNl: string;
  isFallback: boolean;
  /** The rate BEFORE profile modifiers but AFTER any dose-tier rescale.
   *  `percentage` is this value after `modifiersApplied`; publishing only the
   *  adjusted figure beside an unadjusted basis string let a verified n lend its
   *  credibility to a number it does not stand behind.
   *  Corrected 2026-08-28: this previously claimed to be "the number `basis`
   *  actually describes", which stopped being true the moment the dose rescale
   *  went live for effectively every effect — `pooledPercentage` is that number. */
  unadjustedPercentage?: number;
  /** The corpus's own pooled rate, before BOTH the dose rescale and the profile
   *  modifiers — i.e. the only figure in this object that the `N stated rates from
   *  M distinct sources` half of `basis` stands behind. Equal to
   *  `unadjustedPercentage` when no dose rescale fired. Absent on the real-world
   *  track and on the `isFallback: true` branch, where there is no corpus pool. */
  pooledPercentage?: number;
  /** Profile modifiers applied to reach `percentage`. Clinical track only — the
   *  real-world track is a report count, not a personalized probability. */
  modifiersApplied?: AppliedModifier[];
};

/** The clinical track's shape when an effect has no citable clinical evidence
 *  at all (`SideEffect.noCitableClinicalEvidence`, decision
 *  `literature-fallback-clinical-rate-2026-08-28`, option c) — no corpus rate
 *  AND no citable static literature fallback either, so there is no number to
 *  publish. Distinct from `isFallback: true` on TrackEstimate, which still
 *  publishes a percentage from a labelled literature range. Every consumer of
 *  `DualTrackRiskResult.clinical` must check `available` before reading
 *  `percentage`. */
export type UnavailableEstimate = {
  available: false;
  basis: string;
  basisNl: string;
};

/** One profile modifier as actually applied, with the provenance of its odds
 *  ratio. Deliberately does NOT republish `model:config`'s `n` field: those
 *  values (39/12/45/30/50) are identical for every one of the 15 effects and
 *  no study or citation is recorded for any of them, so printing them beside
 *  an odds ratio would assert an evidentiary base we cannot show. */
export type AppliedModifier = {
  id: string;
  oddsRatio: number;
  /** "corpus-derived" = estimated from our own data points;
   *  "seed-2026-04-12" = hand-coded at seed time, no per-modifier citation recorded */
  provenance: "corpus-derived" | "seed-2026-04-12";
};

export type DualTrackRiskResult = {
  effectId: string;
  effectName: string;
  effectNameNl: string;
  severity: "mild" | "moderate" | "severe";
  clinical: TrackEstimate | UnavailableEstimate;
  /** @deprecated use `reportingFrequency` — same value, this name stays one release for back-compat */
  realWorld: TrackEstimate;
  /** Community reporting frequency (see file header). Canonical name; see realWorld. */
  reportingFrequency: TrackEstimate;
  /** Composition of ALL profile-matched corpus records for this effect, by
   *  source type — every record `relevantPoints` holds after the sex/dose/
   *  ethnicity/exercise filter, BEFORE the eligibility screen (citable-URL,
   *  self-referential, synthetic-source, source-collapsing) that `clinical`'s
   *  own percentage is actually pooled from. Canonical name for what was
   *  `attribution` (alias served 2026-09-04 → 2026-09-07, then dropped under
   *  decision `attribution-field-rename-2026-09-04`) — carried from the 2026-09-04 06:52 peer
   *  review, verified real: the old name and shape (weight-of-evidence-looking
   *  percentages) read as backing the published rate, and did not —
   *  `clinical.basis`'s "N stated rates from M distinct sources" is the
   *  number that does. No computation changed, only the name and this
   *  disclosure. */
  matchedRecords: {
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

type RateSummary = {
  rate: number;
  effectiveN: number;
  rates: number[];
  /**
   * DISTINCT STUDIES (by source URL), not source entries — see
   * `RateBase.studyCount`. One trial posting two MedDRA terms for the same
   * effect is one source to a reader, and grading confidence off the entry
   * count published "moderate" on 2 trials (found 2026-09-10).
   */
  sourceCount: number;
  /** Source ENTRIES (one per sourceName per effect) — the pre-2026-09-10 sourceCount. */
  sourceEntryCount: number;
  pointCount: number;
  /** Of `sourceCount`, how many rest only on registry serious-AE rates (a floor, not incidence). */
  seriousAeSourceCount: number;
  /** Passthrough of `RateBase.phaseMix` — see rate-base.ts. */
  phaseMix: Record<string, number>;
};

// One entry per DISTINCT source (rate-base.ts), so a paper stating 3 rates counts
// once — not three times — and shares-of-reports never enter an incidence average.
function weightedAverageRate(points: SideEffectDataPoint[]): RateSummary | null {
  const base = buildRateBase(points);
  const withRates = base.studies;
  if (withRates.length === 0) return null;

  let rates = withRates.map((s) => s.rate);

  // Winsorize at 5th/95th percentile when >10 points (more conservative than 1st/99th)
  if (rates.length > 10) {
    const sorted = [...rates].sort((a, b) => a - b);
    const lowIdx = Math.max(0, Math.floor(sorted.length * 0.05));
    const highIdx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const low = sorted[lowIdx];
    const high = sorted[highIdx];
    rates = rates.map((r) => Math.max(low, Math.min(high, r)));
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < withRates.length; i++) {
    // `poolingWeight` (rate-base.ts) is this formula's only definition since
    // 2026-09-19 — `drugMix` reports shares of the same weight, and a second
    // copy here would let a published composition drift off the estimate it
    // describes.
    const w = poolingWeight(withRates[i]);
    weightedSum += rates[i] * w;
    totalWeight += w;
  }
  return {
    rate: weightedSum / totalWeight,
    effectiveN: totalWeight,
    rates,
    sourceCount: base.studyCount,
    sourceEntryCount: withRates.length,
    pointCount: base.eligiblePoints,
    seriousAeSourceCount: base.seriousAeStudies,
    phaseMix: base.phaseMix,
  };
}

/**
 * The sentence that keeps a serious-adverse-event rate from being read as
 * incidence. CT.gov posts SAE counts for every term but lists non-serious
 * events only above the trial's reporting threshold, so for an effect whose
 * events are adjudicated serious (pancreatitis, gallbladder disease) the SAE
 * count is the only figure the registry states — genuine, citable, and
 * strictly a lower bound on all-cause incidence. Empty when no such source is
 * in the pool, so an ordinary estimate keeps its plain basis.
 * (Decision `serious-ae-rows-readmit-2026-09-07`, founder-approved 2026-09-08.)
 */
function seriousAeNote(seriousSources: number, totalSources: number, locale: "en" | "nl"): string {
  if (seriousSources === 0) return "";
  const all = seriousSources === totalSources;
  if (locale === "nl") {
    return all
      ? ` — alle ${totalSources} bron${totalSources === 1 ? "" : "nen"} ${totalSources === 1 ? "is een" : "zijn"} percentage${totalSources === 1 ? "" : "s"} voor ERNSTIGE bijwerkingen uit de SAE-tabel van een studieregister: een ondergrens voor de incidentie over alle ernstgraden, geen incidentie zelf`
      : ` — ${seriousSources} van ${totalSources} bronnen ${seriousSources === 1 ? "is een percentage" : "zijn percentages"} voor ERNSTIGE bijwerkingen uit de SAE-tabel van een studieregister, wat de incidentie over alle ernstgraden onderschat`;
  }
  return all
    ? ` — all ${totalSources} source${totalSources === 1 ? "" : "s"} ${totalSources === 1 ? "is a" : "are"} SERIOUS adverse-event rate${totalSources === 1 ? "" : "s"} from a trial registry's SAE table: a floor on all-cause incidence, not incidence itself`
    : ` — ${seriousSources} of ${totalSources} sources ${seriousSources === 1 ? "is a" : "are"} SERIOUS adverse-event rate${seriousSources === 1 ? "" : "s"} from a trial registry's SAE table, which understate all-cause incidence`;
}

/**
 * The sentence that keeps a NARROW interval on a single-source estimate from
 * being read as precision. `computeConfidenceInterval` sets τ² to 0 when only one
 * source entry contributes (k = 1, documented in the preprint's §2.5), so the
 * published interval is that one study's sampling interval and carries NO
 * between-study term at all — it can come out tighter than a well-evidenced
 * effect's interval while resting on far less. The API's `confidenceNote`
 * already tells readers to treat a WIDE interval as the binding statement;
 * nothing said the converse, and hair_loss (3 rates, one trial, 4–7%) is
 * currently the only estimate in this state. Empty when k > 1, so an ordinary
 * estimate keeps its plain basis. (RED TEAM 2026-09-11.)
 */
function singleSourceIntervalNote(entryCount: number, locale: "en" | "nl"): string {
  if (entryCount !== 1) return "";
  return locale === "nl"
    ? " — het interval komt van één bron: er zit geen heterogeniteitsterm tussen studies in (τ² = 0), dus de breedte beschrijft alleen de steekproef van die ene studie, niet hoe goed het percentage bekend is"
    : " — the interval rests on a single source: it contains no between-study heterogeneity term at all (τ² = 0), so its width describes that one study's sampling, not how well the rate is known";
}

export type PooledClinicalEstimate = {
  ratePct: number;
  ciLowPct: number;
  ciHighPct: number;
  statedRates: number;
  /** DISTINCT STUDIES by source URL (re-keyed 2026-09-10; was one entry per sourceName). */
  distinctSources: number;
  /** One entry per sourceName for this effect — the pre-2026-09-10 `distinctSources`. */
  sourceEntries: number;
  /** Of `distinctSources`, how many rest only on registry serious-AE rates. */
  seriousAeSources: number;
  /** Human-readable disclosure when `seriousAeSources > 0`; empty string otherwise. */
  rateKindNote: string;
  rateKindNoteNl: string;
  /** How the interval was computed: "sampling_plus_between_study" normally,
   *  "sampling_only_single_source" when k = 1 and τ² is 0 by construction. */
  intervalBasis: "sampling_plus_between_study" | "sampling_only_single_source";
  /** Human-readable disclosure when `intervalBasis` is single-source; empty otherwise. */
  intervalNote: string;
  intervalNoteNl: string;
  /** @deprecated use `sourceDiversity` — same value, this name stays one release for back-compat */
  confidence: "very_low" | "low" | "moderate" | "high" | "very_high";
  /** Bucketed count of DISTINCT sources behind the estimate — not a statement about precision. Canonical name; see confidence. */
  sourceDiversity: "very_low" | "low" | "moderate" | "high" | "very_high";
  /**
   * Distinct ClinicalTrials.gov sources behind this estimate, by trial phase
   * ("PHASE1".."PHASE4"). A source with no registry phase (a paper, FAERS)
   * contributes to none of these buckets, so the values need not sum to
   * `distinctSources`. Added 2026-09-21 (decision
   * `phase1-registry-rows-pool-as-incidence-2026-09-16`, part 1) — see
   * rate-base.ts's `Study.phase` for why: a phase 1 healthy-volunteer study
   * and a pivotal phase 3 trial were the same kind of "source" in every
   * published count until this was exposed.
   */
  phaseMix: Record<string, number>;
};

/**
 * The corpus's own pooled clinical estimate for one effect: the same weighted
 * rate and random-effects CI the predictor's clinical track starts from,
 * before any dose or profile adjustment. Shared by /api/data and /en/data so
 * the published figure can never drift from what the predictor computes.
 * Returns null when the corpus has zero eligible clinical rate points — the
 * exact case where the predictor falls back to the static literature table.
 */
export function pooledClinicalEstimate(points: SideEffectDataPoint[]): PooledClinicalEstimate | null {
  const clinicalPoints = points.filter((p) => p.sourceType === "clinical" || p.sourceType === "regulatory");
  const result = weightedAverageRate(clinicalPoints);
  if (!result) return null;
  const ci = computeConfidenceInterval(result.rate, result.rates, result.effectiveN);
  const diversity = confidenceFromSources(result.sourceCount);
  return {
    ratePct: Math.round(result.rate * 1000) / 10,
    ciLowPct: ci.low,
    ciHighPct: ci.high,
    statedRates: result.pointCount,
    distinctSources: result.sourceCount,
    sourceEntries: result.sourceEntryCount,
    seriousAeSources: result.seriousAeSourceCount,
    rateKindNote: seriousAeNote(result.seriousAeSourceCount, result.sourceCount, "en").replace(/^ — /, ""),
    rateKindNoteNl: seriousAeNote(result.seriousAeSourceCount, result.sourceCount, "nl").replace(/^ — /, ""),
    intervalBasis: result.rates.length === 1 ? "sampling_only_single_source" : "sampling_plus_between_study",
    intervalNote: singleSourceIntervalNote(result.rates.length, "en").replace(/^ — /, ""),
    intervalNoteNl: singleSourceIntervalNote(result.rates.length, "nl").replace(/^ — /, ""),
    confidence: diversity,
    sourceDiversity: diversity,
    phaseMix: result.phaseMix,
  };
}

/** 95% interval on the log-odds scale, centred on `p`.
 *  `anchorP` is the rate the evidence is dispersed around — the pooled rate the
 *  study rates were averaged into. Every variance term (within-study, τ², and the
 *  delta-method Jacobian) is evaluated THERE, so the interval's width is a
 *  property of the evidence; only its centre moves with `p`.
 *  FIXED 2026-09-04 (daily peer review 2026-09-04, Issue 1, verified against
 *  production): the predictor passed the profile-adjusted rate as `p` and every
 *  term was evaluated at it, so a profile whose modifiers pushed the estimate
 *  toward 50% got a systematically narrower interval than the evidence supports
 *  (vomiting: pooled 8%, 0–96 → adjusted 42%, 12–79 where 1–98 is the
 *  evidence-anchored interval) and one pushed toward the extremes a wider one.
 *  When `anchorP` is omitted (pooled estimates: API, aggregate table) it equals
 *  `p` and the output is unchanged. See preprint "Corrections in v5.4". */
function computeConfidenceInterval(
  p: number,
  studyRates: number[],
  effectiveN: number,
  anchorP: number = p,
  z = 1.96
): { low: number; high: number } {
  if (effectiveN === 0 || studyRates.length === 0) return { low: 0, high: 100 };

  const clampedP = Math.max(0.005, Math.min(0.995, p));
  const clampedA = Math.max(0.005, Math.min(0.995, anchorP));
  const k = studyRates.length;

  // Simplified (unweighted) random-effects tau-squared — inspired by DerSimonian-Laird
  // but does not use inverse-variance weights. See decision dersimonian-laird-method-claim-2026-08-27.
  let tauSq = 0;
  if (k > 1) {
    const mean = studyRates.reduce((a, b) => a + b, 0) / k;
    const Q = studyRates.reduce((sum, r) => sum + (r - mean) ** 2, 0);
    const df = k - 1;
    const withinVar = clampedA * (1 - clampedA) / Math.max(1, effectiveN / k);
    tauSq = Math.max(0, (Q - df * withinVar) / (df > 0 ? df : 1));
  }

  const samplingVar = clampedA * (1 - clampedA) / effectiveN;
  const totalVar = samplingVar + tauSq;
  const seLogOdds = Math.sqrt(totalVar) / (clampedA * (1 - clampedA));

  const logOdds = Math.log(clampedP / (1 - clampedP));
  const lowP = 1 / (1 + Math.exp(-(logOdds - z * seLogOdds)));
  const highP = 1 / (1 + Math.exp(-(logOdds + z * seLogOdds)));

  return {
    low: Math.max(0, Math.round(lowP * 100)),
    high: Math.min(100, Math.round(highP * 100)),
  };
}

// Cap total log-odds shift from modifiers to prevent implausible stacking
const MAX_TOTAL_LOG_ODDS_SHIFT = 2.5; // ~12x max cumulative OR

/** Human-readable disclosure of the modifiers behind an adjusted percentage.
 *  Empty when none fired, so an unmodified estimate keeps its plain basis. */
/** Display rounding for a clinical-track rate. Below 1% keep one decimal
 *  instead of flooring to 1: since 2026-09-04 pancreatitis's static figure is
 *  the FDA label's 0.2 per 100 patient-years (encoded 0.002), and a floor of 1
 *  would print it 5× too high while the whole-number round printed it as 0.
 *  Everything ≥1% renders as before. Was local to the literature-fallback
 *  branch until 2026-09-16; the corpus-derived branch kept the bare floor and
 *  printed pancreatitis's 0.1% pooled serious-AE rate as 1%. */
function displayPct(r: number): number {
  return r * 100 < 1 ? Math.round(r * 1000) / 10 : Math.max(1, Math.min(95, Math.round(r * 100)));
}

function modifierNote(applied: AppliedModifier[], unadjustedPct: number, adjustedPct: number, lang: "en" | "nl"): string {
  if (applied.length === 0) return "";
  // States BOTH endpoints rather than only the multipliers: applyModifiers caps
  // the cumulative log-odds shift, so a listed set of odds ratios need not
  // multiply out to the displayed number if the cap ever binds.
  const list = applied.map((m) => `${m.id} ×${m.oddsRatio}`).join(", ");
  const seeded = applied.some((m) => m.provenance === "seed-2026-04-12");
  if (lang === "nl") {
    return `. Basispercentage ${unadjustedPct}% → ${adjustedPct}% na profielaanpassing (${list})` +
      (seeded ? " — odds ratio's handmatig gecodeerd bij de seed van 2026-04-12, zonder vastgelegde citatie per modifier, niet uit dit corpus afgeleid" : " — odds ratio's afgeleid uit dit corpus");
  }
  return `. Base rate ${unadjustedPct}% → ${adjustedPct}% after profile adjustment (${list})` +
    (seeded ? " — odds ratios hand-coded at the 2026-04-12 seed with no per-modifier citation recorded, not derived from this corpus" : " — odds ratios derived from this corpus");
}

/** Human-readable disclosure of the dose-tier rescale. Two kinds, since Option A
 *  step 2 (founder-approved 2026-09-12): "corpus_derived" (high tier, when the
 *  corpus has at least one high-tagged source) means the displayed rate IS a
 *  corpus-derived high-tier estimate, not a ratio applied to the diluted pool —
 *  its own n and distinct-source count are the real evidentiary basis, disclosed
 *  even at a single source (same pattern as the site's other single-source
 *  pooled-clinical-estimate figures). "static_unsourced" (low tier always —
 *  verified 2026-09-10/22 that the registry reports no isolated low-dose arm for
 *  any drug, so no corpus-derived low estimate can exist — and high tier when an
 *  effect has zero high-tagged sources) means the multiplier is a ratio of two
 *  STATIC reference-table figures with no recorded per-tier derivation (see
 *  side-effects-data.ts). Empty when no rescale fired (majority dose-tagged pool,
 *  or the medium tier, whose ratio is always 1), so an unrescaled estimate keeps
 *  its plain basis.
 *  Added 2026-08-28: the same cycle's `.some()` → majority-threshold fix turned
 *  this rescale from dormant into live for effectively every effect, which made
 *  an undisclosed adjustment load-bearing on a public number for the first time. */
function doseNote(
  pooledPct: number,
  rescaledPct: number,
  tier: string,
  taggedPoints: number,
  poolSize: number,
  lang: "en" | "nl",
  kind: "corpus_derived" | "static_unsourced",
  tierEstimate: { statedRates: number; distinctSources: number } | null
): string {
  if (kind === "corpus_derived" && tierEstimate) {
    const single = tierEstimate.distinctSources === 1;
    if (lang === "nl") {
      return `. Gepoold corpuspercentage ${pooledPct}% → ${rescaledPct}% herschaald naar dosisniveau "${tier}"` +
        ` — het corpus telt slechts ${taggedPoints} van ${poolSize} gepoolde records met een dosislabel, dus is in plaats van de statische tabel een uit dit corpus afgeleide schatting voor dosisniveau "${tier}" gebruikt: ${tierEstimate.statedRates} vermelde percentage${tierEstimate.statedRates === 1 ? "" : "s"} uit ${tierEstimate.distinctSources} afzonderlijke bron${tierEstimate.distinctSources === 1 ? "" : "nen"}${single ? " (één bron — lees met voorzichtigheid)" : ""}. De betrouwbaarheidsgradatie (sourceDiversity) volgt die ${tierEstimate.distinctSources} bron${tierEstimate.distinctSources === 1 ? "" : "nen"}, niet het grotere aantal hierboven`;
    }
    return `. Pooled corpus rate ${pooledPct}% → ${rescaledPct}% rescaled to the ${tier} dose tier` +
      ` — only ${taggedPoints} of ${poolSize} pooled records ${taggedPoints === 1 ? "carries" : "carry"} a dose tag, so a corpus-derived ${tier}-tier estimate was used in place of the static table: ${tierEstimate.statedRates} stated rate${tierEstimate.statedRates === 1 ? "" : "s"} from ${tierEstimate.distinctSources} distinct source${tierEstimate.distinctSources === 1 ? "" : "s"}${single ? " (single source — read with caution)" : ""}. The confidence grade (sourceDiversity) follows those ${tierEstimate.distinctSources} source${tierEstimate.distinctSources === 1 ? "" : "s"}, not the larger count above`;
  }
  if (lang === "nl") {
    return `. Gepoold corpuspercentage ${pooledPct}% → ${rescaledPct}% herschaald naar dosisniveau "${tier}"` +
      ` — slechts ${taggedPoints} van ${poolSize} gepoolde records dragen een dosislabel; er bestaat geen uit dit corpus afgeleid percentage voor dit dosisniveau, dus de verhouding komt uit de statische literatuurreferentietabel (herkomst per dosisniveau niet vastgelegd voor deze bijwerking), niet uit dit corpus`;
  }
  return `. Pooled corpus rate ${pooledPct}% → ${rescaledPct}% rescaled to the ${tier} dose tier` +
    ` — only ${taggedPoints} of ${poolSize} pooled records ${taggedPoints === 1 ? "carries" : "carry"} a dose tag; no corpus-derived rate exists for this dose tier, so the ratio is taken from the static literature reference table (per-tier derivation not recorded for this effect), not derived from this corpus`;
}

function applyModifiers(
  baseLogOdds: number,
  profile: PatientProfile,
  hasSexSpecificData: boolean,
  getMod: (modId: string, fallback: number) => AppliedModifier,
  modifiers: { femaleFactor: number; ageFactor65plus: number; giHistoryFactor: number; diabetesFactor: number; firstMonthFactor: number },
  /** filled with every modifier that actually fired, so the estimate can be
   *  published alongside the adjustments that produced it */
  applied?: AppliedModifier[]
): number {
  let totalShift = 0;
  const use = (modId: string, fallback: number) => {
    const mod = getMod(modId, fallback);
    totalShift += Math.log(mod.oddsRatio);
    applied?.push(mod);
  };

  if (profile.sex === "female" && !hasSexSpecificData) use("sex:female", modifiers.femaleFactor);
  if (profile.age >= 65) use("age:65plus", modifiers.ageFactor65plus);
  if (profile.hasGiHistory) use("hasGiHistory", modifiers.giHistoryFactor);
  if (profile.hasDiabetes) use("hasDiabetes", modifiers.diabetesFactor);
  if (profile.isFirstMonth) use("isFirstMonth", modifiers.firstMonthFactor);

  // Cap total shift
  const cappedShift = Math.max(-MAX_TOTAL_LOG_ODDS_SHIFT, Math.min(MAX_TOTAL_LOG_ODDS_SHIFT, totalShift));
  return baseLogOdds + cappedShift;
}

export async function calculateDynamicRisk(
  effectId: string,
  profile: PatientProfile,
  /** all user_report points, corpus-wide (not filtered by effect) — the reporting-frequency
   *  denominator. Pass this from calculateAllRisks to avoid one extra fetch per effect;
   *  omit for a standalone call and it will be fetched here. */
  allCommunityPointsIn?: { sourceUrl: string; sideEffect: string }[]
): Promise<DualTrackRiskResult> {
  const staticEffect = SIDE_EFFECTS.find((e) => e.id === effectId);
  if (!staticEffect) throw new Error(`Unknown effect: ${effectId}`);

  const allPoints = await getDataPoints({ sideEffect: effectId });
  const allCommunityPoints =
    allCommunityPointsIn ??
    (await getDataPoints({ sourceType: "user_report" })).filter((p) => p.provenance !== "seed-2026-04");

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
  const getModifier = (modId: string, fallbackOR: number): AppliedModifier => {
    const cfg = configEffect?.modifiers[modId];
    if (cfg) return { id: modId, oddsRatio: cfg.oddsRatio, provenance: cfg.source === "empirical" ? "corpus-derived" : "seed-2026-04-12" };
    return { id: modId, oddsRatio: fallbackOR, provenance: "seed-2026-04-12" };
  };

  // Whether the CLINICAL track's own pooled rate already reflects sex-specific
  // filtering — must be scoped to clinicalPoints, not all relevantPoints:
  // a sex-tagged Reddit post (community) previously flipped this true and
  // suppressed the sex:female modifier on a clinical average that itself
  // carried zero sex-tagged points (found 2026-08-27, un-truncated pipeline
  // REVIEW; the realWorld/reporting-frequency track never used this signal).
  // FIXED 2026-08-28 (cloud RED TEAM, daily peer-review §2, confirmed against
  // this source): a `.some()` gate let ONE sex-tagged point among many
  // unspecified ones suppress the modifier for the whole pooled rate,
  // regardless of how little of the pool it represented. Requires a majority
  // of clinicalPoints to carry a sex tag instead — a point-count proxy for
  // pooled weight, not a fully effectiveN-weighted version (weightedAverageRate's
  // per-study weights aren't threaded up to this scope; that is a larger,
  // build-verified follow-up, not this fix).
  const sexTaggedPoints = clinicalPoints.filter((p) => p.extractedDemographics.sex !== "unspecified").length;
  const hasSexSpecificData = clinicalPoints.length > 0 && sexTaggedPoints / clinicalPoints.length >= 0.5;

  // ═══════════════════════════════════════════════
  // TRACK 1: CLINICAL — trial data only, conservative
  // ═══════════════════════════════════════════════
  let clinical: TrackEstimate | UnavailableEstimate;

  const clinicalResult = weightedAverageRate(clinicalPoints);

  if (clinicalResult && clinicalResult.rates.length >= 1) {
    // We have actual clinical data
    const pooledRate = clinicalResult.rate;
    let rate = pooledRate;

    // Dose adjustment if data lacks dose specificity
    // FIXED 2026-08-28 (cloud RED TEAM, same finding as sex above, applied
    // symmetrically): majority-of-points threshold instead of `.some()`.
    const doseTaggedPoints = clinicalPoints.filter((p) => p.extractedDoseTier !== "unspecified").length;
    const hasDoseData = clinicalPoints.length > 0 && doseTaggedPoints / clinicalPoints.length >= 0.5;
    let doseRescaled = false;
    let doseRescaleKind: "corpus_derived" | "static_unsourced" = "static_unsourced";
    let doseTierEstimate: PooledClinicalEstimate | null = null;
    // `profile.doseTier === "medium"` never reaches here with an effect: the ratio
    // clinicalRates.medium/clinicalRates.medium is always 1 by construction, so the
    // `targetRate !== medianRate` guard below already skips it (medium is this
    // model's baseline tier, not a tier that gets rescaled away from itself).
    if (!hasDoseData) {
      if (profile.doseTier === "high") {
        // Option A step 2 (founder-approved 2026-09-12, decision
        // dose-tier-rescale-low-tier-no-registry-data-2026-09-10): prefer a
        // corpus-derived high-tier estimate — pooledClinicalEstimate() on ONLY the
        // points explicitly tagged high, the same tested function the API and the
        // predictor's own aggregate already use, so this is not a second parallel
        // implementation — over the unsourced 2026-04-06 static ratio. Verified
        // 2026-09-22 (cloud) against the repo corpus: 14 of 15 effects now clear at
        // least one distinct high-tier source (up from the "mostly single-source"
        // 09-10/09-16 scoping, on a corpus that has since roughly doubled); falls
        // back to the static ratio only when an effect has none (emotional_blunting
        // today).
        const tierTaggedPoints = clinicalPoints.filter((p) => p.extractedDoseTier === "high");
        const tierEstimate = pooledClinicalEstimate(tierTaggedPoints);
        // Take the RATE from weightedAverageRate, not from tierEstimate.ratePct:
        // the latter is already rounded to one decimal place, and dividing a
        // rounded percentage back by 100 re-enters the engine at lower precision.
        // Found by RED TEAM 2026-09-22 (LOCAL): pancreatitis's high-tier pool
        // rounds to 0.0%, so `ratePct / 100` handed this branch a literal 0 that
        // the downstream 0.001 clamp then republished as 0.1% — the same
        // floor-printed-as-an-estimate class the 2026-09-16 RED TEAM fixed in
        // displayPct, on the one figure the site discloses as a FLOOR on
        // incidence. tierEstimate still supplies every disclosure count.
        const tierResult = weightedAverageRate(tierTaggedPoints);
        if (tierEstimate && tierResult) {
          rate = tierResult.rate;
          doseRescaled = true;
          doseRescaleKind = "corpus_derived";
          doseTierEstimate = tierEstimate;
        }
      }
      if (!doseRescaled) {
        // Low tier (verified 2026-09-10 and re-verified 2026-09-22: the registry
        // corpus reports zero isolated low/starting-dose maintenance arms for any
        // drug — trials report MTD or maintenance arms, low doses appear only
        // inside a titration path — so no corpus-derived low estimate can exist)
        // and the high-tier no-data fallback both use the static reference ratio,
        // disclosed as unsourced.
        const medianRate = staticEffect.clinicalRates.medium;
        const targetRate = staticEffect.clinicalRates[profile.doseTier];
        // `targetRate !== medianRate` skips the medium tier, where the ratio is 1 —
        // a no-op multiply must not produce a disclosure sentence claiming a rescale.
        if (medianRate > 0 && targetRate !== medianRate) {
          rate = rate * (targetRate / medianRate);
          doseRescaled = true;
        }
      }
    }

    const clampedRate = Math.max(0.001, Math.min(0.999, rate));
    const appliedMods: AppliedModifier[] = [];
    const logOdds = applyModifiers(
      Math.log(clampedRate / (1 - clampedRate)),
      profile, hasSexSpecificData, getModifier, staticEffect.modifiers, appliedMods
    );
    const adjustedRate = 1 / (1 + Math.exp(-logOdds));
    // displayPct (not a bare floor of 1): since the 2026-09-10 serious-AE
    // re-admission, pancreatitis's corpus-derived rate is 0.1% — the API and the
    // CC BY table published 0.1 while this branch floored it to 1, a 10×
    // overstatement of the one figure disclosed as a FLOOR on incidence
    // (found by RED TEAM 2026-09-16, live probe at every tier).
    const pct = displayPct(adjustedRate);
    const unadjustedPct = displayPct(clampedRate);
    const pooledPct = displayPct(pooledRate);
    // Anchor the variance at the pooled corpus rate (the evidence), centre on the adjusted one.
    const ci = computeConfidenceInterval(adjustedRate, clinicalResult.rates, clinicalResult.effectiveN, pooledRate);

    const srcs = clinicalResult.sourceCount;
    // Grade the DISPLAYED number, not the pool it was selected from. When the
    // corpus-derived high-tier path fires, the percentage is pooled from the
    // tier-tagged subset, so grading on the whole profile-matched pool awards a
    // confidence label to evidence that did not produce the figure. Found by RED
    // TEAM 2026-09-22 (LOCAL) on the cloud cycle's own change before it shipped:
    // nausea would have published `very_high` (29 pool sources) beside a 42%
    // computed from 5 — and /en/blog/glp1-confidence-grade-does-not-measure-how-
    // common-an-effect-is tells readers, in print, that the grade counts "how
    // many distinct studies state a rate for that effect". `rateSourceCount`
    // deliberately keeps describing the pool: it pairs with `ratePointCount` and
    // `dataPointCount`, which are pool-level by definition, and the basis string
    // states both counts.
    const gradingSrcs = doseRescaleKind === "corpus_derived" && doseTierEstimate ? doseTierEstimate.distinctSources : srcs;
    const doseNoteEn = doseRescaled ? doseNote(pooledPct, unadjustedPct, profile.doseTier, doseTaggedPoints, clinicalPoints.length, "en", doseRescaleKind, doseTierEstimate) : "";
    const doseNoteNl = doseRescaled ? doseNote(pooledPct, unadjustedPct, profile.doseTier, doseTaggedPoints, clinicalPoints.length, "nl", doseRescaleKind, doseTierEstimate) : "";
    clinical = {
      percentage: pct,
      confidenceInterval: ci,
      confidenceLevel: confidenceFromSources(gradingSrcs),
      sourceDiversity: confidenceFromSources(gradingSrcs),
      dataPointCount: clinicalPoints.length,
      ratePointCount: clinicalResult.pointCount,
      rateSourceCount: srcs,
      basis: `${clinicalResult.pointCount} stated rate${clinicalResult.pointCount === 1 ? "" : "s"} from ${srcs} distinct source${srcs === 1 ? "" : "s"} (of ${clinicalPoints.length} clinical/regulatory records matching this profile's sex and dose tier)${seriousAeNote(clinicalResult.seriousAeSourceCount, srcs, "en")}${singleSourceIntervalNote(clinicalResult.rates.length, "en")}${doseNoteEn}${modifierNote(appliedMods, unadjustedPct, pct, "en")}`,
      basisNl: `${clinicalResult.pointCount} vermelde percentage${clinicalResult.pointCount === 1 ? "" : "s"} uit ${srcs} afzonderlijke bron${srcs === 1 ? "" : "nen"} (van ${clinicalPoints.length} klinische/regulatoire records die passen bij het geslacht en dosisniveau van dit profiel)${seriousAeNote(clinicalResult.seriousAeSourceCount, srcs, "nl")}${singleSourceIntervalNote(clinicalResult.rates.length, "nl")}${doseNoteNl}${modifierNote(appliedMods, unadjustedPct, pct, "nl")}`,
      isFallback: false,
      unadjustedPercentage: unadjustedPct,
      pooledPercentage: pooledPct,
      modifiersApplied: appliedMods,
    };
  } else if (staticEffect.noCitableClinicalEvidence) {
    // No corpus rate AND no citable static literature source either (decision
    // literature-fallback-clinical-rate-2026-08-28, option c, founder-approved
    // 2026-09-01) — publish no number rather than the withdrawn static range.
    clinical = {
      available: false,
      basis: "No citable clinical evidence for this effect — the previously published literature range had no rate-stating source behind it and was withdrawn 2026-09-03. We do not publish a clinical percentage until a citable trial, registry or regulatory rate exists.",
      basisNl: "Geen citeerbaar klinisch bewijs voor dit effect — de eerder gepubliceerde literatuurbandbreedte had geen percentage-vermeldende bron en is op 3 september 2026 ingetrokken. We publiceren geen klinisch percentage totdat er een citeerbaar percentage uit een studie, register of toezichthouder bestaat.",
    };
  } else {
    // Fallback: use published trial base rates — clearly labeled
    const baseRate = staticEffect.clinicalRates[profile.doseTier];
    const clampedRate = Math.max(0.001, Math.min(0.999, baseRate));
    const appliedMods: AppliedModifier[] = [];
    const logOdds = applyModifiers(
      Math.log(clampedRate / (1 - clampedRate)),
      profile, false, getModifier, staticEffect.modifiers, appliedMods
    );
    const adjustedRate = 1 / (1 + Math.exp(-logOdds));
    const pct = displayPct(adjustedRate);

    // For fallback: CI from published trial ranges (low to high dose rate),
    // passed through the SAME modifier shift as the point estimate — otherwise a
    // modifier-adjusted percentage can land outside its own unadjusted interval
    // (seen live: fatigue 19% with CI 6–14%).
    const shiftEndpoint = (r: number) => {
      const clamped = Math.max(0.001, Math.min(0.999, r));
      const lo = applyModifiers(
        Math.log(clamped / (1 - clamped)),
        profile, false, getModifier, staticEffect.modifiers
      );
      return displayPct(1 / (1 + Math.exp(-lo)));
    };
    const lowRate = shiftEndpoint(staticEffect.clinicalRates.low);
    const highRate = shiftEndpoint(staticEffect.clinicalRates.high);

    clinical = {
      percentage: pct,
      confidenceInterval: { low: Math.max(0, lowRate), high: Math.min(95, highRate) },
      confidenceLevel: "very_low",
      sourceDiversity: "very_low",
      dataPointCount: 0,
      ratePointCount: 0,
      rateSourceCount: 0,
      // "Published trial rate" until 2026-09-02: overclaimed for effects whose static
      // source (see side-effects-data.ts `sources`) was a review/mechanism paper, not a
      // trial reporting this rate. As of 2026-09-04 every effect that reaches this
      // branch (fatigue 2026-09-03; pancreatitis, hair_loss, dizziness 2026-09-04)
      // carries a figure quoted from the FDA Wegovy prescribing information with a
      // DailyMed URL and a derivation comment in side-effects-data.ts — pancreatitis's
      // is a rate per 100 patient-years, not a proportion (see its comment). The
      // effect with NO citable source at all (emotional_blunting) no longer reaches
      // this branch — see `noCitableClinicalEvidence` above, which returns
      // UnavailableEstimate instead.
      basis: `Published baseline estimate — no citable rate for this effect in our corpus yet${modifierNote(appliedMods, displayPct(clampedRate), pct, "en")}${staticEffect.clinicalRatesUnitNote ? ` ${staticEffect.clinicalRatesUnitNote}` : ""}`,
      basisNl: `Gepubliceerde basisschatting — nog geen citeerbaar percentage in ons corpus${modifierNote(appliedMods, displayPct(clampedRate), pct, "nl")}${staticEffect.clinicalRatesUnitNoteNl ? ` ${staticEffect.clinicalRatesUnitNoteNl}` : ""}`,
      isFallback: true,
      unadjustedPercentage: displayPct(clampedRate),
      modifiersApplied: appliedMods,
    };
  }

  // ═══════════════════════════════════════════════
  // TRACK 2: REAL-WORLD — reporting frequency (top-priority fix, step 3)
  // NOT an incidence estimate: a self-reported "rate" in a forum post is one
  // voice, not a measurement (see rate-base.ts). The only honest question a
  // corpus of community reports can answer is what share of them mention this
  // effect at all — corpus-wide (not profile-filtered: most posts don't state
  // demographics, and a per-profile denominator would mostly be near-zero),
  // so this track deliberately does not take the modifier pipeline clinical
  // does — it is a count, not a personalized probability.
  // ═══════════════════════════════════════════════
  let realWorld: TrackEstimate;
  const freq = buildReportingFrequency(allCommunityPoints, effectId);

  if (freq.totalReports > 0) {
    const pct = Math.round(freq.sharePct);
    const ci = wilsonInterval(freq.mentions, freq.totalReports);

    realWorld = {
      percentage: pct,
      confidenceInterval: ci,
      confidenceLevel: confidenceFromSources(freq.mentions),
      sourceDiversity: confidenceFromSources(freq.mentions),
      dataPointCount: freq.mentions,
      ratePointCount: freq.mentions,
      rateSourceCount: freq.mentions,
      // Platform list is derived from the reports actually counted — a written
      // list said "Reddit, X/Twitter, forums" while every X/Twitter row was a
      // Google News headline (RED TEAM, 2026-08-17).
      basis: `${freq.mentions} of ${freq.totalReports} distinct community reports (${freq.platforms.join(", ")}) mention ${staticEffect.name.toLowerCase()} — reporting frequency, not a measured incidence rate`,
      basisNl: `${freq.mentions} van ${freq.totalReports} afzonderlijke community-meldingen (${freq.platforms.join(", ")}) noemen ${staticEffect.nameNl.toLowerCase()} — meldingsfrequentie, geen gemeten incidentiepercentage`,
      isFallback: false,
    };
  } else {
    // No community reports in the corpus at all — fall back to the static baseline
    const userRate = staticEffect.userReportedRate;
    const pct = Math.max(1, Math.min(95, Math.round(userRate * 100)));
    const ciWidth = Math.max(10, Math.round(pct * 0.4));

    realWorld = {
      percentage: pct,
      confidenceInterval: { low: Math.max(0, pct - ciWidth), high: Math.min(95, pct + ciWidth) },
      confidenceLevel: "very_low",
      sourceDiversity: "very_low",
      dataPointCount: 0,
      ratePointCount: 0,
      rateSourceCount: 0,
      basis: "Published patient-reported baseline — no community reports in our corpus yet",
      basisNl: "Gepubliceerde patiënt-gerapporteerde baseline — nog geen community-meldingen in ons corpus",
      isFallback: true,
    };
  }

  // Matched-record composition — see the type's doc comment: this is the raw
  // profile-matched pool, not the eligibility-screened base `clinical` pools from.
  const totalForAttrib = relevantPoints.length || 1;
  const citableSources = relevantPoints.filter((p) => {
    const reason = classifyRatePoint(p);
    return reason !== "self_referential" && reason !== "synthetic_source" && reason !== "no_citable_url";
  });
  const matchedRecords = {
    clinical: { count: clinicalPoints.filter(p => p.sourceType === "clinical").length, weight: clinicalPoints.length > 0 ? Math.round((clinicalPoints.length / totalForAttrib) * 100) : 0 },
    userReports: { count: communityPoints.filter(p => p.sourceType === "user_report").length, weight: communityPoints.filter(p => p.sourceType === "user_report").length > 0 ? Math.round((communityPoints.filter(p => p.sourceType === "user_report").length / totalForAttrib) * 100) : 0 },
    regulatory: { count: clinicalPoints.filter(p => p.sourceType === "regulatory").length, weight: clinicalPoints.filter(p => p.sourceType === "regulatory").length > 0 ? Math.round((clinicalPoints.filter(p => p.sourceType === "regulatory").length / totalForAttrib) * 100) : 0 },
    news: { count: communityPoints.filter(p => p.sourceType === "news").length, weight: communityPoints.filter(p => p.sourceType === "news").length > 0 ? Math.round((communityPoints.filter(p => p.sourceType === "news").length / totalForAttrib) * 100) : 0 },
  };

  return {
    effectId,
    effectName: staticEffect.name, effectNameNl: staticEffect.nameNl,
    severity: staticEffect.severity,
    clinical,
    realWorld,
    reportingFrequency: realWorld,
    matchedRecords,
    onsetDays: staticEffect.onsetDays, onsetDaysNl: staticEffect.onsetDaysNl,
    durationWeeks: staticEffect.durationWeeks, durationWeeksNl: staticEffect.durationWeeksNl,
    managementTip: staticEffect.managementTip, managementTipNl: staticEffect.managementTipNl,
    userReportedSeverity: staticEffect.userReportedSeverity, userReportedSeverityNl: staticEffect.userReportedSeverityNl,
    description: staticEffect.description, descriptionNl: staticEffect.descriptionNl,
    // Only sources a reader could actually check — no self-referential seeds.
    sources: citableSources.length > 0
      ? citableSources.slice(0, 10).map((p) => ({ name: p.sourceName, type: p.sourceType, url: p.sourceUrl }))
      : staticEffect.sources,
  };
}

export async function calculateAllRisks(profile: PatientProfile): Promise<DualTrackRiskResult[]> {
  const modelConfig = await loadModelConfig();
  const effectIds = modelConfig
    ? modelConfig.effects.map((e) => e.id)
    : SIDE_EFFECTS.map((e) => e.id);
  const allCommunityPoints = (await getDataPoints({ sourceType: "user_report" })).filter(
    (p) => p.provenance !== "seed-2026-04"
  );
  const results = await Promise.all(effectIds.map((id) => calculateDynamicRisk(id, profile, allCommunityPoints)));
  // Sort by the higher of the two track percentages. `clinical.available === false`
  // (no citable evidence at all) has no percentage to compare — treat as 0, the
  // real-world track still sorts it correctly by its own number.
  const clinicalPct = (r: DualTrackRiskResult) => (r.clinical.available === false ? 0 : r.clinical.percentage);
  return results.sort((a, b) => Math.max(clinicalPct(b), b.realWorld.percentage) - Math.max(clinicalPct(a), a.realWorld.percentage));
}
