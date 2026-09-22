// SNAPSHOT — do not edit here. Copied from `scripts/measure-dose-gradients.mjs` in the Magistra
// platform repo by `scripts/sync-github-mirror.mjs` on 2026-09-22.
// Published for peer review: this is the code that computes what the live
// API returns. It is not runnable standalone — import paths assume the
// application tree. Report a defect at https://magistra.health/en/contact.
// Within-trial dose-gradient measurement.
//
// WHY: every rate we publish pools across doses. The predictor rescales a
// pooled rate to a dose tier, and until 2026-09-22 the high-tier multiplier was
// a ratio of two figures typed at the 2026-04-06 seed with no recorded
// derivation. Before re-sourcing that multiplier from the corpus it is worth
// asking the prior question with data rather than assumption: inside a single
// trial, which posts several dose arms under one protocol, one population and
// one adverse-event definition, how much does the rate actually move with dose?
//
// Cross-trial comparison cannot answer that — a high-dose arm of one trial and
// a low-dose arm of another differ in population, duration and reporting as
// well as in dose. Comparing arms WITHIN one registry record holds all of that
// fixed, which is the only fair version of the question available from posted
// results.
//
// METHOD (each restriction exists to remove a specific confound, not to tune
// the answer — run with --no-filters to see what they cost):
//   * Eligible clinical/regulatory rate points only, via the production
//     predicate in src/lib/rate-base.ts. Seed rows, placebo arms, FAERS shares
//     and non-citable sources are already excluded there.
//   * ClinicalTrials.gov rows only: the arm label carries the dose in mg, and
//     the at-risk denominator is posted per arm.
//   * Same DRUG within a comparison. This is not a refinement, it is a
//     correctness fix found while red-teaming the first run (2026-09-22): a
//     trial's arms are not all the same molecule. ACHIEVE-3 (NCT06045221) posts
//     oral semaglutide 7/14 mg beside orforglipron 36 mg, and SURPASS-SWITCH
//     (NCT05564039) posts dulaglutide 4.5 mg beside tirzepatide 15 mg — keyed
//     on trial and effect alone, both produced a "dose gradient" that was
//     really a drug difference, and both landed in the largest-mover rows.
//     Arms whose drug the extraction never resolved are dropped, not pooled
//     under one null key.
//   * Arm n >= MIN_ARM_N. Early-phase dose-finding arms run to 6-20
//     participants, where one event moves a rate by 5-15 points and any
//     gradient found is noise.
//   * Top dose >= MIN_DOSE_RATIO x bottom dose within the same trial and
//     effect, so "the dose differs" is true by a margin.
// Reports the paired lowest-vs-highest arm change per effect, in percentage
// points and as a ratio, with the rise/fall split.
//
//   node scripts/measure-dose-gradients.mjs            # table
//   node scripts/measure-dose-gradients.mjs --json
//   node scripts/measure-dose-gradients.mjs --no-filters
//   node scripts/measure-dose-gradients.mjs --kv       # read production KV
//                                                       instead of the repo file
import fs from "fs";
import { classifyRatePoint, scopeToTrackedEffects } from "../src/lib/rate-base.ts";
import { SIDE_EFFECTS } from "../src/lib/side-effects-data.ts";

const asJson = process.argv.includes("--json");
const noFilters = process.argv.includes("--no-filters");
const fromKv = process.argv.includes("--kv");
const MIN_ARM_N = noFilters ? 0 : 100;
const MIN_DOSE_RATIO = noFilters ? 1 : 2;

/** Effects whose mechanism is gastrointestinal. Used only to report a split,
 *  never to weight or exclude anything. */
const GI = new Set([
  "nausea", "vomiting", "diarrhea", "constipation",
  "reduced_appetite", "abdominal_pain", "acid_reflux",
]);

async function loadPoints() {
  if (!fromKv) {
    return JSON.parse(fs.readFileSync(new URL("../data/side-effects-db.json", import.meta.url), "utf-8"));
  }
  const res = await fetch(
    `${process.env.KV_REST_API_URL}/get/${encodeURIComponent("sideeffects:datapoints")}`,
    { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } },
  );
  const body = await res.json();
  return typeof body.result === "string" ? JSON.parse(body.result) : body.result;
}

/** The arm's dose, from the arm label our collector quotes into rawExcerpt.
 *  Returns null when the label states no mg (MTD and titration arms, and every
 *  "Semaglutide"-with-no-number label) — those arms are dropped rather than
 *  guessed at. */
