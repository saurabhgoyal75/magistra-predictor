# magistra-predictor

**A dual-track framework for GLP-1 side effect estimation, separating clinical evidence from real-world patient reports.**

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.19559749.svg)](https://doi.org/10.5281/zenodo.19559749)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Methodology](https://img.shields.io/badge/methodology-v4.0-green.svg)](https://magistra.health/en/methodology)
[![Live](https://img.shields.io/badge/live-magistra.health-purple.svg)](https://magistra.health/en/predictor)

This repository contains the statistical methodology, extraction prompts, and model configuration behind [Magistra Health](https://magistra.health) — a free, open, continuously updated platform that estimates GLP-1 medication side effect risk using two parallel data tracks.

---

## The idea in one sentence

**We don't blend clinical trial data and patient community reports into a single number. We compute two estimates and show both, so the gap between them is visible instead of hidden.**

---

## Why this repo exists

Patients starting semaglutide, tirzepatide, or liraglutide face a gap: clinical trials report one side effect rate, Reddit reports another, and neither is wrong. Existing resources pick one or average them opaquely. We keep them separate.

Representative gaps (reference profile: female, 35, medium dose, first month):

| Side effect | Clinical trials | Real-world reports | Gap |
|---|---|---|---|
| Nausea | 28% | 49% | 21 pp |
| Diarrhoea | 11% | 31% | 20 pp |
| Fatigue | 10% | 25% | 15 pp |
| Hair loss | 3% | 15% | 12 pp |
| Emotional blunting | 3% | 12% | 9 pp |

Clinical trials aren't wrong — they measure what they measure. But they systematically miss delayed effects (hair loss), subjective effects (emotional blunting), and effects that aren't pre-specified endpoints.

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
├── LICENSE                      # Apache 2.0
├── CITATION.cff                 # Academic citation metadata
├── CONTRIBUTING.md              # How to critique or contribute
├── methodology/
│   ├── side-effects-engine.ts   # Dual-track risk calculator
│   ├── model-config.ts          # Config schema (TypeScript types)
│   ├── model-config.json        # Live model config snapshot
│   ├── analyze-model.mjs        # Daily statistical analysis pipeline
│   └── extraction-prompt.mjs    # LLM extraction prompt
├── examples/
│   ├── api-examples.md          # How to query the public API
│   ├── fetch-predictor.js       # Node.js example
│   └── dual-track-comparison.md # Detailed walkthrough of the gap
└── preprint/
    └── magistra-methodology.md  # Full methodology preprint (v4.0)
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

Each effect in the predictor response has two fields: `clinical` and `realWorld`. Each contains:

```json
{
  "percentage": 28,
  "confidenceInterval": { "low": 22, "high": 35 },
  "confidenceLevel": "moderate",
  "dataPointCount": 15,
  "basis": "15 clinical studies and regulatory reports",
  "isFallback": false
}
```

When `realWorld.percentage > clinical.percentage` by more than 15 percentage points, the gap is flagged as "community reports higher than clinical trials" — suggesting the effect may be systematically under-measured in trials.

---

## Methodology at a glance

1. **Collection.** 18 data sources (PubMed, FDA FAERS, ClinicalTrials.gov, 13 subreddits, Drugs.com, Trustpilot, Indian pharmacovigilance sources) scraped daily.
2. **Extraction.** Claude Haiku extracts structured data points (rate, sample size, demographics, dose tier) with explicit confidence labels. Conservative: only explicitly stated rates are recorded.
3. **Dual-track filtering.** Data points are split by `sourceType` into clinical+regulatory (Track C) and user_report+news (Track R). The two tracks are never blended.
4. **Weighted estimation.** Weighted mean rate with sample-size and extraction-confidence weights, Winsorized at 5th/95th percentiles when n > 10.
5. **Log-odds modifiers.** Sex, age ≥ 65, GI history, diabetes, first month of treatment applied on log-odds scale, with cumulative shift capped at ±2.5 (~12× max cumulative OR) to prevent implausible stacking.
6. **Random-effects confidence intervals.** DerSimonian-Laird τ² estimation, delta-method SE on log-odds scale.
7. **Self-evolving config.** Daily pipeline computes empirical odds ratios for every parameter × effect combination, applies Benjamini-Hochberg FDR correction across ~180-240 tests, auto-applies only conservative changes (n ≥ 30, p_adj ≤ 0.01, |Δ OR| ≤ 0.3).
8. **Safety.** Versioned rollback (30 prior configs retained), canonical profile regression testing, human review queue for larger changes, max 5 auto-applied changes per day.

Full details in [`preprint/magistra-methodology.md`](preprint/magistra-methodology.md) or at https://magistra.health/en/methodology.

---

## Limitations (honest list)

- **Data volume:** Current database has ~217 points across 15 effects. Model health is "degraded" until n ≥ 100 per effect.
- **Demographic bias:** 87% female representation, minimal ethnic diversity, Western-dominated sources.
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

**Goyal, S.** (2026). *A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports* (v4.0). Zenodo. https://doi.org/10.5281/zenodo.19559749

```bibtex
@misc{goyal2026magistra,
  author       = {Goyal, Saurabh},
  title        = {A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports},
  year         = {2026},
  publisher    = {Zenodo},
  version      = {4.0},
  doi          = {10.5281/zenodo.19559749},
  url          = {https://doi.org/10.5281/zenodo.19559749}
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
Founder, Magistra Health B.V.
saurabh@magistra.health
https://magistra.health

---

*Magistra is a statistical tool, not medical advice. The predictions are population-average conditional risks, not individual outcomes. Always consult a licensed clinician before starting or changing medication.*
