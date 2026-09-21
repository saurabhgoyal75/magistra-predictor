// SNAPSHOT — do not edit here. Copied from `scripts/measure-arm-overlap.mjs` in the Magistra
// platform repo by `scripts/sync-github-mirror.mjs` on 2026-09-21.
// Published for peer review: this is the code that computes what the live
// API returns. It is not runnable standalone — import paths assume the
// application tree. Report a defect at https://magistra.health/en/contact.
#!/usr/bin/env node
// ARM-OVERLAP census — READ-ONLY. Asks whether the participants behind our
// published rate counts are counted more than once.
//
// Why this exists (2026-09-17, ASSET INTEGRITY pass): every rate row we store
// from a trial registry is an ARM row — "in arm X (n at risk), term T occurred
// in k participants". `buildRateBase` collapses a study's arms to one study
// entry, so an arm row cannot inflate `distinctSources`. What it DOES inflate
// is `statedRates` — the "N rates from M distinct sources" figure this site
// publishes per effect, site-wide, in the CC BY table and in every evidence
// article — because nothing anywhere checks that a study's arms are disjoint
// cohorts. Many are not: registries post each PERIOD of a crossover or
// dose-escalation study as its own event group over the SAME participants
// (NCT05841238 posts twelve 7-day periods over 52 people; NCT05891496 posts
// "Semaglutide Period 1" n=11 and "Semaglutide Period 2" n=22 of 23 enrolled,
// the second containing the first).
//
// The test is arithmetic and needs no judgement: for one study and one effect,
// sum the at-risk denominators of the arms we store. If that sum exceeds the
// trial's OWN posted enrolment, some participants are inside more than one of
// our rate rows. It cannot false-positive — a study cannot have more people in
// disjoint arms than it enrolled.
//
// READ-ONLY: writes nothing to either store. Prints the affected row count so
// the figure behind any public claim about it is reproducible.
//
// Usage: node scripts/measure-arm-overlap.mjs           (production KV)
//        node scripts/measure-arm-overlap.mjs --file    (repo file)
//        node scripts/measure-arm-overlap.mjs --json    (machine-readable)

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

// The 15 effects the site publishes. Read from the source of truth rather than
// re-typed, so this census cannot drift from the taxonomy it reports on.
function publishedEffects() {
  const src = fs.readFileSync(path.join(process.cwd(), "src", "lib", "side-effects-data.ts"), "utf8");
  return [...src.matchAll(/^ {4}id: "([a-z_]+)"/gm)].map((m) => m[1]);
}

// The arm label and its at-risk denominator, as the collector wrote them into
// the row's own excerpt. Parsing the excerpt rather than trusting
// `extractedSampleSize` is deliberate: the excerpt is the verbatim sentence a
// reader is shown, so a mismatch here is a mismatch in what we published.
const ARM_RE = /In the "([^"]+)" arm \(n=(\d+)/;

async function enrolment(nctId) {
  const res = await fetch(`https://clinicaltrials.gov/api/v2/studies/${nctId}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const study = await res.json();
  return study?.protocolSection?.designModule?.enrollmentInfo?.count ?? null;
}

const points = FILE_ONLY
  ? JSON.parse(fs.readFileSync(REPO_FILE, "utf8"))
  : await kvGet("sideeffects:datapoints");

const effects = new Set(publishedEffects());
const live = points.filter(
  (p) =>
    p.extractedRate != null &&
    !p.rateWithheld &&
    effects.has(p.sideEffect) &&
    /clinicaltrials\.gov\/study\/NCT/.test(p.sourceUrl || "")
);

const byStudy = new Map();
for (const p of live) {
  const nct = (p.sourceUrl.match(/NCT\d+/) || [])[0];
  if (!nct) continue;
  const arm = (p.rawExcerpt || "").match(ARM_RE);
  if (!byStudy.has(nct)) byStudy.set(nct, []);
  byStudy.get(nct).push({ effect: p.sideEffect, arm: arm ? arm[1] : null, n: arm ? +arm[2] : null, id: p.id });
}

const flagged = [];
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
  for (const [effect, arms] of byEffect) {
    const sum = [...arms.values()].reduce((a, b) => a + b, 0);
    if (sum > enrolled) {
      flagged.push({ nct, effect, armDenominatorSum: sum, enrolled, arms: arms.size });
    }
  }
}

const flaggedStudies = [...new Set(flagged.map((f) => f.nct))];
const affectedRows = live.filter((p) => flaggedStudies.some((n) => p.sourceUrl.includes(n)));

const summary = {
  store: FILE_ONLY ? "repo file" : "production KV",
  registryStudiesWithLiveRates: byStudy.size,
  enrolmentUnresolved: unresolved,
  flaggedStudies,
  liveRegistryRates: live.length,
  ratesFromFlaggedStudies: affectedRows.length,
  flagged: flagged.sort((a, b) => b.armDenominatorSum / b.enrolled - a.armDenominatorSum / a.enrolled),
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`store: ${summary.store}`);
  console.log(`registry studies with live rated rows: ${summary.registryStudiesWithLiveRates}`);
  if (unresolved.length) console.log(`enrolment unresolved (not judged): ${unresolved.join(", ")}`);
  console.log(`\n=== studies whose stored arm denominators exceed their own enrolment ===`);
  if (!flagged.length) console.log("  none");
  for (const f of summary.flagged) {
    console.log(
      `  ${f.nct}  ${f.effect.padEnd(18)} ${String(f.arms).padStart(3)} arms  sum n=${String(f.armDenominatorSum).padStart(5)}  enrolled ${String(f.enrolled).padStart(4)}  (${(f.armDenominatorSum / f.enrolled).toFixed(1)}x)`
    );
  }
  console.log(
    `\n${flaggedStudies.length} of ${byStudy.size} registry studies flagged; ` +
      `${affectedRows.length} of ${live.length} live registry rate rows come from them.`
  );
}
