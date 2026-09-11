# magistra-predictor

**A dual-track framework for GLP-1 side effect estimation, separating clinical evidence from real-world patient reports.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Methodology](https://img.shields.io/badge/methodology-v5.21-green.svg)](https://magistra.health/en/methodology)
[![Live](https://img.shields.io/badge/live-magistra.health-purple.svg)](https://magistra.health/en/predictor)

This repository contains the statistical methodology and model configuration behind [Magistra Health](https://magistra.health) — a platform that estimates GLP-1 medication side effect risk using two parallel data tracks. The predictor and the public API are free and need no authentication; bulk export of the dataset is not (see the licence link below). The clinical corpus is updated daily by an automated pipeline. The community corpus is not continuously updated: Reddit blocked our collector on 2026-05-28, freezing the 684 Reddit reports that make up most of it, and the remaining platform (Drugs.com, 71 reports) was last collected 2026-08-12. Any reporting-frequency figure is therefore a fixed historical number and should be cited with its date.

---

## The idea in one sentence

**We don't blend clinical trial data and patient community reports into a single number. We compute two different quantities — a clinical incidence estimate and a community reporting frequency — and label each for what it is, instead of collapsing them into one figure.**

---

## Why this repo exists

Patients starting semaglutide, tirzepatide, or liraglutide face a gap: clinical trials report a side effect's incidence, patient communities report how often people mention it, and neither is wrong — they're different quantities. Existing resources pick one or blend them opaquely. We keep them separate and never present them as comparable.

Earlier versions of this repo (through v4.0) published a "gap" table comparing a clinical incidence percentage directly against a real-world percentage (e.g. "hair loss: 3% clinical vs 15% real-world, 12pp gap") and framed it as evidence of clinical trials under-measuring side effects. That framing is withdrawn as of v5.0: the real-world figure was a reporting *frequency* — the share of community posts mentioning an effect — not an incidence estimate, so subtracting the two produced a number with no defined meaning. See "Changes from v4.0" in [the preprint](preprint/magistra-methodology.md) for the full correction. The two tracks are still displayed side by side, each with its own confidence interval and source count — see the live tool or the API for current figures.

**Correction, 29 August 2026 (v5.1).** The community reporting frequencies published through v5.0 rested on a contaminated population. Our Reddit collector's subreddit restriction was not holding and it searched generic symptom words, so 159 of the 185 "community reports" were posts from communities we never collect from — r/gallbladders, r/AskDocs, r/pregnant and others — while each was labelled with the subreddit we had *queried* rather than the one it was in, which hid the problem. The collector, the stored labels and the eligibility screen are all fixed, and **every reporting frequency has been recomputed over the screened population of 26 distinct reports**. No clinical or regulatory estimate changed. See "Corrections in v5.1" in [the preprint](preprint/magistra-methodology.md) for the full account, including the one published finding that did not survive the correction. At n=26 a single report moves any share by 3.8 points, and the denominator cannot currently grow — read these figures with their numerator, or not at all.

---

## Try it

**Live tool:** https://magistra.health/en/predictor
**Methodology doc:** https://magistra.health/en/methodology
**Public API:** https://magistra.health/api/data?q=help
**LLM-readable summary:** https://magistra.health/llms.txt

---

## What's in this repo

```
├── README.md                    # You are here
├── LICENSE                      # Apache 2.0 (code; the DATASET is separately
│                                #   licensed — see magistra.health/en/data#licence)
├── CITATION.cff                 # Academic citation metadata
├── CONTRIBUTING.md              # How to critique or contribute
├── SECURITY.md                  # How to report a security issue
├── methodology/                 # Read-only snapshots of the live code, dated
│   ├── side-effects-engine.ts   # Dual-track risk calculator
│   ├── rate-base.ts             # Rate eligibility rules + reporting frequency
│   ├── model-config.ts          # Config schema (TypeScript types)
│   ├── model-config.json        # Live model config snapshot
│   └── analyze-model.mjs        # Daily statistical analysis pipeline
├── data/                        # CC BY 4.0 per-effect aggregate table (pooled
│   ├── glp1-aggregate-rates.csv #   rate, 95% CI, stated rates, distinct sources,
│   └── glp1-aggregate-rates.json#   reporting frequency); dated snapshot, see asOf
├── examples/
│   └── api-examples.md          # How to query the public API
└── preprint/
    └── magistra-methodology.md  # Full methodology preprint (version in its header)
```

---

## Quick start

### Query the API

```bash
# Get API documentation
curl https://magistra.health/api/data?q=help

# Get overview stats
curl https://magistra.health/api/data?q=overview

# Get details for one side effect
curl "https://magistra.health/api/data?q=effect&id=nausea"

# Get a personalised prediction
curl -X POST https://magistra.health/api/predictor/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "molecule": "semaglutide",
    "doseMg": 1.0,
    "doseTier": "medium",
    "sex": "female",
    "age": 35,
    "hasGiHistory": false,
    "hasDiabetes": false,
    "isFirstMonth": true
  }'
```

### Understand the dual-track output

Each effect in the predictor response has two fields: `clinical` and `reportingFrequency`. The clinical field reports an incidence estimate; the reporting-frequency field reports a reporting frequency (share of distinct community reports mentioning the effect) — a different quantity, not a second incidence estimate. (`reportingFrequency` is the canonical name since 2026-09-01; the old name `realWorld` is kept as a deprecated alias with the same value for one release — read the `basis` string, not the field name.) Within each track, `sourceDiversity` is the canonical name for the distinct-source-count bucket; `confidenceLevel` is kept as a deprecated same-value alias.

Live `clinical` block for nausea from the request above, re-captured from production on 2026-09-09 (the 05:17 run's 60 retatrutide arm rows grew nausea's clinical base from 32 rates/23 sources to 41/26 since the 2026-09-08 capture; the withdrawal in "Corrections in v5.13" did not touch it) (`basisNl`, the Dutch twin of `basis`, omitted for brevity; re-captured after the v5.4 interval correction — see "Corrections in v5.4" in the preprint; the interval is now anchored at the pooled rate, so it differs from the 2026-08-31 capture; `pooledPercentage` was added 2026-08-28 and the base counts have grown with the corpus):

```json
{
  "percentage": 46,
  "confidenceInterval": { "low": 10, "high": 86 },
  "confidenceLevel": "very_high",
  "sourceDiversity": "very_high",
  "dataPointCount": 97,
  "ratePointCount": 41,
  "rateSourceCount": 26,
  "basis": "41 stated rates from 26 distinct sources (of 97 clinical/regulatory records). Base rate 21% → 46% after profile adjustment (sex:female ×1.25, isFirstMonth ×2.5) — odds ratios hand-coded at the 2026-04-12 seed with no per-modifier citation recorded, not derived from this corpus",
  "isFallback": false,
  "unadjustedPercentage": 21,
  "pooledPercentage": 21,
  "modifiersApplied": [
    { "id": "sex:female", "oddsRatio": 1.25, "provenance": "seed-2026-04-12" },
    { "id": "isFirstMonth", "oddsRatio": 2.5, "provenance": "seed-2026-04-12" }
  ]
}
```

Note what the response discloses about itself: the pre-adjustment rate (21%), every modifier applied to reach 46%, and the fact that those odds ratios are hand-coded rather than fitted from this corpus. A wide interval (10–86) is not a formatting artefact — it is the honest spread of 41 rates from 26 sources, and since v5.4 its width is fixed by that evidence: the same profile-free interval (3–67 around the 21% pooled rate, verified against production 2026-09-09 by re-running the request with no modifiers set) is carried, on the log-odds scale, to wherever the modifiers move the centre.

Earlier versions computed a "gap" by subtracting `realWorld.percentage` (now `reportingFrequency.percentage`) from `clinical.percentage` and flagged large gaps as evidence of clinical under-measurement. That computation is withdrawn as of v5.0 — see "Why this repo exists" above.

---

## Methodology at a glance

1. **Collection.** 8 source families have actually contributed data as of the last snapshot (Reddit — blocked since 2026-05-28, Google News, PubMed/PMC, FDA FAERS, Drugs.com, journal/institutional pages, ClinicalTrials.gov, medRxiv/bioRxiv); see Table 1 in the preprint or the live source list at https://magistra.health/api/data?q=overview for current counts. The system attempts collection from a wider set of scrapers than have produced data — only sources that have actually contributed a point are listed.
2. **Extraction.** Claude Haiku extracts structured data points (rate, sample size, demographics, dose tier) with explicit confidence labels. Conservative: only explicitly stated rates are recorded.
3. **Dual-track filtering.** Data points are split by `sourceType` into clinical+regulatory (Track C) and user_report+news (Track R). The two tracks are never blended.
4. **Weighted estimation.** Weighted mean rate with sample-size and extraction-confidence weights, Winsorized at 5th/95th percentiles when n > 10.
5. **Log-odds modifiers.** Sex, age ≥ 65, GI history, diabetes, first month of treatment applied on log-odds scale, with cumulative shift capped at ±2.5 (~12× max cumulative OR) to prevent implausible stacking.
6. **Random-effects confidence intervals.** Simplified, unweighted τ² estimation (inspired by DerSimonian-Laird, not inverse-variance weighted), delta-method SE on log-odds scale.
7. **Self-evolving config.** Daily pipeline computes empirical odds ratios for every parameter × effect combination, applies Benjamini-Hochberg FDR correction across every test the run produces (0–15 per run in the daily logs from 2026-04-13 to 2026-09-07; an earlier wording here said "~180-240 tests"), auto-applies only conservative changes (n ≥ 30, p_adj ≤ 0.01, |Δ OR| ≤ 0.3).
8. **Safety.** Versioned rollback (the outgoing config is archived by version number whenever a change is applied or flagged for review — none has been yet, so no archived version exists; the in-config changelog keeps its last 30 entries — an earlier wording here said "30 prior configs retained", which was that changelog cap misread as a retention count), a human review queue for larger changes, an odds-ratio bound of [0.1, 5.0] on every modifier, and max 5 auto-applied changes per day. An earlier wording here also listed "canonical profile regression testing"; no such test exists in the pipeline and it is withdrawn (preprint v5.7, "Corrections in v5.7").

Full details in [`preprint/magistra-methodology.md`](preprint/magistra-methodology.md) or at https://magistra.health/en/methodology.

---

## Limitations (honest list)

- **Data volume:** the eligible base behind published rates is far smaller than the raw corpus — **234 rates from 29 distinct studies** as of 2026-09-10, counted by study URL (a registry record or paper counts once however many effects it reports) and scoped to the 15 publicly-tracked effects — the extraction taxonomy holds three further ids (`kidney_issues`, `muscle_loss`, `weight_regain`) that are collected but displayed nowhere, and counting them here overstated the base behind the numbers this repo publishes (scoped 2026-09-10, which is what took the same day's reading from 239/31 to 238/30). It read 218/31 on 2026-09-09, before 18 rows read from three trial registries' SERIOUS adverse-event tables were re-admitted for the two effects whose events are adjudicated serious and therefore appear in no other table — pancreatitis and gallstones — each carried as `rateKind: "serious_ae"` and published as a floor on all-cause incidence rather than as incidence (see "Corrections in v5.15"); the distinct-study count did not move, because all three trials were already in the base for other effects. It read 214/31 on 2026-09-09, before a second extension of the store's dedupe key recovered four registry rates that a single arm-keyed row had been suppressing — a registry record states different values for one effect in one arm across two MedDRA preferred terms and across its SERIOUS and OTHER adverse-event tables, and neither axis was in the key (see "Corrections in v5.14"); that recovery moved four published estimates (constipation 10.9% → 11.8%, reduced appetite 11.1% → 9.8%, abdominal pain 5.7% → 8.3%, dizziness 6.9% → 6.6%). It read 215/32 earlier the same day, before a single Reddit post that states no percentage anywhere in its text was found counted as a stated rate and withheld — the eligibility screen had only ever tested clinical failure modes, never whether a *community* row states its own rate (see "Corrections in v5.13"); no per-effect estimate moved, because the clinical track excludes `user_report` rows by source type. It read 154/31 earlier the same day, before the 05:17 pipeline run reached NCT04881760 — a retatrutide phase-2 record whose 60 arm rows a collector-side skip bug had made unreachable until it was fixed on 2026-09-08 — and 153/31 on 2026-09-08, before a trial arm that a storage dedupe key had dropped was restored (vomiting: 18 rates → 19, 95% CI 0–82 → 0–76, same 14 sources — see "Corrections in v5.10"), and 156/32 earlier that same day, before three hand-authored April-2026 rows citing a Nature GWAS that states no incidence rate were withheld — see "Corrections in v5.9" in the methodology paper; that withdrawal also moved three published estimates (nausea 29.8% → 22.8%, reduced appetite 17.6% → 11.1%, vomiting 8.7% → 9.7%). Until 2026-09-08 the site-wide figure counted one entry per source *name* — 91 for the 153 rates of that day, and the earlier readings 2026-09-07: 128/73, 2026-09-06: 93/59, 2026-08-31: 74/51 (23 distinct studies by URL) were all on that key; v5.1–v5.2 stated 145/67 before 72 April-2026 seed rows wearing real trial URLs were found inside the base on 2026-08-31 and excluded — see "Corrections in v5.3" and "Corrections in v5.8" in the methodology paper. Per-effect counts were unaffected by that site-wide re-key (identical under both keys for all 15 effects at the time); the per-effect count was itself re-keyed onto the study URL on 2026-09-10, which moved only the two effects above (pancreatitis 4 entries → 2 studies, gallstones 7 → 4) and only pancreatitis's published grade (moderate → low) — the name-keyed figure is published beside it as `sourceEntries` (see "Corrections in v5.15", item 23). The per-effect breakdown is the CC BY 4.0 table in [`data/`](data/), a dated snapshot of the same API response, regenerated 2026-09-10 with a new `clinicalRateKind` column so a redistributed copy cannot read a serious-AE floor as an incidence rate. Of the 15 published effects, 14 now carry a corpus-derived clinical rate and 1 (emotional blunting) publishes no clinical figure at all — no effect still falls back to the static literature table for a published clinical percentage. Read the two effects marked as serious-AE floors as lower bounds; 1 more (hair loss) rests on a single distinct source. These memberships are recomputed daily — the API always serves the current numbers.
- **Community denominator:** the reporting-frequency track rests on **26 distinct community reports** (screened 2026-08-29, see the correction above). It is frozen at that size — Reddit has served the collector an HTTP 403 block page since 2026-05-28 — so every reporting frequency is a fixed historical number, not a live one, and must be cited with its date.
- **Demographic bias:** Both tracks over-represent female, white, and Western populations; ethnicity and BMI are tracked but lack sufficient data for inclusion.
- **Hand-coded modifiers:** Initial values from published literature; empirical replacement in progress as data accumulates.
- **No interaction terms.** Modifiers applied additively.
- **No formal calibration yet.** Planned at n ≥ 500.
- **LLM extraction unaudited.** Gold-standard audit planned.
- **Not causal.** These are population-average conditional risks.

See `CONTRIBUTING.md` if you'd like to help fix any of these.

---

## Contributing

We welcome critique, corrections, and collaboration. See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

Specifically seeking:

- **Biostatisticians** to review random-effects CI implementation and propose replacements for the method-of-moments τ² (we'd rather use REML or Paule-Mandel)
- **Clinical researchers** to critique effect categorization and modifier values
- **ML researchers** to audit LLM extraction accuracy on a gold-standard subset
- **Pharmacovigilance experts** to suggest additional data sources and flag missing effects

Substantive contributors are acknowledged in the public changelog on the [methodology page](https://magistra.health/en/methodology).

---

## Citation

If you use this methodology or data in research, please cite:

**Goyal, S.** (2026). *A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports* (v5.21). Magistra, Phlo Systems BV. https://magistra.health/en/methodology

No DOI is registered for this work — the methodology is self-published at the URL above, not deposited with a repository that mints permanent identifiers. (A DOI, 10.5281/zenodo.19559749, was asserted on this page and elsewhere until 2026-08-18; it was never actually registered and has been withdrawn.)

```bibtex
@misc{goyal2026magistra,
  author       = {Goyal, Saurabh},
  title        = {A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports},
  year         = {2026},
  publisher    = {Magistra, Phlo Systems BV},
  version      = {5.21},
  url          = {https://magistra.health/en/methodology}
}
```

See [`CITATION.cff`](CITATION.cff) for the machine-readable citation file.

---

## License

Apache 2.0. See [LICENSE](LICENSE).

The point-level dataset behind the API is free for research and journalism with attribution (Magistra, magistra.health); redistribution of the dataset is not permitted, and bulk export and commercial use go through the research subscription — terms at https://magistra.health/en/data#licence, offer at https://magistra.health/en/data-api. The per-effect aggregate table in [`data/`](data/) is the exception: it is licensed **CC BY 4.0** and may be redistributed with attribution (its `asOf` field dates the snapshot; the live copy is at https://magistra.health/data/glp1-aggregate-rates.json).

---

## Contact

**Saurabh Goyal**
Founder, Phlo Systems BV
saurabh@magistra.health
https://magistra.health

---

*Magistra is a statistical tool, not medical advice. The predictions are population-average conditional risks, not individual outcomes. Always consult a licensed clinician before starting or changing medication.*
