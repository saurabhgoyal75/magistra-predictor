// SNAPSHOT — do not edit here. Copied from `src/lib/rate-base.ts` in the Magistra
// platform repo by `scripts/sync-github-mirror.mjs` on 2026-08-30.
// Published for peer review: this is the code that computes what the live
// API returns. It is not runnable standalone — import paths assume the
// application tree. Report a defect at https://magistra.health/en/contact.
// Rate base — what a published incidence estimate is actually allowed to rest on.
// Added 2026-08-13 (top-priority rate-estimation fix, step 2).
//
// Single source of truth for three rules, so the engine, the public API and the
// offline audit script cannot drift apart:
//
//   1. CITABLE ORIGIN — a rate may only enter an estimate if it came from an
//      external, linkable source. 78 of 240 rate-points in the corpus carry a
//      sourceUrl pointing at magistra.health/nl/science#<effect> (they were
//      seeded from our own static page in April), and 15 more are attributed to
//      a synthetic "Aggregated user reports" source. Neither can be cited, so
//      neither may support a published number.
//   2. SPONTANEOUS-REPORT SHARES ARE NOT INCIDENCE — FAERS tells us what share
//      of adverse-event *reports* mention an effect (its own excerpt says
//      "reported events, not incidence rates"). Averaging that into an
//      incidence estimate is a category error, and with n=82,377 it silently
//      dominated every clinical estimate and collapsed the confidence interval.
//      Kept as a separate labelled signal; never averaged into a rate.
//   3. ONE SOURCE, ONE STUDY — a single paper contributing 3-12 rates was being
//      counted as 3-12 independent observations, inflating effectiveN and the
//      heterogeneity term. Rates are collapsed to one entry per distinct source.
//
// No import: the file is loaded directly by `scripts/rate-base.mjs` via Node's
// TypeScript stripping, so it must stay dependency-free.

export type RatePoint = {
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  extractedRate: number | null;
  extractedSampleSize: number | null;
  extractionConfidence: string;
};

export type ExclusionReason =
  | "no_rate"
  | "rate_out_of_range"
  | "no_citable_url"
  | "self_referential"
  | "synthetic_source"
  | "spontaneous_report_share"
  | "aggregator_result";

export type Study = {
  source: string;
  url: string;
  rate: number;
  sampleSize: number;
  confidence: string;
  pointCount: number;
};

export type RateBase = {
  studies: Study[];
  /** rate-bearing points that survived eligibility (before source collapsing) */
  eligiblePoints: number;
  /** every rate-bearing point considered, eligible or not */
  ratePoints: number;
  excluded: Partial<Record<ExclusionReason, number>>;
  /** FAERS-style share-of-reports signals, kept separate from incidence */
  reportShares: { source: string; url: string; share: number; reports: number }[];
};

const CONFIDENCE_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

// Hosts that index other people's content. A point hosted here is a search
// result *about* a source, never the source itself — several collectors query
// Google News RSS with a `site:` operator and store the results branded with
// the site they searched for, so the sourceName says "Twitter/X" or "WHO" while
// the artifact is a Google News headline (RED TEAM, 2026-08-17).
const AGGREGATOR_HOSTS = new Set(["news.google.com"]);

function reportHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isAggregatorUrl(url: string): boolean {
  const host = reportHost(url);
  return host !== null && AGGREGATOR_HOSTS.has(host);
}

/** A point whose "source" is our own site is not external evidence of anything. */
function isSelfReferentialUrl(url: string): boolean {
  return /(^|\/\/|\.)magistra\.health/i.test(url);
}

/**
 * A community report must come from the community platform itself — not an
 * aggregator's index of it, and not our own site. 15 "seed-2026-04" points
 * carry sourceUrl `magistra.health/nl/science#<effect>` (synthetic seed text,
 * branded "Reddit r/loseit & r/Mounjaro user reports" but never a real post)
 * — already excluded from the clinical/regulatory rate track via
 * `classifyRatePoint`'s identical check. `buildReportingFrequency` itself had
 * no equivalent filter; both of its current callers (`api/data/route.ts`'s
 * `communityReports()`, `side-effects-engine.ts`) happened to pre-filter
 * `provenance !== "seed-2026-04"` before calling it, so today's published
 * numbers were already correct by caller-side duplication, not by this
 * function's own contract — found in an ASSET INTEGRITY pass, 2026-08-22,
 * checking whether `isCommunityReport`'s screening matched
 * `classifyRatePoint`'s. Moved the check here so a third caller can't forget
 * the same manual filter and leak seed rows into a public number again — the
 * duplicated-filter pattern this replaces is the exact fragility LEARNINGS
 * already names for the clinical track's own self-referential check.
 */
