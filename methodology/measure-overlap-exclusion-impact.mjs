// SNAPSHOT — do not edit here. Copied from `scripts/measure-overlap-exclusion-impact.mjs` in the Magistra
// platform repo by `scripts/sync-github-mirror.mjs` on 2026-09-21.
// Published for peer review: this is the code that computes what the live
// API returns. It is not runnable standalone — import paths assume the
// application tree. Report a defect at https://magistra.health/en/contact.
#!/usr/bin/env node
// OVERLAP-EXCLUSION IMPACT — READ-ONLY, and the reproducer for any public
// claim about what the repeated-participant problem costs us.
//
// `measure-arm-overlap.mjs` (2026-09-17) answers "which studies count the same
// people more than once?" by pure arithmetic: sum the at-risk denominators of
// the arms we store for one study and one effect, and if that sum exceeds the
// trial's own posted enrolment, some participants sit inside more than one of
// our rate rows. It cannot false-positive.
//
// It does not answer the question a reader actually asks next — SO WHAT? This
// script does, by running the SAME function production publishes from
// (`pooledClinicalEstimate`, `src/lib/side-effects-engine.ts`) twice per
// effect: once over every eligible point, once with the flagged studies'
// rows removed. A hand-rolled filter over the raw store would silently
// disagree with the production screen one field at a time (LEARNINGS,
// 2026-09-21), so the predicate is imported, never reimplemented.
//
// Written 2026-09-21 (LOCAL 1543) BEFORE the claim shipped, per the rule that
// a measurement reaching a public surface gets its script committed first.
//
// READ-ONLY: writes nothing to either store.
//
// Usage (the resolve hook is REQUIRED — this script imports the site's real
// TypeScript engine, and bare Node will not resolve `./side-effects-db` to a
// `.ts` file; without it the script dies on ERR_MODULE_NOT_FOUND):
//
//   node --experimental-strip-types --import ./scripts/lib/register-ts-resolve.mjs \
//     scripts/measure-overlap-exclusion-impact.mjs          (production KV)
//                                              ... --file   (repo file)
//                                              ... --json

import fs from "fs";
import path from "path";

const FILE_ONLY = process.argv.includes("--file");
const AS_JSON = process.argv.includes("--json");
const REPO_FILE = path.join(process.cwd(), "data", "side-effects-db.json");
const FETCH_TIMEOUT_MS = 30000;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(path.join(process.cwd(), ".env"));

async function kvGet(key) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`KV GET ${key} -> ${res.status}`);
  const body = await res.json();
  return typeof body.result === "string" ? JSON.parse(body.result) : body.result;
}

// Same source of truth as the census: the 15 ids the site publishes.
function publishedEffects() {
  const src = fs.readFileSync(path.join(process.cwd(), "src", "lib", "side-effects-data.ts"), "utf8");
  return [...src.matchAll(/^ {4}id: "([a-z_]+)"/gm)].map((m) => m[1]);
}

const ARM_RE = /In the "([^"]+)" arm \(n=(\d+)/;

async function enrolment(nctId) {
  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies/${nctId}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const study = await res.json();
  return study?.protocolSection?.designModule?.enrollmentInfo?.count ?? null;
}

const { pooledClinicalEstimate } = await import(
  path.join(process.cwd(), "src", "lib", "side-effects-engine.ts")
);

const points = FILE_ONLY
  ? JSON.parse(fs.readFileSync(REPO_FILE, "utf8"))
  : await kvGet("sideeffects:datapoints");

const effects = publishedEffects();
const effectSet = new Set(effects);

// --- step 1: reproduce the census, so this script stands alone -------------
const live = points.filter(
  (p) =>
    p.extractedRate != null &&
    !p.rateWithheld &&
    effectSet.has(p.sideEffect) &&
    /clinicaltrials\.gov\/study\/NCT/.test(p.sourceUrl || "")
);

const byStudy = new Map();
for (const p of live) {
  const nct = (p.sourceUrl.match(/NCT\d+/) || [])[0];
  if (!nct) continue;
  const arm = (p.rawExcerpt || "").match(ARM_RE);
  if (!byStudy.has(nct)) byStudy.set(nct, []);
  byStudy.get(nct).push({ effect: p.sideEffect, arm: arm ? arm[1] : null, n: arm ? +arm[2] : null });
}

