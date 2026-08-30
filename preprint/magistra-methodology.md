# A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports

**Saurabh Goyal**
Phlo Systems BV
saurabh@magistra.health
https://magistra.health

**Version:** 5.1
**Date:** 29 August 2026 (v5.0: August 2026 — see "Corrections in v5.1"; v4.0: April 2026 — superseded; see "Changes from v4.0")
**Classification:** q-bio.QM (Quantitative Methods) / stat.AP (Applications)

---

## Abstract

Patients starting GLP-1 receptor agonist therapy (semaglutide, tirzepatide, liraglutide) for weight management face a persistent information gap: clinical trial side effect frequencies often diverge substantially from the experiences described in patient communities, but existing resources typically report only one or the other. We describe a dual-track estimation framework that collects, extracts, and reports two parallel signals per side effect — a clinical incidence estimate derived exclusively from peer-reviewed clinical trial and regulatory data, and a community reporting frequency (the share of distinct community reports that mention the effect) — without blending them, and without presenting them as comparable quantities. The framework is implemented as a live, continuously updated system (magistra.health) that ingests daily from public clinical, regulatory, community, and news sources, uses LLM-assisted structured extraction with confidence weighting, applies random-effects meta-analytic confidence intervals (DerSimonian-Laird) with capped log-odds modifier stacking to the clinical track, and Wilson score intervals to the community track. Published estimates are restricted to an eligibility-screened base: every rate must have a citable external origin, each distinct source contributes at most one rate per effect, and spontaneous-report shares are never averaged into incidence. At the time of writing (snapshot 29 August 2026, verified against the live API) the corpus holds 1,443 collected data points, of which 310 state a rate; 145 rates from 67 distinct sources are eligible to support published estimates, and the community denominator is 26 distinct reports — reduced from the 185 reported in v5.0 by the topical screen described in "Corrections in v5.1". A self-evolving pipeline computes empirical odds ratios for all parameter × effect combinations daily, applies Benjamini-Hochberg FDR correction across the full test battery, and updates model parameters under pre-registered thresholds. We discuss limitations honestly, including demographic bias, a frozen community collector (Reddit has served the scraper an HTTP 403 block page since May 2026), and the absence of formal calibration — which the eligible base is currently too small to support at all. The system is open: its methodology is public, its code is available, and it actively solicits peer critique via a structured feedback channel. We argue that displaying both signals with their provenance is more informative and more honest than blended or single-source estimates.

**Keywords:** GLP-1 receptor agonists, semaglutide, tirzepatide, pharmacovigilance, real-world evidence, meta-analysis, DerSimonian-Laird, patient-reported outcomes, LLM extraction, self-evolving models, open methodology

---

## Changes from v4.0 (August 2026)

v4.0 (April 2026) described a method and a data-source inventory that internal audits between 2026-08-13 and 2026-08-17 found the live system either no longer matched or should never have published. v5.0 corrects the text rather than annotating it; the four substantive corrections, in the order they were found:

1. **Rate eligibility (2026-08-13).** v4.0 weighted every rate-bearing data point. The system now excludes rates that cannot support a published estimate: rates without a citable external origin (including 78 April-2026 seed points whose source URL pointed at our own site — retained, labelled, and excluded from every public total); spontaneous-report *shares* (FAERS reports the share of adverse-event reports mentioning an effect — averaging that into incidence is a category error, and at n=82,377 it silently dominated every estimate it touched); multiple rates from a single source (now collapsed to one entry per distinct source per effect); and sample sizes extracted from social posts (one X/Twitter post carried n=500,000 — a follower count, not a cohort — and drove a "14× hair loss" discordance claim, now withdrawn). What v4.0 presented as resting on ~1,200 data points rests, after screening, on the eligible base stated in the abstract.
2. **The real-world track is a reporting frequency, not an incidence (2026-08-14).** v4.0's "real-world" track averaged self-reported percentages scraped from individual community posts; a personal anecdote has no rate. The track now reports the share of distinct community reports (deduplicated by source URL) that mention each effect, with Wilson intervals. Consequently v4.0's clinical-vs-real-world "convergence" framing — including the illustrative gap table and the abstract's hair-loss example — is withdrawn as a category error: a mention frequency and an incidence rate are not comparable quantities (see §3.3).
3. **The published data-source inventory was wrong (2026-08-17).** v4.0's Table 1 listed sources (Google Scholar, 1mg.com, PvPI, Trustpilot) that had never contributed a single corpus point, and described every source as collected daily while Reddit had been blocked since 2026-05-28. Table 1 is now derived from the corpus and served live at the public API; a source that has contributed nothing cannot appear in it.
4. **Source-type labels were assigned by scraper keyword, not by publisher (2026-08-14, fully landed 2026-08-17).** 44 points typed clinical or regulatory and branded "WHO/…", "MHRA/…", "EMA/…" or "Cochrane/…" were Google News search-result blurbs whose actual publisher was never the named agency; a further 78 points branded "Quora —" or "Twitter/X —" were likewise Google News results, not platform collections. All were relabelled by their real mechanism in both the repository and production stores. None carried an eligible rate, so no published estimate changed.

