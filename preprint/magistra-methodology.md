# A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports

**Saurabh Goyal**
Magistra Health B.V.
saurabh@magistra.health
https://magistra.health

**Version:** 4.0
**Date:** April 2026
**Classification:** q-bio.QM (Quantitative Methods) / stat.AP (Applications)

---

## Abstract

Patients starting GLP-1 receptor agonist therapy (semaglutide, tirzepatide, liraglutide) for weight management face a persistent information gap: clinical trial side effect frequencies often diverge substantially from the experiences described in patient communities, but existing resources typically report only one or the other. We describe a dual-track estimation framework that collects, extracts, and reports two parallel risk estimates per side effect — one derived exclusively from peer-reviewed clinical trial and regulatory data, the other from real-world patient community reports — without blending them. The framework is implemented as a live, continuously updated system (magistra.health) that ingests from 18 data sources daily, uses LLM-assisted structured extraction with confidence weighting, and applies random-effects meta-analytic confidence intervals (DerSimonian-Laird) with capped log-odds modifier stacking. A self-evolving pipeline computes empirical odds ratios for all parameter × effect combinations daily, applies Benjamini-Hochberg FDR correction across the full test battery, and updates model parameters under pre-registered thresholds. We illustrate the framework with representative gaps (hair loss: clinical ~3% vs real-world ~15%; emotional blunting: clinical ~3% vs real-world ~12%) and discuss its limitations honestly, including demographic bias, modest data volume (n=217 points at time of writing), and the absence of formal calibration against independent outcome data. The system is open: its methodology is public, its code is available, and it actively solicits peer critique via a structured feedback channel. We argue that the dual-track approach is more informative and more honest than blended or single-source estimates, and that the gap between tracks is itself a clinically meaningful signal worth displaying.

**Keywords:** GLP-1 receptor agonists, semaglutide, tirzepatide, pharmacovigilance, real-world evidence, meta-analysis, DerSimonian-Laird, patient-reported outcomes, LLM extraction, self-evolving models, open methodology

---

## 1. Introduction

### 1.1 The information gap

Patients beginning treatment with a GLP-1 receptor agonist for obesity or type 2 diabetes face a well-documented information gap. Clinical trial side effect rates are published in randomized controlled trials and summarized in package inserts, but these figures often fail to match patient reports aggregated in online communities. For example, SELECT (Lincoff et al. 2023) reports hair loss in approximately 3% of semaglutide-treated patients, while Reddit communities such as r/Ozempic host megathreads with hundreds of posts describing telogen effluvium as a common experience. Similarly, "emotional blunting" — a reduction in affective response to pleasurable stimuli — is virtually absent from RCT safety reports but is widely discussed in patient forums (Kolata 2024; anonymous Reddit threads).

Two interpretations of this gap are possible. The first is that clinical trials are correct and patient reports are biased toward severity: patients who experience side effects are more likely to post about them, producing inflated estimates. The second is that clinical trials systematically miss side effects that are delayed (months after the trial endpoint), subjective (not measured by standardized instruments), or not pre-specified as secondary outcomes. Both interpretations have merit; in practice, both factors operate simultaneously.

Existing consumer-facing resources handle this gap in one of three ways: (a) report only the clinical trial rate, omitting the community signal; (b) report only anecdotal patient experience, omitting the rigorous rate; or (c) blend them into a single number using undocumented weighting. None of these approaches serves the patient who wants to know how likely a side effect really is for someone like them.

### 1.2 Our approach: don't blend, display both

We propose and implement a dual-track framework: for every side effect, compute two parallel estimates using disjoint data streams, then display them side by side with their respective confidence intervals and an explicit indication of the data sources feeding each. The user sees both numbers and the gap between them becomes visible rather than hidden. The convergence of the two tracks over time (as clinical data accumulates and community reports get integrated into formal pharmacovigilance) is itself a measurable quantity worth tracking.

This framework makes no attempt to decide which estimate is "correct." It presents both, labels their provenance, and leaves interpretation to the patient and their clinician. We argue this is more honest and more informative than blending.