/**
 * The subreddits `agents/data/src/scrapers/reddit.mjs` is configured to
 * collect from — GLP-1, weight-management and diabetes communities. Kept in
 * sync with SUBREDDITS there by hand; a post from anywhere else was never
 * something we set out to collect.
 */
const GLP1_SUBREDDITS = new Set(
  [
    "Mounjaro", "Ozempic", "Zepbound", "loseit",
    "WegovyWeightLoss", "semaglutide", "tirzepatide",
    "PeptideSource", "compoundedtirzepatide",
    "PCOS", "diabetes", "diabetes_t2",
    "GLP1_Drugs", "ObesityScience", "BodyRecomposition", "intermittentfasting",
  ].map((s) => s.toLowerCase())
);

/**
 * A Reddit post counts as a GLP-1 community report only if it is in one of the
 * communities we collect from.
 *
 * Found 2026-08-29: the scraper's `restrict_sr=1` does not hold on
 * old.reddit's search.json, and its search terms are generic symptom words
 * ("nausea vomiting", "gallbladder", "constipation diarrhea"). So the corpus
 * had absorbed 159 of its 185 distinct community reports (86%) from
 * subreddits we never configured — r/gallbladders (102 points), r/AskDocs
 * (82), r/pregnant (26), r/HyperemesisGravidarum, r/Ovariancancer,
 * r/Christianity — pregnancy nausea and post-cholecystectomy pain counted as
 * GLP-1 patient reports, in the denominator AND the numerator of every
 * published reporting frequency. The mislabelled sourceNames hid it: each
 * point was branded with the subreddit we queried, not the one it came from,
 * so the corpus read as if it were all GLP-1 communities. Screening here
 * rather than at either call site, for the same reason the seed-point check
 * moved here in August: a third caller must not be able to forget it.
 *
 * This is a screen on the report POPULATION, not on rates — no clinical or
 * regulatory estimate depends on it.
 */
function isOnTopicCommunityUrl(url: string): boolean {
  const sub = /reddit\.com\/r\/([A-Za-z0-9_]+)/i.exec(url);
  if (!sub) return true; // non-Reddit community hosts (drugs.com, forums) are unaffected
  return GLP1_SUBREDDITS.has(sub[1].toLowerCase());
}

export function isCommunityReport(url: string): boolean {
  return (
    reportHost(url) !== null &&
    !isAggregatorUrl(url) &&
    !isSelfReferentialUrl(url) &&
    isOnTopicCommunityUrl(url)
  );
}

// A study weight may only come from a source that reports a study population.
// Social/forum points carried extracted "sample sizes" of 500,000 and 40,000,000
// (follower or impression counts, not cohorts) and, being weights, they decided
// the community average on their own. A post is one voice: n=1.
export function studyWeight(p: RatePoint): number {
  const isStudy = p.sourceType === "clinical" || p.sourceType === "regulatory";
  return isStudy ? Math.max(1, p.extractedSampleSize || 1) : 1;
}

function isFaers(p: RatePoint): boolean {
  return /api\.fda\.gov|faers/i.test(`${p.sourceUrl || ""} ${p.sourceName || ""}`);
}