const flaggedDetail = [];
const unresolved = [];
for (const [nct, rows] of byStudy) {
  const enrolled = await enrolment(nct);
  if (enrolled == null) {
    unresolved.push(nct);
    continue;
  }
  const byEffect = new Map();
  for (const r of rows) {
    if (!r.arm || r.n == null) continue;
    if (!byEffect.has(r.effect)) byEffect.set(r.effect, new Map());
    byEffect.get(r.effect).set(r.arm, r.n);
  }
  let worst = null;
  for (const [, arms] of byEffect) {
    const sum = [...arms.values()].reduce((a, b) => a + b, 0);
    if (sum > enrolled && (!worst || sum > worst.sum)) worst = { sum, arms: arms.size };
  }
  if (worst)
    flaggedDetail.push({
      nct,
      enrolled,
      armDenominatorSum: worst.sum,
      arms: worst.arms,
      ratio: worst.sum / enrolled,
      // How many of our live registry rate rows this one study supplies. A
      // claim an article makes has to be printable by this script before it
      // ships (LEARNINGS 2026-09-18), and "which of the six costs us most" is
      // the first thing a reader asks after the ratio.
      liveRates: live.filter((p) => (p.sourceUrl || "").includes(nct)).length,
    });
}
flaggedDetail.sort((a, b) => b.ratio - a.ratio);
const flagged = flaggedDetail.map((f) => f.nct);
const affectedRows = live.filter((p) => flagged.some((n) => p.sourceUrl.includes(n)));

// --- step 2: what the published figures would be without them ---------------
const keep = (p) => !flagged.some((n) => (p.sourceUrl || "").includes(n));

const rows = [];
for (const id of effects) {
  const all = points.filter((p) => p.sideEffect === id);
  const before = pooledClinicalEstimate(all);
  const after = pooledClinicalEstimate(all.filter(keep));
  rows.push({
    effect: id,
    before: before && {
      ratePct: before.ratePct,
      ciLowPct: before.ciLowPct,
      ciHighPct: before.ciHighPct,
      statedRates: before.statedRates,
      distinctSources: before.distinctSources,
      sourceDiversity: before.sourceDiversity,
    },
    after: after && {
      ratePct: after.ratePct,
      ciLowPct: after.ciLowPct,
      ciHighPct: after.ciHighPct,
      statedRates: after.statedRates,
      distinctSources: after.distinctSources,
      sourceDiversity: after.sourceDiversity,
    },
  });
}

const moved = rows.filter((r) => r.before && r.after && r.before.ratePct !== r.after.ratePct);
const biggestMove = moved.reduce(
  (m, r) => Math.max(m, Math.abs(r.before.ratePct - r.after.ratePct)),
  0
);
const gradeChanges = rows.filter(
  (r) => r.before && r.after && r.before.sourceDiversity !== r.after.sourceDiversity
);

const summary = {
  store: FILE_ONLY ? "repo file" : "production KV",
  measuredAt: new Date().toISOString(),
  registryStudiesWithLiveRates: byStudy.size,
  enrolmentUnresolved: unresolved,
  flaggedStudies: flaggedDetail,
  liveRegistryRates: live.length,
  ratesFromFlaggedStudies: affectedRows.length,
  biggestPooledMovePp: Math.round(biggestMove * 10) / 10,
  effectsWhosePooledEstimateMoves: moved.length,
  effectsWhoseDiversityGradeChanges: gradeChanges.map((r) => r.effect),
  rows,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`store: ${summary.store}   measured: ${summary.measuredAt}`);
  console.log(
    `${flagged.length} of ${byStudy.size} registry studies fail the enrolment test; ` +
      `${affectedRows.length} of ${live.length} live registry rate rows come from them ` +
      `(${((affectedRows.length / live.length) * 100).toFixed(1)}%).`
  );
  if (unresolved.length) console.log(`enrolment unresolved (not judged): ${unresolved.join(", ")}`);
  console.log(`\n=== flagged studies (worst effect per study) ===`);
  for (const f of flaggedDetail) {
    console.log(
      `  ${f.nct}  ${String(f.arms).padStart(3)} arms  sum n=${String(f.armDenominatorSum).padStart(5)}  enrolled ${String(f.enrolled).padStart(4)}  (${f.ratio.toFixed(1)}x)  ${String(f.liveRates).padStart(4)} live rate rows`
    );
  }
  console.log(`\n=== published clinical estimate, with and without them ===`);
  console.log(
    `  ${"effect".padEnd(24)} ${"published".padEnd(26)} ${"without flagged studies".padEnd(26)} move`
  );
  for (const r of rows) {
    const fmt = (e) =>
      e ? `${String(e.ratePct).padStart(5)}% ${String(e.statedRates).padStart(4)}/${String(e.distinctSources).padEnd(3)} ${e.sourceDiversity}`.padEnd(26) : "none".padEnd(26);
    const move =
      r.before && r.after ? `${(r.after.ratePct - r.before.ratePct >= 0 ? "+" : "") + (Math.round((r.after.ratePct - r.before.ratePct) * 10) / 10)}pp` : "—";
    console.log(`  ${r.effect.padEnd(24)} ${fmt(r.before)} ${fmt(r.after)} ${move}`);
  }
  console.log(
    `\nbiggest pooled move: ${summary.biggestPooledMovePp}pp across ${moved.length} effects; ` +
      `source-diversity grade changes: ${gradeChanges.length ? gradeChanges.map((r) => `${r.effect} ${r.before.sourceDiversity}->${r.after.sourceDiversity}`).join(", ") : "none"}`
  );
}