### 1.3 Scope of this paper

This paper describes the methodology, not the clinical implications. We cover: (i) data collection and extraction, (ii) the statistical procedures used for each track, (iii) the self-evolving model update pipeline, (iv) honest limitations, and (v) the open peer-review mechanism. We do not attempt to validate the predictions against independent outcome data — this is explicitly planned for a later phase when data volume permits. We also do not claim the system produces medically authoritative numbers; it is a statistical indicator, not a replacement for clinical judgment.

---

## 2. Methods

### 2.1 Data collection

The system ingests from 18 distinct data sources organized into four categories (Table 1). Each data point retains its source provenance for the full lifetime of the record, allowing downstream filtering into tracks.

**Table 1.** Data sources by category.

| Category | Sources | Frequency |
|---|---|---|
| Clinical | PubMed (NCBI E-utilities, 35 rotating queries), ClinicalTrials.gov API v2, Google Scholar, Cochrane Library, WHO adverse event database, preprint servers | Daily |
| Regulatory | FDA FAERS (OpenFDA API, 9 drug variants), EMA adverse events, MHRA yellow card data, CDSCO/PvPI India bulletins | Daily |
| User reports | Reddit (13 subreddits: r/Ozempic, r/Mounjaro, r/Zepbound, r/loseit, r/WegovyWeightLoss, r/semaglutide, r/tirzepatide, r/GLP1_Drugs, r/ObesityScience, r/BodyRecomposition, r/PCOS, r/diabetes, r/intermittentfasting), Trustpilot, Drugs.com, Quora, 1mg.com India | Daily |
| News & guidelines | Google News RSS (5 rotating queries), professional society guidelines, health news aggregators | Daily |

Raw text is retained as a 500-character excerpt for each data point to allow post-hoc auditing and reprocessing with improved extraction prompts.

### 2.2 LLM-assisted structured extraction

Raw scraped text is processed by Claude Haiku (Anthropic) via a pre-specified extraction prompt that captures: the side effect mentioned, the drug name (normalized to generic), the extracted incidence rate (if explicitly stated), dose tier, demographic fields (sex, age range, ethnicity, BMI range), lifestyle fields (exercise level, diet, blood type), sample size (if reported), and an extraction confidence label (high / medium / low).

The extraction is deliberately conservative: the prompt specifies that rates must be explicitly stated in the source text, not inferred. Items with no extractable rate are stored with `extractedRate = null` and contribute only to qualitative analysis. Confidence labels are used downstream as multiplicative weights (high = 1.0, medium = 0.7, low = 0.3) on sample-size-based weighting.

Deduplication is performed on the composite key (sourceUrl, sideEffect). The extraction prompt is versioned and any change triggers re-extraction of a sample for validation (planned; not yet implemented).

### 2.3 Dual-track estimation

For a target patient profile P and side effect e, the system produces two parallel estimates.

**Track C (Clinical).** Let D_C(P, e) be the set of data points with sideEffect = e, sourceType ∈ {clinical, regulatory}, and profile filters (sex, dose, ethnicity, exercise) matching P or marked "unspecified". The clinical estimate is computed as:

1. Weighted mean rate, with weights w_i = max(1, n_i) · q_i where n_i is the reported sample size and q_i is the extraction confidence weight.
2. Winsorization at the 5th/95th percentile when |D_C| > 10.
3. Dose adjustment applied if no data point has dose specificity: the weighted mean is scaled by the ratio of the target dose rate to the median dose rate from published baselines.
4. Log-odds transformation; addition of applicable modifier log-odds (sex, age ≥ 65, GI history, diabetes, first month of treatment); inverse transformation back to probability.
5. Cumulative modifier shift is capped at |ΣΔlogOdds| ≤ 2.5 to prevent implausible stacking.
6. Random-effects 95% confidence interval on the log-odds scale using DerSimonian-Laird τ² estimation and delta-method standard error.