/** Why this point may or may not support a published incidence estimate. */
export function classifyRatePoint(p: RatePoint): ExclusionReason | null {
  if (p.extractedRate === null || p.extractedRate === undefined) return "no_rate";
  if (p.extractedRate < 0 || p.extractedRate > 1) return "rate_out_of_range";
  if (/aggregat/i.test(p.sourceName || "")) return "synthetic_source";
  const url = p.sourceUrl || "";
  if (!/^https?:\/\//i.test(url)) return "no_citable_url";
  if (isSelfReferentialUrl(url)) return "self_referential";
  // A news-aggregator result is a headline and a one-line blurb behind a
  // redirect stub — not something a reader can cite, and not a source that
  // stated a rate. Found 2026-08-17: six such points carried rates, including
  // the "76% hair loss" X/Twitter headline whose earlier weighted form
  // produced this project's worst published error. Screening on the URL host
  // keeps it out of the eligible base by construction, not by re-weighting.
  if (isAggregatorUrl(url)) return "aggregator_result";
  if (isFaers(p)) return "spontaneous_report_share";
  return null;
}

/**
 * Collapse a set of data points into one entry per distinct source, plus the
 * audit trail of what was excluded and why.
 */
export function buildRateBase(points: RatePoint[]): RateBase {
  const excluded: Partial<Record<ExclusionReason, number>> = {};
  const reportShares: RateBase["reportShares"] = [];
  const bySource = new Map<string, Study>();
  let ratePoints = 0;
  let eligiblePoints = 0;

  for (const p of points) {
    const reason = classifyRatePoint(p);
    if (reason !== "no_rate") ratePoints++;
    if (reason) {
      excluded[reason] = (excluded[reason] || 0) + 1;
      if (reason === "spontaneous_report_share") {
        const m = /reported (\d+) times/i.exec((p as RatePoint & { rawExcerpt?: string }).rawExcerpt || "");
        reportShares.push({
          source: p.sourceName,
          url: p.sourceUrl,
          share: p.extractedRate as number,
          reports: m ? Number(m[1]) : 0,
        });
      }
      continue;
    }
    eligiblePoints++;

    const key = (p.sourceName || p.sourceUrl).trim().toLowerCase();
    const existing = bySource.get(key);
    if (!existing) {
      bySource.set(key, {
        source: p.sourceName,
        url: p.sourceUrl,
        rate: p.extractedRate as number,
        sampleSize: studyWeight(p),
        confidence: p.extractionConfidence,
        pointCount: 1,
      });
      continue;
    }
    // Running mean of the rates this source states, best sample size, best confidence.
    existing.rate = (existing.rate * existing.pointCount + (p.extractedRate as number)) / (existing.pointCount + 1);
    existing.pointCount++;
    existing.sampleSize = Math.max(existing.sampleSize, studyWeight(p));
    if ((CONFIDENCE_RANK[p.extractionConfidence] ?? 0) > (CONFIDENCE_RANK[existing.confidence] ?? 0)) {
      existing.confidence = p.extractionConfidence;
    }
  }

  return { studies: [...bySource.values()], eligiblePoints, ratePoints, excluded, reportShares };
}

/** Confidence follows the number of DISTINCT sources, never the corpus size. */
export function confidenceFromSources(sourceCount: number): "very_low" | "low" | "moderate" | "high" | "very_high" {
  if (sourceCount <= 1) return "very_low";
  if (sourceCount <= 3) return "low";
  if (sourceCount <= 9) return "moderate";
  if (sourceCount <= 24) return "high";
  return "very_high";
}

// --- Reporting frequency (top-priority fix, step 3, 2026-08-14) ---
//
// A community post's "rate" is one voice, not a measured incidence — a single
// Twitter post claiming "76% of us get this" (n=500,000 follower count, not a
// cohort) still pulled a 2-source hair_loss average to 39% even after
// studyWeight capped its WEIGHT to 1, because the VALUE itself was never
// screened. Averaging self-reported percentages from anecdotal posts is not
// measurable and cannot be fixed by re-weighting. The only honest question a
// corpus of forum/social posts can answer is: of N distinct community
// reports, what share MENTION this effect at all. That is a real, bounded,
// reproducible denominator (893 user_report points collapse to 246 distinct
// posts via dedupe key sourceUrl::sideEffect) — never call it incidence or
// prevalence, only reporting frequency.

export type ReportingFrequency = {
  /** distinct community reports (by sourceUrl) that mention this effect */
  mentions: number;
  /** distinct community reports (by sourceUrl) across ALL effects — the denominator */
  totalReports: number;
  sharePct: number; // 0-100
  /** platforms actually in the denominator, most reports first — derived, never written */
  platforms: string[];
};

// A news-aggregator URL is not a community report either (RED TEAM,
// 2026-08-17). `twitter.mjs` and `quora.mjs` query Google News RSS with
// `site:twitter.com` / `site:quora.com` and store the RESULTS as `user_report`
// branded "Twitter/X —" and "Quora —". What is stored is a Google News headline
// plus a one-line blurb, not a patient's post — 47 of 232 distinct "community
// reports" (20%) were these, and removing them moved the published nausea
// figure from 32.8% to 24.9%. Screen on the URL host (`isCommunityReport`
// above), not the scraper-written name.
export function buildReportingFrequency(
  allCommunityPoints: { sourceUrl: string; sideEffect: string }[],
  effectId: string
): ReportingFrequency {
  const points = allCommunityPoints.filter((p) => isCommunityReport(p.sourceUrl));
  const totalReports = new Set(points.map((p) => p.sourceUrl)).size;
  const mentioningUrls = new Set(
    points.filter((p) => p.sideEffect === effectId).map((p) => p.sourceUrl)
  );

  const perHost = new Map<string, Set<string>>();
  for (const p of points) {
    const host = reportHost(p.sourceUrl);
    if (!host) continue;
    if (!perHost.has(host)) perHost.set(host, new Set());
    perHost.get(host)!.add(p.sourceUrl);
  }

  return {
    mentions: mentioningUrls.size,
    totalReports,
    sharePct: totalReports > 0 ? (mentioningUrls.size / totalReports) * 100 : 0,
    platforms: [...perHost.entries()].sort((a, b) => b[1].size - a[1].size).map(([host]) => host),
  };
}

/**
 * Wilson score interval for a proportion. Appropriate for a mentions/total
 * count (what reporting frequency is) — unlike the clinical track's random-effects interval
 * in side-effects-engine.ts, which assumes pooled rate STUDIES and doesn't
 * apply to a single corpus-wide count.
 */
export function wilsonInterval(successes: number, total: number, z = 1.96): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 100 };
  const p = successes / total;
  const denom = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    low: Math.max(0, Math.round(((center - margin) / denom) * 100)),
    high: Math.min(100, Math.round(((center + margin) / denom) * 100)),
  };
}

