# magistra-predictor

**A dual-track framework for GLP-1 side effect estimation, separating clinical evidence from real-world patient reports.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Methodology](https://img.shields.io/badge/methodology-v5.0-green.svg)](https://magistra.health/en/methodology)
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
├── examples/
│   └── api-examples.md          # How to query the public API
└── preprint/
    └── magistra-methodology.md  # Full methodology preprint (v5.0)
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

Live `clinical` block for nausea from the request above, captured from production on 2026-08-31 (field names updated 2026-09-01 to add the canonical `sourceDiversity`; no other value changed):

```json
{
  "percentage": 60,
  "confidenceInterval": { "low": 20, "high": 90 },
  "confidenceLevel": "high",
  "sourceDiversity": "high",
  "dataPointCount": 70,
  "ratePointCount": 25,
  "rateSourceCount": 17,
  "basis": "25 stated rates from 17 distinct sources (of 70 clinical/regulatory records). Base rate 32% → 60% after profile adjustment (sex:female ×1.25, isFirstMonth ×2.5) — odds ratios hand-coded at the 2026-04-12 seed with no per-modifier citation recorded, not derived from this corpus",
  "isFallback": false,
  "unadjustedPercentage": 32,
  "modifiersApplied": [
    { "id": "sex:female", "oddsRatio": 1.25, "provenance": "seed-2026-04-12" },
    { "id": "isFirstMonth", "oddsRatio": 2.5, "provenance": "seed-2026-04-12" }
  ]
}
```

Note what the response discloses about itself: the pre-adjustment rate (32%), every modifier applied to reach 60%, and the fact that those odds ratios are hand-coded rather than fitted from this corpus. A wide interval (20–90) is not a formatting artefact — it is the honest spread of 25 rates from 17 sources.

Earlier versions computed a "gap" by subtracting `realWorld.percentage` (now `reportingFrequency.percentage`) from `clinical.percentage` and flagged large gaps as evidence of clinical under-measurement. That computation is withdrawn as of v5.0 — see "Why this repo exists" above.

---

## Methodology at a glance

1. **Collection.** 8 source families have actually contributed data as of the last snapshot (Reddit — blocked since 2026-05-28, Google News, PubMed/PMC, FDA FAERS, Drugs.com, journal/institutional pages, ClinicalTrials.gov, medRxiv/bioRxiv); see Table 1 in the preprint or the live source list at https://magistra.health/api/data?q=overview for current counts. The system attempts collection from a wider set of scrapers than have produced data — only sources that have actually contributed a point are listed.
2. **Extraction.** Claude Haiku extracts structured data points (rate, sample size, demographics, dose tier) with explicit confidence labels. Conservative: only explicitly stated rates are recorded.
3. **Dual-track filtering.** Data points are split by `sourceType` into clinical+regulatory (Track C) and user_report+news (Track R). The two tracks are never blended.
4. **Weighted estimation.** Weighted mean rate with sample-size and extraction-confidence weights, Winsorized at 5th/95th percentiles when n > 10.
5. **Log-odds modifiers.** Sex, age ≥ 65, GI history, diabetes, first month of treatment applied on log-odds scale, with cumulative shift capped at ±2.5 (~12× max cumulative OR) to prevent implausible stacking.
6. **Random-effects confidence intervals.** Simplified, unweighted τ² estimation (inspired by DerSimonian-Laird, not inverse-variance weighted), delta-method SE on log-odds scale.
7. **Self-evolving config.** Daily pipeline computes empirical odds ratios for every parameter × effect combination, applies Benjamini-Hochberg FDR correction across ~180-240 tests, auto-applies only conservative changes (n ≥ 30, p_adj ≤ 0.01, |Δ OR| ≤ 0.3).
8. **Safety.** Versioned rollback (30 prior configs retained), canonical profile regression testing, human review queue for larger changes, max 5 auto-applied changes per day.

Full details in [`preprint/magistra-methodology.md`](preprint/magistra-methodology.md) or at https://magistra.health/en/methodology.

---

## Limitations (honest list)

- **Data volume:** As of 2026-08-31 the database holds 1,332 published points (1,482 including 150 April-2026 seed points retained only for audit trail), but the eligible base behind published rates is far smaller — **74 rates from 51 distinct sources** (v5.1–v5.2 stated 145/67; 72 April-2026 seed rows wearing real trial URLs were found inside the base on 2026-08-31 and excluded — see "Corrections in v5.3" in the methodology paper). 5 of the 15 published effects (pancreatitis, fatigue, hair loss, dizziness, emotional blunting) have no eligible clinical rate at all, so they fall back to a labelled literature range rather than a corpus-derived figure; four more (abdominal pain, acid reflux, gallstones, injection-site reaction) rest on a single distinct source each. All figures verified against https://magistra.health/api/data?q=overview on that date; the API always serves the current numbers.
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

**Goyal, S.** (2026). *A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports* (v5.0). Magistra, Phlo Systems BV. https://magistra.health/en/methodology

No DOI is registered for this work — the methodology is self-published at the URL above, not deposited with a repository that mints permanent identifiers. (A DOI, 10.5281/zenodo.19559749, was asserted on this page and elsewhere until 2026-08-18; it was never actually registered and has been withdrawn.)

```bibtex
@misc{goyal2026magistra,
  author       = {Goyal, Saurabh},
  title        = {A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports},
  year         = {2026},
  publisher    = {Magistra, Phlo Systems BV},
  version      = {5.0},
  url          = {https://magistra.health/en/methodology}
}
```

See [`CITATION.cff`](CITATION.cff) for the machine-readable citation file.

---

## License

Apache 2.0. See [LICENSE](LICENSE).

The data in the Magistra database is aggregated from public sources and is available free for research and non-commercial use with attribution. Commercial/bulk access: contact saurabh@magistra.health.

---

## Contact

**Saurabh Goyal**
Founder, Phlo Systems BV
saurabh@magistra.health
https://magistra.health

---

*Magistra is a statistical tool, not medical advice. The predictions are population-average conditional risks, not individual outcomes. Always consult a licensed clinician before starting or changing medication.*