**Track R (Real-world).** Analogous to Track C but with D_R(P, e) restricted to sourceType ∈ {user_report, news}. No blending with Track C. If |D_R| < 1, a fallback is used: the aggregate user-reported baseline rate from the static reference data, adjusted by modifiers and clearly labeled as "aggregate baseline, not personalized."

Both tracks share the same statistical machinery; only the input data differs. Crucially, the two tracks are never blended, never averaged, and never substituted. They are displayed as independent estimates with their own sample sizes, confidence intervals, and data source attributions.

### 2.4 Log-odds modifier framework

Modifiers are stored as odds ratios and applied on the log-odds scale. For a modifier set M = {m_1, ..., m_k} with m_i the odds ratio for factor i:

```
logit(p_adjusted) = logit(p_base) + Σ_i log(OR_i) · I(factor i applies)
p_adjusted        = 1 / (1 + exp(-logit(p_adjusted)))
```

subject to the cap |Σ_i log(OR_i) · I(factor i applies)| ≤ 2.5.

This cap is ad-hoc but serves a safety purpose: without it, stacking 5 modifiers with OR ≈ 1.3 each would multiply the baseline by a factor of ~3.7, which can push low-baseline predictions into implausible territory (e.g., base 5% → adjusted 19%). With the cap, extreme combinations are tempered. The cap is logged explicitly whenever it binds.

Modifiers are applied only when the underlying data does not already stratify on that dimension. For example, if the clinical data for track C already contains sex-stratified rates, the sex modifier is not additionally applied — the data itself already reflects the sex effect.

### 2.5 Random-effects confidence intervals

For a rate p computed from k studies with effective sample size N, the 95% confidence interval is computed on the log-odds scale using:

- **Within-study variance:** p(1-p) / N_effective
- **Between-study heterogeneity (τ²):** DerSimonian-Laird estimator on individual study rates
- **Total variance:** v = p(1-p)/N + τ²
- **SE on log-odds scale:** SE_logit = √v / (p(1-p))
- **95% CI:** [logit⁻¹(logit(p) - 1.96·SE_logit), logit⁻¹(logit(p) + 1.96·SE_logit)]

When k = 1 (only one study contributes), τ² is set to 0 and the interval reflects sampling variance only. This is flagged as "low confidence" regardless of the nominal N.

### 2.6 Self-evolving parameter updates

A daily analysis pipeline computes empirical odds ratios for every (parameter dimension × effect) combination using the current data pool. For each test, the pipeline computes the log-odds ratio between the two groups (e.g., female vs male; age ≥ 65 vs < 65), its standard error via the delta method, and a two-sided z-test p-value.

Because this creates a large multiple-testing problem (~180-240 tests per run), the full p-value battery is adjusted using the Benjamini-Hochberg procedure to control the false discovery rate at q = 0.05.

Decision logic (using FDR-adjusted p-values):

| Condition | Action |
|---|---|
| N ≥ 30, p_adj ≤ 0.01, |Δ OR| ≤ 0.3 from current | Auto-apply; update config |
| N ≥ 20, p_adj ≤ 0.05, |Δ OR| > 0.3 | Flag for human review |
| New parameter: N ≥ 30, significant for ≥ 2 effects | Promote from "candidate" to "active"; flag for review |

Additional sanity checks are applied before any change is committed: odds ratios must lie in [0.1, 5.0], base rates must lie in [0.01, 0.70], and the total number of auto-applied changes per day is capped at 5.

Every model configuration is versioned; the previous 30 versions are retained for rollback. Canonical patient profiles are evaluated against each new config and compared to the prior day's output; any prediction shift greater than 20 percentage points triggers a regression alert.

### 2.7 Implementation

The system runs on Node.js with a Next.js frontend and Vercel KV for persistence. The full pipeline (collection → extraction → analysis → config update → sync) executes in under 5 minutes per day on a single server. The statistical code is implemented in plain JavaScript without external dependencies beyond the standard normal CDF approximation (Abramowitz-Stegun).

---

## 3. Results

### 3.1 Current database state