---

## Corrections in v5.1 (29 August 2026)

v5.1 corrects one substantive error in v5.0 and re-dates every corpus figure. The correction is stated here rather than silently applied, because v5.0's community figures were published and may have been read or cited.

5. **The community report population was contaminated; the denominator falls from 185 to 26 (2026-08-29).** v5.0's Track R denominator (|R| = 185) was not the set of GLP-1 community reports it claimed to be. The Reddit collector's server-side subreddit restriction (`restrict_sr=1` on old.reddit's `search.json`) was not holding, and its search terms are generic symptom words ("nausea vomiting", "gallbladder", "constipation diarrhea"), so an unrestricted search returned posts from anywhere on Reddit. The defect was invisible because each stored point was named for the subreddit we had *queried*, not the one the post was actually in — so the corpus read as though every report came from a GLP-1 community. Reading the labels against their own permalinks showed that 679 of 711 Reddit-named points (95.5%) were misattributed, and that **159 of the 185 distinct community reports (86%) came from communities we never collect from** — r/gallbladders (102 points), r/AskDocs (82), r/pregnant (26), and others including r/HyperemesisGravidarum, r/Ovariancancer and r/Celiac. Pregnancy nausea and post-cholecystectomy pain were counted as GLP-1 patient reports, in the numerator *and* the denominator of every published reporting frequency.

   Three fixes were applied on 2026-08-29 and are live: the collector now names each point by the post's own subreddit and discards results from outside its configured list; the 679 misattributed points were relabelled by permalink in both the repository corpus and the production store; and `isCommunityReport` (§2.3) now additionally requires a Reddit post to be in a GLP-1, weight-management or diabetes community we collect from. **Every reporting frequency in this document has been recomputed over the screened population of 26 reports** (Table 2, §3.2, §5). The ordering changed as well as the magnitudes: v5.0's Table 2 showed nausea as the most-mentioned effect at 24.9%; over the screened population vomiting (42.3%) and nausea (38.5%) lead, and abdominal pain — which v5.0-era analysis had reported as out-mentioning nausea — falls from 27.6% to 15.4%, that finding having been an artefact of r/gallbladders and r/AskDocs dominating the pool.

   No clinical or regulatory estimate changed: the screen is on the community report *population*, and none of the excluded points carried an eligible rate (§2.3). The clinical figures in this version differ from v5.0's only because they are a later snapshot.

   The correction is *not* a reason to read the remaining 26 reports as more reliable than their size allows — with n=26, a single report moves any share by 3.8 percentage points, and the base cannot currently grow (§5, frozen community denominator). Two published effects (pancreatitis, emotional blunting) now have a reporting frequency of 0%, which means no report in the screened population mentioned them, not that they do not occur.

---

All corpus figures printed in this version are a dated snapshot (2026-08-29); the live figures are served at https://magistra.health/api/data?q=overview and https://magistra.health/en/methodology, both of which compute the eligible base at request time.

---

## 1. Introduction

### 1.1 The information gap

Patients beginning treatment with a GLP-1 receptor agonist for obesity or type 2 diabetes face a well-documented information gap. Clinical trial side effect rates are published in randomized controlled trials and summarized in package inserts, but these figures often fail to match patient reports aggregated in online communities. For example, SELECT (Lincoff et al. 2023) reports hair loss in approximately 3% of semaglutide-treated patients, while Reddit communities such as r/Ozempic host megathreads with hundreds of posts describing telogen effluvium as a common experience. Similarly, "emotional blunting" — a reduction in affective response to pleasurable stimuli — is virtually absent from RCT safety reports but is widely discussed in patient forums (Kolata 2024; anonymous Reddit threads).

Two interpretations of this gap are possible. The first is that clinical trials are correct and patient reports are biased toward severity: patients who experience side effects are more likely to post about them, producing inflated estimates. The second is that clinical trials systematically miss side effects that are delayed (months after the trial endpoint), subjective (not measured by standardized instruments), or not pre-specified as secondary outcomes. Both interpretations have merit; in practice, both factors operate simultaneously.

Existing consumer-facing resources handle this gap in one of three ways: (a) report only the clinical trial rate, omitting the community signal; (b) report only anecdotal patient experience, omitting the rigorous rate; or (c) blend them into a single number using undocumented weighting. None of these approaches serves the patient who wants to know how likely a side effect really is for someone like them.

### 1.2 Our approach: don't blend, display both

We propose and implement a dual-track framework: for every side effect, compute two parallel signals using disjoint data streams, then display them side by side with their respective confidence intervals and an explicit indication of the data sources feeding each. The clinical track is an incidence estimate; the community track is a reporting frequency — the share of distinct community reports that mention the effect. These are different quantities: a mention frequency is not an incidence rate, cannot be compared to one, and is labelled accordingly wherever it appears. (v4.0 treated the two tracks as comparable and tracked their "convergence"; that framing is withdrawn — see "Changes from v4.0.")

This framework makes no attempt to blend the two signals or decide which better reflects a patient's prospective risk. It presents both, labels their provenance, and leaves interpretation to the patient and their clinician. We argue this is more honest and more informative than blending.

### 1.3 Scope of this paper

This paper describes the methodology, not the clinical implications. We cover: (i) data collection and extraction, (ii) the statistical procedures used for each track, (iii) the self-evolving model update pipeline, (iv) honest limitations, and (v) the open peer-review mechanism. We do not attempt to validate the predictions against independent outcome data — this is explicitly planned for a later phase when data volume permits. We also do not claim the system produces medically authoritative numbers; it is a statistical indicator, not a replacement for clinical judgment.

---

## 2. Methods

### 2.1 Data collection

The system attempts collection from a wider set of scrapers than have actually produced data; Table 1 lists only the source families that have contributed at least one corpus point, with their contribution counts and collection status as of 2026-08-20. This inventory is derived from the corpus itself and served live, with per-source counts and last-seen dates, at https://magistra.health/api/data?q=overview — a source that has contributed nothing cannot appear in it. (v4.0's hand-maintained inventory listed four sources with zero contributed points and described every source as collected daily; see "Changes from v4.0.") Each data point retains its source provenance for the full lifetime of the record, allowing downstream filtering into tracks.

**Table 1.** Data sources by corpus contribution (snapshot 2026-08-20; live version at the public API).

| Source | Points | Most recent | Status |
|---|---|---|---|
| Reddit (16 subreddits) | 684 | 2026-05-28 | blocked (HTTP 403 since 2026-05-28) |
| Health news (Google News RSS) | 180 | 2026-08-19 | active |
| PubMed / PMC (NCBI E-utilities, 35 rotating queries) | 115 | 2026-08-17 | active |
| FDA FAERS (openFDA API, 9 drug variants) | 80 | 2026-08-13 | active |
| Drugs.com patient reviews | 71 | 2026-08-12 | active |
| Journal & institutional pages | 68 | 2026-04-12 | dormant |
| ClinicalTrials.gov (API v2, incl. results sections) | 65 | 2026-08-20 | active |
| medRxiv / bioRxiv preprints | 4 | 2026-06-01 | dormant |

Raw text is retained as a 500-character excerpt for each data point to allow post-hoc auditing and reprocessing with improved extraction prompts (the extraction step itself reads the full fetched text, up to 3,000 characters).

### 2.2 LLM-assisted structured extraction

Raw scraped text is processed by a Claude model (Anthropic; the specific model tier is pinned in the pipeline configuration and validated against production text before any change) via a pre-specified extraction prompt that captures: the side effect mentioned, the drug name (normalized to generic), the extracted incidence rate (if explicitly stated), dose tier, demographic fields (sex, age range, ethnicity, BMI range), lifestyle fields (exercise level, diet, blood type), sample size (if reported), and an extraction confidence label (high / medium / low).

The extraction is deliberately conservative: the prompt specifies that rates must be explicitly stated in the source text, not inferred. Items with no extractable rate are stored with `extractedRate = null` and contribute only to qualitative analysis. Confidence labels are used downstream as multiplicative weights (high = 1.0, medium = 0.7, low = 0.3) on sample-size-based weighting.

Deduplication is performed on the composite key (sourceUrl, sideEffect). The extraction prompt is versioned and any change triggers re-extraction of a sample for validation (planned; not yet implemented).

### 2.3 Dual-track estimation

For a target patient profile P and side effect e, the system produces two parallel signals.

**Rate eligibility (applied before either track).** A rate-bearing data point may support a published estimate only if: (i) its source URL is a citable external origin — points whose provenance is our own site, a synthetic aggregate ("Aggregated user reports"), or a search-aggregator result page are retained and labelled but excluded from every public total and estimate; (ii) it is not a spontaneous-report *share* (e.g. the share of FAERS adverse-event reports mentioning an effect), which is a different quantity from incidence and is kept as a separate labelled signal, never averaged into a rate; (iii) it is that source's single entry for the effect — a paper contributing several rates collapses to one entry per distinct source, so one publication cannot masquerade as multiple independent observations; and (iv) sample sizes extracted from social posts are ignored for weighting. As of 2026-08-29 these rules admit 145 rates from 67 distinct sources out of 310 rate-bearing points; effects whose eligible base is empty publish a clearly-labelled static figure from named published trials instead of a computed estimate.

**Track C (Clinical).** Let D_C(P, e) be the set of eligible data points with sideEffect = e, sourceType ∈ {clinical, regulatory}, and profile filters (sex, dose, ethnicity, exercise) matching P or marked "unspecified". The clinical estimate is computed as:

1. Weighted mean rate, with weights w_i = max(1, n_i) · q_i where n_i is the reported sample size and q_i is the extraction confidence weight.
2. Winsorization at the 5th/95th percentile when |D_C| > 10.
3. Dose adjustment applied if no data point has dose specificity: the weighted mean is scaled by the ratio of the target dose rate to the median dose rate from published baselines.
4. Log-odds transformation; addition of applicable modifier log-odds (sex, age ≥ 65, GI history, diabetes, first month of treatment); inverse transformation back to probability.
5. Cumulative modifier shift is capped at |ΣΔlogOdds| ≤ 2.5 to prevent implausible stacking.
6. Random-effects 95% confidence interval on the log-odds scale using DerSimonian-Laird τ² estimation and delta-method standard error.

**Track R (Community reporting frequency).** The community track does not estimate incidence. Let R be the set of distinct community reports — one row per source URL, restricted to reports hosted on a community platform itself (Reddit, Drugs.com; news-aggregator search results are excluded) and, for Reddit, to posts in the GLP-1, weight-management and diabetes communities the collector is configured to read (added 2026-08-29; see "Corrections in v5.1") — and R_e ⊆ R the subset that mentions effect e. The track reports |R_e| / |R| as a **reporting frequency** with a Wilson score 95% interval. As of 2026-08-29, |R| = 26 (185 before the topical screen); because the Reddit collector has been blocked since 2026-05-28, this denominator is frozen and every published reporting frequency is a fixed number cited with its as-of date. (v4.0's Track R averaged self-reported percentages scraped from individual posts; that procedure is withdrawn — a personal anecdote has no rate, and averaging forum-scraped percentages is not a measurement.)

The two tracks are never blended, never averaged, and never substituted — and, being different quantities (an incidence estimate and a mention frequency), they are never presented as directly comparable. Each is displayed with its own denominator, interval, and data source attribution.

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

The system runs on Node.js with a Next.js frontend and Vercel KV for persistence. The full pipeline (collection → extraction → analysis → config update → sync) executes once daily on a single machine. The statistical code is implemented in plain JavaScript without external dependencies beyond the standard normal CDF approximation (Abramowitz-Stegun).

---

## 3. Results

### 3.1 Current database state

As of 2026-08-29 the corpus holds 1,443 collected data points, of which 1,365 are published (78 April-2026 seed points without a citable external origin are retained, labelled, and excluded from all public totals), across 9 drug variants. Fifteen curated side effects are tracked publicly; extraction has produced 31 distinct effect labels in total. The published source mix is 267 clinical, 80 regulatory, 764 user reports, and 254 news. Of the 310 rate-bearing points, 145 rates from 67 distinct sources are eligible to support a published estimate (§2.3); 2 of the 15 published effects (fatigue, emotional blunting) have no eligible clinical rate and publish a labelled static figure from named published trials instead.

The model health status is "degraded" per the automated review, reflecting insufficient eligible data volume per effect.

### 3.2 Current evidentiary base per effect

Table 2 shows, for the effects with the strongest eligible clinical bases, the number of eligible clinical rates and distinct sources, the resulting confidence grade, and the community reporting frequency (share of the 26 screened distinct community reports mentioning the effect). The computed incidence estimates themselves — weighted means with modifier adjustments and random-effects intervals — are served live by the predictor and public API rather than frozen into this document, since they change as the corpus grows.

**Table 2.** Eligible evidentiary base and community reporting frequency (snapshot 2026-08-29, verified against https://magistra.health/api/data?q=effects).

| Side effect | Eligible clinical rates (distinct sources) | Confidence | Reporting frequency (of 26 screened reports) |
|---|---|---|---|
| Nausea | 32 (20) | high | 38.5% (10/26) |
| Diarrhoea | 12 (6) | moderate | 34.6% (9/26) |
| Constipation | 12 (7) | moderate | 26.9% (7/26) |
| Reduced appetite | 12 (9) | moderate | 30.8% (8/26) |
| Vomiting | 12 (8) | moderate | 42.3% (11/26) |
| Headache | 5 (4) | moderate | 3.8% (1/26) |
| Hair loss (alopecia) | 3 (1) | very low | 3.8% (1/26) |

The two right-hand columns are different quantities and are not comparable to each other (§2.3). The table's purpose is transparency about what each published estimate rests on: nausea's estimate draws on 32 independent clinical rates from 20 distinct sources — more than any other tracked effect — while hair loss, the effect whose apparent clinical-vs-community gap motivated much of v4.0's framing, rests on 3 clinical rates from a single source and is published with a "very low confidence" grade for that reason. The right-hand column's denominator is 26, so each individual report shifts a reporting frequency by 3.8 percentage points; the column is printed with its numerator for that reason.

### 3.3 Convergence hypothesis (withdrawn)

v4.0 hypothesized that the clinical and real-world tracks would converge for mainstream GI side effects as clinical data volume grew. This hypothesis is withdrawn as unmeasurable in the framework's corrected form: the community track is a reporting frequency, not an incidence estimate, so "convergence" between the tracks is a comparison between two different quantities and has no defined meaning. What can be tracked instead — and is, via the live API — is the growth and confidence grading of each track's own evidentiary base.

---

## 4. Limitations

We enumerate limitations explicitly because hidden weaknesses are more dangerous than visible ones.

**Data volume.** Although the corpus held 1,443 collected points as of 2026-08-29, the eligible base behind published estimates is far smaller (145 rates from 67 distinct sources across all effects, same date), and below the threshold for robust inference on most effects — 2 of the 15 published effects have no eligible clinical rate at all, and three more (pancreatitis, hair loss, dizziness) rest on a single distinct source each. Model health is classified as "degraded" until the eligible base per effect grows substantially. Reported confidence intervals should be interpreted accordingly.

**Frozen community denominator, and it is small.** Reddit — the largest community source — has served the collector an HTTP 403 block page since 2026-05-28. After the 2026-08-29 topical screen ("Corrections in v5.1") the community corpus is **26 distinct reports**, and it is frozen at that size until a different access route exists. Every published reporting frequency is therefore a fixed number cited with its as-of date, not a continuously updated statistic, and at n=26 a single report moves any share by 3.8 percentage points — the Wilson intervals are correspondingly wide and should be read, not just the point estimate. This is the framework's weakest published quantity.

**Demographic bias.** Both the clinical and community data sources over-represent female, white, and Western populations. Candidate parameters for ethnicity and BMI are tracked but lack sufficient data for inclusion. The system explicitly flags this as a limitation on every prediction.

**Hand-coded modifiers.** The initial modifier values (female factor, age 65+ factor, etc.) are drawn from published clinical literature and applied uniformly across trials. These are provisional and are being replaced empirically as data accumulates. The model config tracks each modifier's provenance as either "clinical_literature" (hand-coded) or "empirical" (derived from data).

**No interaction terms.** Modifiers are applied additively on the log-odds scale, ignoring potential interactions (e.g., female × age ≥ 65). The cumulative cap at |ΣΔlogOdds| ≤ 2.5 is a partial mitigation but does not substitute for proper interaction modeling.

**No formal calibration — currently unmeasurable.** The system has not been validated against independent outcome data, and applying the rate-eligibility rules (§2.3) leaves no effect with enough eligible rates to fit the logistic calibration model v4.0 described. The honest statement is "calibration cannot currently be measured; here is the n per effect" — not a calibration statistic computed on an ineligible base. A held-out validation remains planned for when the eligible base permits it.

**LLM extraction accuracy.** A Claude model is used for structured extraction but has not been audited against human gold-standard labels on a representative sample. An audit of 50 sources per effect is planned. Until completed, reported sample sizes should be treated as noisy upper bounds.

**Selection bias in community data.** Patient communities over-report severe or unusual experiences; the reporting-frequency track inherits this bias — a mention share measures what a self-selected population chooses to write about, not what a cohort experiences. We do not attempt to correct for it beyond labelling the quantity for what it is and separating the two tracks so the user can see both.

**Journey predictor limitations.** The weight trajectory, muscle loss, and discontinuation models embed expert-coded modifier values (dose, exercise, protein, resistance training) that are not empirically derived. These are provisional and clearly labeled as such.

**Not causal.** Reported probabilities are population-average conditional risks, not individual causal effects.

**No external validation.** The system has not been evaluated in an independent dataset or validated against published pharmacovigilance benchmarks.

---

## 5. Open Peer Review

Magistra's methodology page (https://magistra.health/en/methodology) hosts a researcher feedback form with topic-tagged critique channels (statistical methodology, data quality, calibration, bias quantification, journey predictor, new predictors, collaboration). All received feedback is reviewed, and substantive contributions are acknowledged in a public changelog attached to the model configuration. Researchers and clinicians are invited to submit critique of any element of this methodology.

---

## 6. Discussion and Future Work

### 6.1 Why dual-track is the honest choice

Blended estimates have a single point of failure: the weighting scheme. If the weights are wrong, the output is wrong, and the user has no way to detect this. The dual-track display surfaces what each data stream can actually support. The user sees both signals, labelled for what they are — an incidence estimate and a reporting frequency — understands they come from different data streams measuring different things, and can form their own interpretation. The system is transparent by construction.

### 6.2 The self-evolving loop

The FDR-corrected parameter update pipeline provides a principled mechanism for model evolution without requiring a human in the loop for every update. Safeguards (threshold gating, auto-apply caps, versioned rollback, canonical profile regression testing) are designed to make this safe. In practice, most auto-applies to date have been zero because the data volume is insufficient to meet the thresholds; this is a feature, not a bug.

### 6.3 Roadmap

1. **Phase 1 (current):** dual-track framework live; open peer review solicited; eligibility-screened evidentiary base published with every estimate.
2. **Phase 2:** eligible n ≥ 100 per effect; formal calibration testing; empirical modifier replacement for hand-coded values.
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
- Source code repository: https://github.com/saurabhgoyal75/magistra-predictor

## Appendix B: Correspondence

Saurabh Goyal
Phlo Systems BV
saurabh@magistra.health

All critique, collaboration proposals, and data contributions are welcome.