function armDoseMg(point) {
  const m = (point.rawExcerpt || "").match(/(\d+(?:\.\d+)?)\s*mg/i);
  return m ? parseFloat(m[1]) : null;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const all = await loadPoints();
const tracked = scopeToTrackedEffects(all, SIDE_EFFECTS.map((e) => e.id));
const eligible = tracked.filter(
  (p) =>
    (p.sourceType === "clinical" || p.sourceType === "regulatory") &&
    classifyRatePoint(p) === null &&
    typeof p.extractedRate === "number",
);

// One bucket per (trial, effect, drug); within it, one entry per distinct dose.
const buckets = new Map();
let droppedNoDrug = 0;
for (const p of eligible) {
  const url = (p.sourceUrl || "").split("#")[0];
  if (!url.includes("clinicaltrials.gov")) continue;
  const mg = armDoseMg(p);
  if (mg === null) continue;
  if (!(p.extractedSampleSize >= MIN_ARM_N)) continue;
  if (!p.extractedDrug) { droppedNoDrug++; continue; }
  const key = `${url}||${p.sideEffect}||${p.extractedDrug}`;
  if (!buckets.has(key)) buckets.set(key, new Map());
  buckets.get(key).set(mg, { mg, rate: p.extractedRate, n: p.extractedSampleSize });
}

const comparisons = [];
for (const [key, arms] of buckets) {
  const sorted = [...arms.values()].sort((a, b) => a.mg - b.mg);
  if (sorted.length < 2) continue;
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  if (hi.mg / lo.mg < MIN_DOSE_RATIO) continue;
  const [url, effect, drug] = key.split("||");
  comparisons.push({
    effect,
    url,
    drug,
    arms: sorted.length,
    loMg: lo.mg, loRate: lo.rate, loN: lo.n,
    hiMg: hi.mg, hiRate: hi.rate, hiN: hi.n,
    deltaPp: (hi.rate - lo.rate) * 100,
    ratio: lo.rate > 0 ? hi.rate / lo.rate : null,
  });
}

const byEffect = new Map();
for (const c of comparisons) {
  if (!byEffect.has(c.effect)) byEffect.set(c.effect, []);
  byEffect.get(c.effect).push(c);
}

const rows = [...byEffect]
  .map(([effect, cs]) => {
    const ratios = cs.map((c) => c.ratio).filter((r) => r != null);
    return {
      effect,
      comparisons: cs.length,
      medianDeltaPp: median(cs.map((c) => c.deltaPp)),
      medianRatio: ratios.length ? median(ratios) : null,
      rises: cs.filter((c) => c.deltaPp > 0).length,
      falls: cs.filter((c) => c.deltaPp < 0).length,
      gi: GI.has(effect),
    };
  })
  .sort((a, b) => b.medianDeltaPp - a.medianDeltaPp);

const split = (isGi) => {
  const cs = comparisons.filter((c) => GI.has(c.effect) === isGi);
  return {
    comparisons: cs.length,
    medianDeltaPp: cs.length ? median(cs.map((c) => c.deltaPp)) : null,
    rises: cs.filter((c) => c.deltaPp > 0).length,
    falls: cs.filter((c) => c.deltaPp < 0).length,
  };
};

// Dose-tier census over the same eligible base: which tier of an approved
// maintenance ladder each rate can be placed on at all.
const census = { low: 0, medium: 0, high: 0, unspecified: 0 };
for (const p of eligible) census[p.extractedDoseTier || "unspecified"]++;

const out = {
  measuredAt: new Date().toISOString(),
  source: fromKv ? "production KV" : "data/side-effects-db.json",
  filters: { minArmN: MIN_ARM_N, minDoseRatio: MIN_DOSE_RATIO },
  eligibleClinicalRates: eligible.length,
  armsDroppedUnresolvedDrug: droppedNoDrug,
  doseTierCensus: census,
  trials: new Set(comparisons.map((c) => c.url)).size,
  drugs: [...new Set(comparisons.map((c) => c.drug))].sort(),
  comparisonsByDrug: Object.fromEntries(
    [...new Set(comparisons.map((c) => c.drug))].sort().map((d) => [d, comparisons.filter((c) => c.drug === d).length]),
  ),
  comparisons: comparisons.length,
  perEffect: rows,
  gi: split(true),
  nonGi: split(false),
  detail: comparisons,
};

if (asJson) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`source: ${out.source} — ${out.eligibleClinicalRates} eligible clinical/regulatory rates`);
  console.log(`dose-tier census: ${JSON.stringify(out.doseTierCensus)}`);
  console.log(`arms n>=${MIN_ARM_N}, top/bottom dose >=${MIN_DOSE_RATIO}x`);
  console.log(`${out.comparisons} effect x trial x drug comparisons across ${out.trials} trials`);
  console.log(`by drug: ${JSON.stringify(out.comparisonsByDrug)} (${droppedNoDrug} arms dropped: drug unresolved)\n`);
  console.log("effect                    cmp   median pp   median x   rises  falls");
  for (const r of rows) {
    console.log(
      `${r.effect.padEnd(24)} ${String(r.comparisons).padStart(4)}  ` +
      `${r.medianDeltaPp.toFixed(1).padStart(8)}pp ` +
      `${(r.medianRatio == null ? "-" : r.medianRatio.toFixed(2) + "x").padStart(10)}  ` +
      `${String(r.rises).padStart(5)} ${String(r.falls).padStart(6)}`,
    );
  }
  console.log(`\nGI     : ${out.gi.comparisons} comparisons, median ${out.gi.medianDeltaPp?.toFixed(1)}pp, ${out.gi.rises} rise / ${out.gi.falls} fall`);
  console.log(`non-GI : ${out.nonGi.comparisons} comparisons, median ${out.nonGi.medianDeltaPp?.toFixed(1)}pp, ${out.nonGi.rises} rise / ${out.nonGi.falls} fall`);
}