At the time of writing (April 2026), the database contains 217 extracted data points across 15 side effects and 9 drug variants. The distribution across source categories is approximately 6% clinical, 3% regulatory, 60% user reports, and 31% news/other. Female representation among points with specified sex is 87% — reflecting the demographic bias of patient communities and clinical trial populations.

The model health status is "degraded" per the automated review, reflecting insufficient data volume per effect (median n per effect ≈ 14, target ≥ 100).

### 3.2 Illustrative dual-track gaps

For a reference profile (female, 35 years old, medium dose, first month of treatment, no GI history, no diabetes), Table 2 shows the clinical and real-world estimates for 7 representative side effects.

**Table 2.** Dual-track estimates for reference profile.

| Side effect | Clinical (%) | Real-world (%) | Gap (pp) |
|---|---|---|---|
| Nausea | 28 | 49 | 21 |
| Diarrhoea | 11 | 31 | 20 |
| Fatigue | 10 | 25 | 15 |
| Headache | 7 | 21 | 14 |
| Hair loss (alopecia) | 3 | 15 | 12 |
| Constipation | 6 | 17 | 11 |
| Emotional blunting | 3 | 12 | 9 |

The gap is consistent across effects but varies in magnitude. Gastrointestinal effects show the largest absolute gaps (15-21 pp) but also the highest baselines. Low-baseline effects like hair loss and emotional blunting show 3-5× multiplicative gaps despite lower absolute numbers.

### 3.3 Convergence hypothesis

We hypothesize (but have not yet tested) that as clinical data volume grows, the two tracks will converge for mainstream GI side effects but remain divergent for effects that clinical trials systematically under-measure (delayed, subjective, or not pre-specified). We plan to formalize this as a quantitative test once the database reaches n ≥ 100 clinical per effect.

---

## 4. Limitations

We enumerate limitations explicitly because hidden weaknesses are more dangerous than visible ones.

**Data volume.** The current database (n = 217) is below the threshold for robust inference on most effects. Model health is classified as "degraded" until n ≥ 100 per effect is achieved. Reported confidence intervals should be interpreted accordingly.

**Demographic bias.** Both the clinical and community data sources over-represent female, white, and Western populations. Candidate parameters for ethnicity and BMI are tracked but lack sufficient data for inclusion. The system explicitly flags this as a limitation on every prediction.

**Hand-coded modifiers.** The initial modifier values (female factor, age 65+ factor, etc.) are drawn from published clinical literature and applied uniformly across trials. These are provisional and are being replaced empirically as data accumulates. The model config tracks each modifier's provenance as either "clinical_literature" (hand-coded) or "empirical" (derived from data).

**No interaction terms.** Modifiers are applied additively on the log-odds scale, ignoring potential interactions (e.g., female × age ≥ 65). The cumulative cap at |ΣΔlogOdds| ≤ 2.5 is a partial mitigation but does not substitute for proper interaction modeling.

**No formal calibration.** The system has not yet been validated against independent outcome data. A held-out validation is planned once n ≥ 500 per effect is achieved. Until then, reported confidence intervals capture sampling and between-study variance but not structural model error.

**LLM extraction accuracy.** Claude Haiku is used for structured extraction but has not been audited against human gold-standard labels on a representative sample. An audit of 50 sources per effect is planned. Until completed, reported sample sizes should be treated as noisy upper bounds.

**Selection bias in community data.** Patient communities over-report severe experiences; the real-world track inherits this bias. We do not attempt to correct for it beyond separating the two tracks so the user can see both.

**Journey predictor limitations.** The weight trajectory, muscle loss, and discontinuation models embed expert-coded modifier values (dose, exercise, protein, resistance training) that are not empirically derived. These are provisional and clearly labeled as such.

**Not causal.** Reported probabilities are population-average conditional risks, not individual causal effects.

**No external validation.** The system has not been evaluated in an independent dataset or validated against published pharmacovigilance benchmarks.

---

## 5. Open Peer Review