// --- Source inventory (RED TEAM finding, 2026-08-17) ---
//
// `/api/data?q=overview` and `/en/data` published a hand-written list of eight
// data sources. Audited against production KV on 2026-08-17: FOUR of the eight
// had never contributed a single point — "Google Scholar", "1mg.com India (5
// generic brands)", "Express Pharma, Pharmabiz, ETHealthworld" and "PvPI India
// (Pharmacovigilance Programme)" were all zero, first point to last. Three of
// those names are the exact outlets we pitched on 2026-08-16, so a reporter
// checking our API would have found their own masthead claimed as a Magistra
// data feed. A fifth (Reddit) was listed as live while its last point is dated
// 2026-05-28 — reddit.com has served the scraper a 403 block page since.
//
// A hand-maintained list of sources cannot stay true: a scraper that dies goes
// on being advertised, because nothing ties the claim to the corpus. So the
// list is derived from the points themselves. A source that has produced
// nothing cannot appear; a source that has stopped shows the date it stopped.
// Seeded points are excluded, as they are from every other public total.

export type SourceInventoryEntry = {
  /** stable family id — the /en/data cards key their copy off this */
  id: string;
  /** display label */
  label: string;
  /** points in the corpus attributable to this family */
  points: number;
  /** ISO date (YYYY-MM-DD) of the most recent point */
  lastSeen: string;
  /** no new point in 30+ days — the scraper is blocked, rate-limited or dead */
  stale: boolean;
};

/** hostname → family. Anything unmapped falls into `journals`. */
const SOURCE_FAMILIES: { id: string; label: string; hosts: string[] }[] = [
  { id: "pubmed", label: "PubMed / PMC (NCBI E-utilities)", hosts: ["pubmed.ncbi.nlm.nih.gov", "pmc.ncbi.nlm.nih.gov"] },
  { id: "faers", label: "FDA FAERS (openFDA API)", hosts: ["api.fda.gov"] },
  { id: "trials", label: "ClinicalTrials.gov (API v2)", hosts: ["clinicaltrials.gov"] },
  { id: "reddit", label: "Reddit (16 subreddits)", hosts: ["reddit.com", "old.reddit.com"] },
  { id: "news", label: "Health news (Google News RSS)", hosts: ["news.google.com"] },
  { id: "reviews", label: "Drugs.com patient reviews", hosts: ["drugs.com"] },
  { id: "preprints", label: "medRxiv / bioRxiv preprints", hosts: ["doi.org", "medrxiv.org", "biorxiv.org"] },
];

const JOURNALS_FAMILY = { id: "journals", label: "Journal & institutional pages" };

const STALE_AFTER_DAYS = 30;

export function buildSourceInventory(
  points: { sourceUrl: string; scrapedAt: string; provenance?: string }[],
  now: Date = new Date()
): SourceInventoryEntry[] {
  const hostToFamily = new Map<string, { id: string; label: string }>();
  for (const f of SOURCE_FAMILIES) {
    for (const h of f.hosts) hostToFamily.set(h, { id: f.id, label: f.label });
  }

  const acc = new Map<string, { label: string; points: number; last: string }>();
  for (const p of points) {
    if (p.provenance === "seed-2026-04") continue;
    let host = "";
    try {
      host = new URL(p.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      continue; // no citable URL — it is not evidence of a source
    }
    const family = hostToFamily.get(host) ?? JOURNALS_FAMILY;
    const entry = acc.get(family.id) ?? { label: family.label, points: 0, last: "" };
    entry.points += 1;
    if ((p.scrapedAt || "") > entry.last) entry.last = p.scrapedAt || "";
    acc.set(family.id, entry);
  }

  const staleBefore = new Date(now.getTime() - STALE_AFTER_DAYS * 86400000).toISOString();
  return [...acc.entries()]
    .map(([id, e]) => ({
      id,
      label: e.label,
      points: e.points,
      lastSeen: e.last.slice(0, 10),
      stale: e.last < staleBefore,
    }))
    .sort((a, b) => b.points - a.points);
}