Magistra's methodology page (https://magistra.health/en/methodology) hosts a researcher feedback form with topic-tagged critique channels (statistical methodology, data quality, calibration, bias quantification, journey predictor, new predictors, collaboration). All received feedback is reviewed, and substantive contributions are acknowledged in a public changelog attached to the model configuration. Researchers and clinicians are invited to submit critique of any element of this methodology.

---

## 6. Discussion and Future Work

### 6.1 Why dual-track is the honest choice

Blended estimates have a single point of failure: the weighting scheme. If the weights are wrong, the output is wrong, and the user has no way to detect this. Dual-track estimates surface the disagreement directly. The user sees two numbers, understands they come from different data streams, and can form their own interpretation. The system is transparent by construction.

### 6.2 The self-evolving loop

The FDR-corrected parameter update pipeline provides a principled mechanism for model evolution without requiring a human in the loop for every update. Safeguards (threshold gating, auto-apply caps, versioned rollback, canonical profile regression testing) are designed to make this safe. In practice, most auto-applies to date have been zero because the data volume is insufficient to meet the thresholds; this is a feature, not a bug.

### 6.3 Roadmap

1. **Phase 1 (current):** dual-track framework live; open peer review solicited; data volume ~200-500 points.
2. **Phase 2:** n ≥ 100 per effect; formal calibration testing; empirical modifier replacement for hand-coded values.
3. **Phase 3:** n ≥ 500; external validation on independent dataset; interaction term modeling.
4. **Phase 4:** pre-registration on OSF.io; formal manuscript submission targeting Nature Medicine or JAMA Network Open.

### 6.4 Call for critique

This methodology is imperfect and we know it. We are releasing it publicly, with its limitations stated in full, because we believe this is the only honest way to build a system that makes clinical predictions. If you see something wrong or improvable, please tell us.

---

## References

1. Wilding JPH et al. Once-weekly semaglutide in adults with overweight or obesity (STEP-1). *N Engl J Med* 2021;384:989-1002.
2. Davies M et al. Semaglutide 2·4 mg once a week in adults with overweight or obesity, and type 2 diabetes (STEP-2). *Lancet* 2021;397:971-984.
3. Wadden TA et al. Effect of subcutaneous semaglutide vs placebo as an adjunct to intensive behavioral therapy on body weight (STEP-3). *JAMA* 2021;325:1403-1413.
4. Rubino D et al. Effect of continued weekly subcutaneous semaglutide vs placebo on weight loss maintenance (STEP-4). *JAMA* 2021;325:1414-1425.
5. Jastreboff AM et al. Tirzepatide once weekly for the treatment of obesity (SURMOUNT-1). *N Engl J Med* 2022;387:205-216.
6. Aronne LJ et al. Tirzepatide vs semaglutide for weight loss in adults with obesity (SURMOUNT-5). *N Engl J Med* 2025 (in press).
7. Lincoff AM et al. Semaglutide and cardiovascular outcomes in obesity without diabetes (SELECT). *N Engl J Med* 2023;389:2221-2232.
8. DerSimonian R, Laird N. Meta-analysis in clinical trials. *Controlled Clinical Trials* 1986;7:177-188.
9. Benjamini Y, Hochberg Y. Controlling the false discovery rate. *JRSS B* 1995;57:289-300.
10. Collins GS et al. Transparent reporting of a multivariable prediction model for individual prognosis or diagnosis (TRIPOD). *Ann Intern Med* 2015;162:55-63.
11. Kolata G. "Ozempic changed my personality." *New York Times* 2024.
12. FDA Adverse Event Reporting System (FAERS). openFDA API. Accessed April 2026.

---

## Appendix A: Source code availability

All statistical code, extraction prompts, and model configuration are available at:
- Live system: https://magistra.health
- Methodology page: https://magistra.health/en/methodology
- Public API: https://magistra.health/api/data?q=help
- LLM-readable summary: https://magistra.health/llms.txt
- Source code repository: https://github.com/[forthcoming]

## Appendix B: Correspondence

Saurabh Goyal
Magistra Health B.V.
saurabh@magistra.health

All critique, collaboration proposals, and data contributions are welcome.
