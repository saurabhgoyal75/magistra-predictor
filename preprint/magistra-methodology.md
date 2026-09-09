# A Dual-Track Framework for GLP-1 Side Effect Estimation: Separating Clinical Evidence from Real-World Patient Reports

**Saurabh Goyal**
Phlo Systems BV
saurabh@magistra.health
https://magistra.health

**Version:** 5.13
**Date:** 9 September 2026 (v5.12: 9 September 2026 — see "Corrections in v5.13"; v5.11: 9 September 2026 — see "Corrections in v5.12"; v5.10: 9 September 2026 — see "Corrections in v5.11"; v5.9: 8 September 2026 — see "Corrections in v5.10"; v5.8: 8 September 2026 — see "Corrections in v5.9"; v5.7: 7 September 2026 — see "Corrections in v5.8"; v5.6: 5 September 2026 — see "Corrections in v5.7"; v5.5: 4 September 2026 — see "Corrections in v5.6"; v5.4: 4 September 2026 — see "Corrections in v5.5"; v5.3: 31 August 2026 — see "Corrections in v5.4"; v5.2: 30 August 2026 — see "Corrections in v5.3"; v5.1: 29 August 2026 — see "Corrections in v5.2"; v5.0: August 2026 — see "Corrections in v5.1"; v4.0: April 2026 — superseded; see "Changes from v4.0")
**Classification:** q-bio.QM (Quantitative Methods) / stat.AP (Applications)

---

## Abstract

Patients starting GLP-1 receptor agonist therapy (semaglutide, tirzepatide, liraglutide) for weight management face a persistent information gap: clinical trial side effect frequencies often diverge substantially from the experiences described in patient communities, but existing resources typically report only one or the other. We describe a dual-track estimation framework that collects, extracts, and reports two parallel signals per side effect — a clinical incidence estimate derived exclusively from peer-reviewed clinical trial and regulatory data, and a community reporting frequency (the share of distinct community reports that mention the effect) — without blending them, and without presenting them as comparable quantities. The framework is implemented as a live, continuously updated system (magistra.health) that ingests daily from public clinical, regulatory, community, and news sources, uses LLM-assisted structured extraction with confidence weighting, applies a simplified, unweighted random-effects confidence interval (inspired by DerSimonian-Laird, not inverse-variance weighted) with capped log-odds modifier stacking to the clinical track, and Wilson score intervals to the community track. Published estimates are restricted to an eligibility-screened base: every rate must have a citable external origin, each distinct source contributes at most one rate per effect, and spontaneous-report shares are never averaged into incidence. At the time of writing (snapshot 31 August 2026, verified against the live API) the corpus holds 1,482 collected data points, of which 311 state a rate; 74 rates from 51 distinct sources are eligible to support published estimates — reduced from the 145 printed in v5.1–v5.2 by the seed-row screen described in "Corrections in v5.3", and restated to 71 rates from 50 by the withdrawal in "Corrections in v5.9" — and the community denominator is 26 distinct reports, reduced from the 185 reported in v5.0 by the topical screen described in "Corrections in v5.1". A self-evolving pipeline computes empirical odds ratios for all parameter × effect combinations daily, applies Benjamini-Hochberg FDR correction across the full test battery, and updates model parameters under pre-registered thresholds. We discuss limitations honestly, including demographic bias, a frozen community collector (Reddit has served the scraper an HTTP 403 block page since May 2026), and the absence of formal calibration — which the eligible base is currently too small to support at all. The system is open: its methodology is public, its code is available, and it actively solicits peer critique via a structured feedback channel. We argue that displaying both signals with their provenance is more informative and more honest than blended or single-source estimates.

**Keywords:** GLP-1 receptor agonists, semaglutide, tirzepatide, pharmacovigilance, real-world evidence, meta-analysis, random-effects (unweighted), patient-reported outcomes, LLM extraction, self-evolving models, open methodology

---

## Changes from v4.0 (August 2026)

v4.0 (April 2026) described a method and a data-source inventory that internal audits between 2026-08-13 and 2026-08-17 found the live system either no longer matched or should never have published. v5.0 corrects the text rather than annotating it; the four substantive corrections, in the order they were found:

1. **Rate eligibility (2026-08-13).** v4.0 weighted every rate-bearing data point. The system now excludes rates that cannot support a published estimate: rates without a citable external origin (including 78 April-2026 seed points whose source URL pointed at our own site — retained, labelled, and excluded from every public total); spontaneous-report *shares* (FAERS reports the share of adverse-event reports mentioning an effect — averaging that into incidence is a category error, and at n=82,377 it silently dominated every estimate it touched); multiple rates from a single source (now collapsed to one entry per distinct source per effect); and sample sizes extracted from social posts (one X/Twitter post carried n=500,000 — a follower count, not a cohort — and drove a "14× hair loss" discordance claim, now withdrawn). What v4.0 presented as resting on ~1,200 data points rests, after screening, on the eligible base stated in the abstract.
2. **The real-world track is a reporting frequency, not an incidence (2026-08-14).** v4.0's "real-world" track averaged self-reported percentages scraped from individual community posts; a personal anecdote has no rate. The track now reports the share of distinct community reports (deduplicated by source URL) that mention each effect, with Wilson intervals. Consequently v4.0's clinical-vs-real-world "convergence" framing — including the illustrative gap table and the abstract's hair-loss example — is withdrawn as a category error: a mention frequency and an incidence rate are not comparable quantities (see §3.3).
3. **The published data-source inventory was wrong (2026-08-17).** v4.0's Table 1 listed sources (Google Scholar, 1mg.com, PvPI, Trustpilot) that had never contributed a single corpus point, and described every source as collected daily while Reddit had been blocked since 2026-05-28. Table 1 is now derived from the corpus and served live at the public API; a source that has contributed nothing cannot appear in it.
4. **Source-type labels were assigned by scraper keyword, not by publisher (2026-08-14, fully landed 2026-08-17).** 44 points typed clinical or regulatory and branded "WHO/…", "MHRA/…", "EMA/…" or "Cochrane/…" were Google News search-result blurbs whose actual publisher was never the named agency; a further 78 points branded "Quora —" or "Twitter/X —" were likewise Google News results, not platform collections. All were relabelled by their real mechanism in both the repository and production stores. None carried an eligible rate, so no published estimate changed.

---

## Corrections in v5.13 (9 September 2026)

v5.13 withdraws one rate that its own source never states, and corrects two places in §2 where this document describes the safeguard against that class as weaker than the system actually implements. The site-wide eligible base falls by one rate and one distinct study. **No per-effect published estimate changes** — the withdrawn row is a community (`user_report`) point, and the clinical track excludes it by source type — and the 2026-08-31 snapshot this document reports throughout is unaffected.

19. **The rate-eligibility screen was built entirely from clinical failure modes and never asserted that a COMMUNITY row's rate is stated in its own text (2026-09-09).** Every rule in §2.3's eligibility list targets a way a *clinical* rate can be unsupported: a non-citable origin, an April-2026 seed row, a search-aggregator result page, a FAERS spontaneous-report share. None asks the question this framework's own community-track rule makes central — a personal anecdote has no rate. One row slipped through on exactly that gap: a single Reddit post (`reddit.com/r/Retatrutide/comments/1tpun08/`), scraped 2026-05-28, whose text reads "I never actually vomit, but it's like a constant sickness feeling" and contains no percentage, no fraction and no cohort anywhere, was stored as `extractedRate: 0`, `extractedSampleSize: 1`, `extractionConfidence: high`, and counted toward the published site-wide eligible base for 104 days. Found not by a data audit but by an arithmetic check: the audit script's site-wide headline (215) did not equal the sum of the per-effect clinical column it prints beneath that headline (214), and the one-rate gap was this row. The rate is withdrawn in both stores (`extractedRate → null`, `rateWithheld: "rate_not_stated_by_source"`, the same reason string as "Corrections in v5.9", so the row stays in the corpus and remains auditable). The class was measured before and after, corpus-wide and in both stores, by re-running the eligibility screen and asking of every eligible non-clinical row whether its own excerpt states its rate verbatim: exactly **one** row matched, and zero remain. Published figures: the site-wide eligible base falls from **215 rates / 32 distinct studies to 214 rates / 31 distinct studies** (441 → 440 rate-bearing points; 102 → 101 source entries), verified against production before and after. Vomiting's clinical figures — the effect the row was filed under — are unchanged at 9.7%, 25 rates from 15 sources, because a `user_report` row never entered that pool.

20. **§2.2 and §2.3 described a prompt instruction where the system has enforced a write-time gate since 2026-09-05 (2026-09-09).** §2.2 stated only that "the prompt specifies that rates must be explicitly stated in the source text, not inferred", and §2.3's eligibility list did not mention verbatim statement at all. A prompt instruction is a request; the system has since 2026-09-05/06 additionally applied a write-time gate (`agents/data/src/lib/rate-gate.mjs`, called unconditionally from both extraction loops with no source-type branch) that rejects a rate absent from its own source text or equal to the midpoint of a stated range, nulls it, and records `rateWithheld` — the mechanism that makes item 19 a historical backfill rather than an open hole, since every row written after the gate shipped is screened regardless of track. Both sections now describe the gate and its scope. Corrected in the same cycle as item 19 because the same reading that finds a withheld row is the reading that asks what prevents the next one; this document's own "Corrections in v5.12", item 18, records the cost of leaving that question for a later pass.

**On the v5.12 corpus-composition note:** that note recorded the eligible base rising to 215 rates / 32 distinct studies on the 2026-09-09 05:17 run. It described the state at the time it was written and is left as recorded; item 19 restates the current figure to 214 / 31.

---

## Corrections in v5.12 (9 September 2026)

v5.12 corrects two places where this document's own prose had not kept pace with a fix it already logged, and separately records a corpus-composition change that is not a methods change. No eligibility rule, no interval method and no rate in the 2026-08-31 snapshot this document reports throughout changes.

17. **A derivation that returns `null` for an undefinable case handed the decision back to the same extraction-model guess it was built to remove (2026-09-09).** "Corrections in v5.11" (items 15–16) derived a registry row's dose tier deterministically from its arm label for the three molecules with an approved maintenance-dose ladder (semaglutide, tirzepatide, dulaglutide), documenting that "the model's value is kept only where the label determines nothing" — investigational molecules with no ladder (retatrutide/LY3437943, orforglipron/LY3502970), oral semaglutide's unrelated dose scale, and combination arms. What the extraction model's value already held on exactly those rows was itself read off the same arm label the derivation exists to replace, so "keep what the caller already had" preserved the very inconsistency the fix targeted. Measured before changing anything: 13 of 240 registry rows carried a non-`unspecified` tier no ladder supports, and the extraction model contradicted itself across 7 distinct arms (arm "8 mg LY3437943 (4 mg)" alone: 7 rows `unspecified`, 1 `high`, 2 `medium`). A tag is not inert — it excludes a row's rate from the other two tiers' pools. Fixed by separating two cases one `null` had conflated: *undefinable* (no ladder exists for the molecule — the tier is now asserted `unspecified`, overwriting the model's guess) from *unknown but knowable* (a ladder exists but the arm label states no dose — still deferred, unchanged, routed to manual review). Applied to both stores (13 rows each, identical resulting state) and verified against production at every affected tier before and after: every tier gained the rates the unsupported tag had excluded it from, no point estimate moved, and no estimate flipped to or from the literature fallback.

18. **§2.2's own description of the deduplication key still read its pre-fix form five days into "Corrections in v5.10" (2026-09-09).** That correction extended the write-time dedupe identity from `sourceUrl::sideEffect` to include a registry row's arm label, live in production since 2026-09-09; §2.2 continued to state "Deduplication is performed on the composite key (sourceUrl, sideEffect)" — unchanged since v4.0 — through v5.11. Corrected below to name the extension and its scope (registry rows only; every other source produces the same key as before). Found while drafting this entry, not by a scheduled review pass: a Corrections item documents a fix to the *code*, and nothing had separately asked whether the *prose describing that code* elsewhere in the same document still matched it. Separately, the arm-label fix had **three** write paths to reach, not the two an earlier draft of this entry named: `src/lib/side-effects-db.ts` (the application/production-store path, corrected 2026-09-09 00:43); `daily-pipeline.mjs` (the script the daily scheduled run actually invokes, which carries its own copy of the write path, corrected 2026-09-09 03:58 into a single shared definition, before the next scheduled run reached it — the first run under the corrected key, 2026-09-09 05:17, stored 68 of 444 collected rows with no collapse); and the local-file fallback inside the standalone `collect.mjs` collector, which writes to the repository file whenever the production store is unreachable and kept its own copy of the pre-fix two-part key until 2026-09-09 09:43, when a pre-publication check of this entry against the code found it. All three now call the one shared definition. No stored row is affected — the fallback path did not run between the fix and its correction — so this remains a documentation and duplicate-call-site fix, not a data correction, and no published rate changes. The same check found the two audit tools written for this failure class (`scripts/audit-provenance.mjs`, which compares the two stores, and `scripts/sync-db-from-kv.mjs`, which repairs the file from production) still keyed on the pre-fix two-part key, i.e. a lost dosing arm would have been invisible to the guard built to catch exactly that loss; both were re-keyed the same day, and the two stores agree on every row under either key (0 missing in both directions, measured before the change).

**Corpus composition, not a methods change:** the sixth pinned pivotal trial (NCT04881760, retatrutide) became reachable for the first time on the 2026-09-09 05:17 run — a storage-side "already reachable" gate fixed 2026-09-08 whose positive branch had not yet fired live — and contributed 60 new arm rows across 10 tracked effects. The site-wide eligible base rises from 154 rates / 31 distinct studies (as reported in "Corrections in v5.11") to **215 rates / 32 distinct studies**. This is new evidence entering the corpus through the existing pinned-trial mechanism, not a change to how any rate is computed, and is not itself logged as a numbered correction.

---

## Corrections in v5.11 (9 September 2026)

v5.11 corrects §2.2's description of how a data point's dose tier is obtained, and adds a Limitations note on titrate-to-maximum-tolerated-dose arms. No rate, no eligibility rule and no figure printed in any table of this document changes — the corpus snapshot (2026-08-31) is not re-taken, and production still reports 154 eligible stated rates from 31 distinct studies over 1,657 points, before and after. What changes is which dose tier's pool a registry arm's rate enters, and therefore some live per-tier predictor estimates, which this document does not print.

15. **§2.2 described the dose tier as an extracted field for every source; for trial-registry rows it is now derived from the arm label (2026-09-09).** Through v5.10 the extraction paragraph listed "dose tier" among the fields a language model captures from raw source text. Measured against the corpus on 2026-09-08, that field was assigned inconsistently on registry rows: 11 of 43 distinct ClinicalTrials.gov arm labels carried more than one tier across rows of the *same* arm (for example "10 mg Tirzepatide" appearing as `medium`, `high` and `unspecified`). A registry arm states its own dose in its label, so the tier is now derived deterministically from that label at write time for the three molecules with an approved maintenance-dose ladder (semaglutide, tirzepatide, dulaglutide), and the model's value is kept only where the label determines nothing — investigational dose-finding cohorts with no maintenance-dose structure (orforglipron/LY3502970), combination arms, and labels carrying no dose. 52 stored rows were corrected in both stores. The change is confined to the predictor's per-tier estimates, the per-point dose shown on the public sources page, and the `extractedDoseTier` column of the dataset export; it does not touch any pooled rate published by the API, which pools across tiers.

16. **Titrate-to-MTD trial arms have no dose tier and are no longer assigned one (2026-09-09).** Seven stored rows from two arms were tagged `high` in production — pooled into the high-tier estimate and excluded from the low and medium pools — on the reading that a maximum-tolerated-dose arm reaches the trial's top dose. The registries state otherwise in their own words: NCT04255433 (SURPASS-CVOT) describes its "Tirzepatide - Maximum Tolerated Dose (MTD)" arm as "escalated by 2.5 mg every 4 weeks to a maximum of 15 mg QW or MTD tolerated by the participant (5 mg QW or 10 mg QW)", and NCT05564039 (SURPASS-SWITCH) describes its two arms as titrating "until 15 mg or MTD was reached" and "until 4.5 mg or MTD was reached". Such an arm's adverse-event rate is pooled over participants spread across dose tiers, and neither registry publishes that distribution, so no single tier can be assigned without inventing one. These rows now carry `unspecified`, which in this framework means the point contributes to every tier's pool rather than to none. Added to §4 as a limitation: a rate from a titrate-to-target arm is a mixed-dose quantity, and the framework represents it as dose-unspecified rather than attempting to disaggregate it.

---

## Corrections in v5.10 (9 September 2026)

v5.10 restores one trial-arm rate that a storage dedupe key had silently dropped from the production store, and fixes the "as of" date that restoring it exposed as wrong. One published figure changes (vomiting's interval and its per-source figure for one trial); the eligible base rises by one rate. No computation, no eligibility rule and no interval method changes; the 2026-08-31 snapshot this document reports throughout is unaffected, because the dropped row was already absent from the store those figures were computed against.

13. **A dedupe key keyed on source URL + effect dropped every trial arm after the first when a trial's arms arrived in separate extraction batches (2026-09-09).** `addDataPoints` (`src/lib/side-effects-db.ts`) deduplicated incoming points on `sourceUrl::sideEffect`. A ClinicalTrials.gov record states a separate rate for every dosing arm, all under one URL and one effect, so arms were distinguished only when they happened to arrive in the same batch — the filter compares incoming points against rows already stored, not against each other. NCT03929744 ("A Study of LY3502970 in Healthy Participants", orforglipron, Phase 1) posted vomiting in its "Part A 6 mg" arm (4 of 6, 66.7%) and its "Part A 3 mg" arm (3 of 6, 50.0%); both were scraped on 2026-08-20, 52 seconds apart, in different batches, and only the first reached production. Because the key then existed, no later run could ever add the second. Measured across all 1,657 rows of both stores before changing anything, this was the only such loss corpus-wide, but it applied to every future multi-arm trial. Consequence while it stood: the live API published **18** eligible stated vomiting rates where the repository file — and the £49 dataset CSV built from that file — held **19**, and the API's per-source figure for NCT03929744 read 66.7% (one arm) rather than the two-arm mean of 58.4%. Fixed by extending the dedupe identity with the arm label the collector already writes verbatim into each row's excerpt (`In the "<arm>" arm`); a point with no arm label — every non-registry source, 1,478 of 1,657 rows — produces the previous key unchanged. Verified by simulating the new key against both stores before deploying (exactly one row added, no key collapsed) and then against production after: **vomiting 9.7% with 19 rates from 14 sources, 95% CI 0–76 (was 9.7%, 18 rates, CI 0–82)**; the site-wide eligible base rises from 153 rates / 31 distinct studies to **154 rates / 31 distinct studies** (the restored arm is the same study, so the study count does not move). Figures reported in "Corrections in v5.9" describe the state on 2026-09-08 and are left as recorded.

14. **The corpus's public "as of" date was the last element of the storage array, not its most recent scrape (2026-09-09, exposed by the fix above).** `buildMeta` set `lastScraped` to `points[points.length - 1].scrapedAt`. That is correct only while the array is in scrape order, which it is when the daily pipeline appends — and wrong the moment any repair appends an older row. Restoring the 2026-08-20 arm above rewound the site-wide date from 2026-09-08 to 2026-08-20 and carried it into `/api/data`'s `lastUpdated`, the machine-readable evidence snapshot in `llms.txt` and that snapshot's own "Quotable as" citation string, all of which then understated the corpus's currency by 19 days. Fixed to the maximum `scrapedAt` across countable points (the same reduction `/api/data` already used for its per-effect date), the stored metadata recomputed against production, and both artifacts regenerated. Nothing about this defect could have been caught by a data audit: the number it produced was a real date from a real row.

---

## Corrections in v5.9 (8 September 2026)

v5.9 withdraws three rates that no source states. Published figures change: three of the fifteen effects' pooled clinical estimates move, and the eligible base falls by three rates and one distinct study. No computation, no eligibility rule and no interval method changes; the community track, its denominator of 26, and every other effect's figures are untouched.

12. **Three hand-authored April-2026 rows carried incidence rates their own source never states, and an `n` of 27,885 made them the largest term in three pooled estimates (2026-09-08).** Rows `nature_gwas_nausea_2026`, `nature_gwas_vomiting_2026` and `nature_gwas_efficacy_2026` stated nausea 35%, vomiting 8% and reduced appetite 22% at a sample size of 27,885, cited to Nature s41586-026-10330-z. The paper is real, resolves, and is correctly *described* by the rows: it is a genome-wide association study of 27,885 people on GLP-1 receptor agonists, reporting odds ratios and P-values for GLP1R/GIPR variants associated with nausea and vomiting. It reports no incidence rate for any effect — fetched and read on 2026-09-08, the text contains no "35%" or "22%" in any side-effect context and its only "8%" is "96.8% of participants having a BMI of at least 25" — and none of the three percentages appears in the rows' own stored excerpts either. They are the same class as the seed rows withdrawn in "Corrections in v5.3": our own static table restated as extracted points. They escaped that pass because it identified seed rows by the template excerpt shape ("*Effect*: clinical rate of X% at Y dose") and these three carry bespoke prose under a genuine, resolvable URL. Because the pooled mean weights each source by max(1, *n*) × a quality factor, a fabricated *n* of 27,885 outweighed every real study in its pool: for vomiting it was 27,885 of the 48,797 summed sample size. Withheld in both stores on 2026-09-08 (`extractedRate` → null, `rateWithheld: "rate_not_stated_by_source"`, `scripts/fix-unstated-seed-rates.mjs`, keyed on the structural tell that a hand-written row has a non-UUID id — the only three such rated rows in either store). Measured against production immediately before and after: **nausea 29.8% → 22.8% (41 rates/28 sources → 40/27, 95% CI 8–68 → 4–67), reduced appetite 17.6% → 11.1% (17/13 → 16/12, CI 2–72 → 0–85), vomiting 8.7% → 9.7% (19/15 → 18/14, CI 0–85 → 0–82)**; the site-wide eligible base falls from 156 rates / 32 distinct studies to **153 rates / 31 distinct studies**. Every figure this document quotes for its 2026-08-31 snapshot was computed over a base that contained these three rates: that base is 71 eligible rates from 50 source entries and 22 distinct studies rather than 74 from 51 and 23 (the three rates share one source name, so they are one entry site-wide and one study), Table 2's nausea, reduced-appetite and vomiting rows each lose one rate and one source (footnoted at the table), and the observation in "Corrections in v5.3" that nausea's pooled rate was "32.3% before and after" the seed screen was itself measured over a pool still containing the nausea row. The corpus was not re-snapshotted for this version.

---

## Corrections in v5.8 (8 September 2026)

v5.8 corrects the definition behind one aggregate figure. No computation of any published estimate changes, no per-effect figure in any table of this document changes, and the corpus snapshot (2026-08-31) is not re-taken.

11. **The site-wide "distinct sources" count was keyed by source name, which embeds the effect for registry rows (2026-09-08).** `buildRateBase` collapses eligible rates to one entry per `sourceName`. Per effect that is the intended unit — one trial's three dose arms for alopecia are one source — and every per-effect count in Table 2 and in the live API is identical under a name key and a study-URL key (checked for all 15 effects on 2026-09-08). But registry rows are named "ClinicalTrials.gov results — *trial* — *MedDRA term*", so summed across effects a trial posting seven tracked terms counted as seven sources: on 2026-09-08 the live aggregate read 156 eligible rates from 92 "distinct sources" while the same rates came from 32 distinct studies by URL (the NCT or PMID page, fragment stripped). The site-wide figure is now keyed by study URL in the API (`evidentiaryBase.distinctSources`; the name-keyed count is exposed alongside as `sourceEntries`), on the methodology page and in every regenerated artifact; per-effect counts are unchanged. The figures this document quotes for its 2026-08-31 snapshot are restated under both keys in §4: 74 eligible rates were 51 source entries and **23 distinct studies**. The overcount was noticed when three newly fetched trials moved the count from 73 to 92 in one morning, an increase no plausible number of studies could produce.

---

## Corrections in v5.7 (7 September 2026)

v5.7 corrects four statements in §2.6 and §6.2 that described the self-evolving pipeline's safeguards. No computation changes, no figure in any table of this document changes, and the corpus snapshot (2026-08-31) is not re-taken.

10. **§2.6 and §6.2 described safeguards the code does not contain (2026-09-07).** Through v5.6 (and v4.0 before it) this document stated that (a) "the previous 30 versions are retained for rollback"; (b) "canonical patient profiles are evaluated against each new config and compared to the prior day's output; any prediction shift greater than 20 percentage points triggers a regression alert"; (c) base rates are checked to lie in [0.01, 0.70] before a change is committed; and (d) each run adjusts "~180-240 tests". Read against `analyze-model.mjs` (mirrored under `methodology/` in the source repository): (a) the only 30 in the code caps the in-config changelog at its last 30 entries; the outgoing configuration is archived, one file per version, whenever a change is applied or flagged, with no retention cap — and because no run has ever applied or flagged a change, that archive directory has never been created. (b) No canonical-profile evaluation, prior-day comparison or regression alert exists anywhere in the pipeline; the sentence described an intended safeguard as an implemented one, and it is withdrawn. (c) The only value bound enforced is on odds ratios ([0.1, 5.0]); no base-rate bound is checked. (d) The number of tests per run is the number of (dimension × effect) cells with enough eligible evidence in both comparison groups; the daily logs from 2026-04-13 to 2026-09-07 record between 0 and 15 tests per run, never more (5 on 2026-09-07). §6.2's "most auto-applies to date have been zero" is sharpened the same way: every logged run has auto-applied 0 and flagged 0 changes. The decision table's thresholds, the odds-ratio bound and the 5-per-day cap were each confirmed against the code and are unchanged. Found by the operator's scheduled red-team pass reading §2.6 against the code path, one day after the same pass had corrected the "30 versions" wording in the source repository's README and left the regression-testing clause standing in the same sentence.

---

## Corrections in v5.6 (5 September 2026)

v5.6 adds one Limitations entry. No computation changes, no figure in any table of this document changes, and the corpus snapshot (2026-08-31) is not re-taken.

9. **The dose-tier rescale was undisclosed as a limitation (2026-09-05).** §2.3/§2.4 describe the pooled corpus rate and the per-tier rescale the live predictor applies when fewer than half of an effect's pooled points carry a dose tag (§4, new bullet below), but this document never named that rescale as a source of bias. Found by the framework's own daily automated peer review (2026-09-05, Issue 1). No code changed and no published figure changed — this is a disclosure gap, not a computation error, and it is added to §4 rather than corrected retroactively because the rescale itself (and its per-estimate basis-string disclosure) has been live and unchanged since 2026-08-28. Quantifying how much the rescale currently shifts each affected estimate needs a live corpus read and is left for a subsequent cycle with production access (see the new §4 bullet). Same version, before first publication (5 September 2026, local review): the §4 bullet's first draft asserted the static per-tier figures "come from different trial arms"; that was an inference — for the ten gradient effects no per-tier derivation is recorded — and the published wording says so instead, with a dated point check of the rescale's live magnitude. §2.3 step 3, which still described the pre-2026-08-28 "no data point has dose specificity" trigger, is aligned to the majority-of-points threshold the code has applied since then. The live predictor's per-estimate disclosure, which called the table "published-trial", is reworded the same day.

---

## Corrections in v5.5 (4 September 2026)

v5.5 corrects one citation in this document's introduction and records a change to the static literature figures the live system serves for three effects. No computation changes, no figure in any table of this document changes, and the corpus snapshot (2026-08-31) is not re-taken.

8. **The introduction attributed a hair-loss rate to a trial that does not report one (2026-09-04).** Through v5.4, §1 stated that "SELECT (Lincoff et al. 2023) reports hair loss in approximately 3% of semaglutide-treated patients". SELECT is a cardiovascular-outcomes trial; its abstract (PMID 37952131) contains no hair-loss term, and the full text is not the source of the figure. The 3% figure is real but comes from the FDA Wegovy (semaglutide) prescribing information, revised 06/2026, Table 3: hair loss in 3% of adults on 2.4 mg once weekly (N=2,116) versus 1% on placebo (N=1,261). §1 now cites that source. The same mis-attribution sat in the live system's static reference table for hair loss (cited to SELECT), dizziness (cited to STEP-2, whose abstract contains no dizziness figure) and pancreatitis (cited to a university news release that states no rate): on 2026-09-04, under a founder-approved decision, each of those three static figures was replaced by the FDA label's figure with its table, arm and N recorded beside it — hair loss 3%, dizziness 8% (Table 3, 2.4 mg vs placebo 4%), and for pancreatitis the label's 0.2 adjudicated acute-pancreatitis cases per 100 patient-years of exposure (section 5; 4 cases on Wegovy vs 1 on placebo), which is an exposure-time rate rather than a proportion of patients and is displayed with that unit. The label states no per-dose-tier figure for any of the three, so each is one value at every tier, as fatigue has been since v5.3. These are the static fallback figures §2.3 describes for effects with no eligible corpus rate; Table 2 lists those effects as "literature fallback" without printing the figure, so **no figure printed in this document changes**.

---

## Corrections in v5.4 (4 September 2026)

v5.4 corrects one computation in the live predictor and changes no figure printed in this document.

7. **The predictor's clinical-track interval was evaluated at the profile-adjusted rate, not at the evidence (2026-09-04).** Through v5.3, `computeConfidenceInterval` in `side-effects-engine.ts` received the profile-adjusted rate p_adjusted (§2.4, plus any dose-tier rescale) as the p in every term of §2.5 — the within-study variance p(1-p)/N, the τ² subtraction, and the delta-method Jacobian 1/(p(1-p)). §2.5 defines p as "a rate computed from k studies"; the code substituted the patient's adjusted value. Because p(1-p) is largest at 0.5, a profile whose modifiers pushed the estimate toward 50% received a systematically narrower interval than the evidence supports, and one pushed toward the extremes a wider one — the interval's width was a function of the patient's profile, not of the precision of the evidence. Measured against production on 2026-09-04 (same evidence, three profiles): vomiting, pooled 8% with interval 0–96%, displayed 42% with interval 12–79% for a female, 70, GI-history, diabetes, high-dose, first-month profile, where the evidence-anchored interval is 1–98%; diarrhoea for the same profile displayed 63% with 26–89% against 12–95%; nausea for a female, 40, low-dose profile displayed 22% with 2–77% against 4–65%. Found by the framework's own daily automated peer review (2026-09-04, Issue 1) and verified against the code and against production before the fix shipped.

   Fixed 2026-09-04: v and SE_logit are now evaluated at the pooled rate p, and the resulting logit-scale half-width is applied symmetrically around logit(p_adjusted) (§2.5, "Profile-adjusted estimates"). An unadjusted estimate — every figure served by the public API's `?q=overview`, `?q=effects` and `?q=effect` endpoints, the CC BY aggregate table, the llms.txt snapshot, the sold data brief, and every predictor estimate for a profile with no modifier and no dose rescale — has p = p_adjusted and is unchanged. **No figure printed in this document changes**: Table 2 and every base count remain the 2026-08-31 snapshot, and the corpus was not re-snapshotted for this version. What changes is every live predictor interval for a modified or dose-rescaled profile — figures this document never printed, served live by the predictor and by `/api/predictor/calculate`.

## Corrections in v5.3 (31 August 2026)

v5.3 removes 72 rate rows from the eligible base that should never have been in it, and restates every base figure in this document accordingly.

1. **What was wrong.** The April-2026 seeding pass that populated the initial database wrote rows whose rates restate our own static literature table, with template excerpts and placeholder sample sizes (200/300/500 by dose tier), attributed to real trial and study URLs (NEJM, The Lancet, medicine.washu.edu, …) that no extraction ever read — in places the same hand-typed rate is attributed to two different studies at once. The 2026-08-16 relabel that excluded 78 seed rows keyed on our own domain in the source URL, so these 72 — wearing real external URLs — passed every URL-based eligibility screen and were counted as "stated rates" toward published estimates and source counts. All 150 seed rows now carry `provenance: "seed-2026-04"`, the eligibility classifier excludes that provenance explicitly (exclusion reason `seed_unverified`, visible in the API's `excluded` counts), and a standing audit asserts that no seed-template excerpt can sit unlabelled in either data store.
2. **Published figures change in this version.** The eligible base falls from the 145 rates / 67 distinct sources printed in v5.1–v5.2 (measured 2026-08-29, seed rows included in error) to **74 rates from 51 distinct sources** (2026-08-31; re-running the eligibility rules on the same corpus with and without the seed screen removes exactly 72 eligible entries and 17 distinct sources — the remainder of the difference is ordinary corpus growth between the two dates): roughly half of the previously stated base was our own table reflected back at us. Five of the 15 published effects (pancreatitis, fatigue, hair loss, dizziness, emotional blunting) now have no eligible clinical rate and publish a clearly-labelled static literature figure; four more (abdominal pain, acid reflux, gallstones, injection-site reaction) rest on a single distinct source. Pooled estimates for the well-evidenced effects moved little (nausea is 32.3% before and after, to one decimal), because genuinely large-n studies dominated those pools. No computation changed and the corpus was not re-collected; the base figures in earlier versions are superseded by this correction and should not be cited.

## Corrections in v5.2 (30 August 2026)

v5.2 changes no number. It corrects the *name* this framework gave its own
confidence-interval estimator, on every surface that stated it.

6. **The τ² estimator was labelled "DerSimonian-Laird"; it is not that estimator (2026-08-30).** Through v5.1 the abstract, keywords, §2.3 and §2.5 of this document — and the methodology page, JSON-LD, API documentation and public code mirror alongside it — described the clinical track's between-study heterogeneity term as DerSimonian-Laird τ², citing DerSimonian & Laird (1986) [ref 8]. The implementing function (`computeConfidenceInterval` in `side-effects-engine.ts`) computes an **unweighted** arithmetic mean of the study rates and an **unweighted** sum of squared deviations, and subtracts a single common within-study variance derived from the average n per study. The DerSimonian-Laird estimator weights both by inverse variance; ours does not. The two coincide only when every contributing study carries equal weight, which our eligible base does not guarantee.

   The name has been replaced everywhere with a description of what the code does — "a simplified, unweighted random-effects τ² estimator (inspired by DerSimonian-Laird, not inverse-variance weighted)" — and reference 8 is retained as the acknowledged inspiration for the estimator's form rather than as a claim of identity with it.

   **No published figure changed.** The relabel corrects a methodological claim, not a computation: the code was not altered, so every confidence interval in this document and on the live site is exactly what v5.1 published. All corpus figures printed here remain the 2026-08-29 snapshot v5.1 carried; they were not re-snapshotted for this version, and the live figures are always served at the API endpoints named below.

   Whether to replace the estimator with a properly inverse-variance-weighted one is a separate, open question. It is not made here because it would change published intervals, and because at the current eligible base most effects contribute too few distinct sources for the weighting to be well determined.

---

## Corrections in v5.1 (29 August 2026)

v5.1 corrects one substantive error in v5.0 and re-dates every corpus figure. The correction is stated here rather than silently applied, because v5.0's community figures were published and may have been read or cited.

5. **The community report population was contaminated; the denominator falls from 185 to 26 (2026-08-29).** v5.0's Track R denominator (|R| = 185) was not the set of GLP-1 community reports it claimed to be. The Reddit collector's server-side subreddit restriction (`restrict_sr=1` on old.reddit's `search.json`) was not holding, and its search terms are generic symptom words ("nausea vomiting", "gallbladder", "constipation diarrhea"), so an unrestricted search returned posts from anywhere on Reddit. The defect was invisible because each stored point was named for the subreddit we had *queried*, not the one the post was actually in — so the corpus read as though every report came from a GLP-1 community. Reading the labels against their own permalinks showed that 679 of 711 Reddit-named points (95.5%) were misattributed, and that **159 of the 185 distinct community reports (86%) came from communities we never collect from** — r/gallbladders (102 points), r/AskDocs (82), r/pregnant (26), and others including r/HyperemesisGravidarum, r/Ovariancancer and r/Celiac. Pregnancy nausea and post-cholecystectomy pain were counted as GLP-1 patient reports, in the numerator *and* the denominator of every published reporting frequency.

   Three fixes were applied on 2026-08-29 and are live: the collector now names each point by the post's own subreddit and discards results from outside its configured list; the 679 misattributed points were relabelled by permalink in both the repository corpus and the production store; and `isCommunityReport` (§2.3) now additionally requires a Reddit post to be in a GLP-1, weight-management or diabetes community we collect from. **Every reporting frequency in this document has been recomputed over the screened population of 26 reports** (Table 2, §3.2, §5). The ordering changed as well as the magnitudes: v5.0's Table 2 showed nausea as the most-mentioned effect at 24.9%; over the screened population vomiting (42.3%) and nausea (38.5%) lead, and abdominal pain — which v5.0-era analysis had reported as out-mentioning nausea — falls from 27.6% to 15.4%, that finding having been an artefact of r/gallbladders and r/AskDocs dominating the pool.

   No clinical or regulatory estimate changed: the screen is on the community report *population*, and none of the excluded points carried an eligible rate (§2.3). The clinical figures in this version differ from v5.0's only because they are a later snapshot.

   The correction is *not* a reason to read the remaining 26 reports as more reliable than their size allows — with n=26, a single report moves any share by 3.8 percentage points, and the base cannot currently grow (§5, frozen community denominator). Two published effects (pancreatitis, emotional blunting) now have a reporting frequency of 0%, which means no report in the screened population mentioned them, not that they do not occur.

---

All corpus figures printed in this version are a dated snapshot (2026-08-31); the live figures are served at https://magistra.health/api/data?q=overview and https://magistra.health/en/methodology, both of which compute the eligible base at request time.

---

## 1. Introduction

### 1.1 The information gap

Patients beginning treatment with a GLP-1 receptor agonist for obesity or type 2 diabetes face a well-documented information gap. Clinical trial side effect rates are published in randomized controlled trials and summarized in package inserts, but these figures often fail to match patient reports aggregated in online communities. For example, the FDA Wegovy (semaglutide) prescribing information (revised 06/2026, Table 3) reports hair loss in 3% of adults treated with semaglutide 2.4 mg versus 1% on placebo, while Reddit communities such as r/Ozempic host megathreads with hundreds of posts describing telogen effluvium as a common experience. Similarly, "emotional blunting" — a reduction in affective response to pleasurable stimuli — is virtually absent from RCT safety reports but is widely discussed in patient forums (Kolata 2024; anonymous Reddit threads).

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

Raw scraped text is processed by a Claude model (Anthropic; the specific model tier is pinned in the pipeline configuration and validated against production text before any change) via a pre-specified extraction prompt that captures: the side effect mentioned, the drug name (normalized to generic), the extracted incidence rate (if explicitly stated), dose tier (for ClinicalTrials.gov arm rows this field is overwritten at write time by a deterministic derivation from the arm's own label — see "Corrections in v5.11", items 15–16, and "Corrections in v5.12", item 17 — asserting `unspecified` for molecules with no approved maintenance-dose ladder and deferring to the model's value only where a ladder exists but the label states no dose), demographic fields (sex, age range, ethnicity, BMI range), lifestyle fields (exercise level, diet, blood type), sample size (if reported), and an extraction confidence label (high / medium / low).

The extraction is deliberately conservative, and since 2026-09-05 this is enforced rather than only requested: the prompt specifies that rates must be explicitly stated in the source text and never inferred, and a write-time gate (`agents/data/src/lib/rate-gate.mjs`, called unconditionally from both extraction loops, with no source-type branch) independently checks the model's output against the fetched text — a rate whose percentage form does not appear in that text at a number boundary, or which equals the midpoint of a stated "A to B%" range, is nulled and recorded as `rateWithheld` rather than stored. An accepted rate carries the sentence it was read from (`rateEvidence`), so it can be re-audited later without a refetch. See "Corrections in v5.13", items 19–20; rows written before the gate shipped were screened against the same rule retrospectively. Items with no extractable rate are stored with `extractedRate = null` and contribute only to qualitative analysis. Confidence labels are used downstream as multiplicative weights (high = 1.0, medium = 0.7, low = 0.3) on sample-size-based weighting.

Deduplication is performed on the composite key (sourceUrl, sideEffect), extended for ClinicalTrials.gov registry rows to also include the arm label extracted from the row's own excerpt, so that a trial's separate dosing arms are not collapsed into one (see "Corrections in v5.10", item 13, and "Corrections in v5.12", item 18); every other source produces the pre-extension key unchanged. The extraction prompt is versioned and any change triggers re-extraction of a sample for validation (planned; not yet implemented).

### 2.3 Dual-track estimation

For a target patient profile P and side effect e, the system produces two parallel signals.

**Rate eligibility (applied before either track).** A rate-bearing data point may support a published estimate only if: (i) its source URL is a citable external origin — points whose provenance is our own site, the April-2026 seeding pass (any URL — see "Corrections in v5.3"), a synthetic aggregate ("Aggregated user reports"), or a search-aggregator result page are retained and labelled but excluded from every public total and estimate; (ii) it is not a spontaneous-report *share* (e.g. the share of FAERS adverse-event reports mentioning an effect), which is a different quantity from incidence and is kept as a separate labelled signal, never averaged into a rate; (iii) it is that source's single entry for the effect — a paper contributing several rates collapses to one entry per distinct source, so one publication cannot masquerade as multiple independent observations; (iv) sample sizes extracted from social posts are ignored for weighting; and (v) the rate is stated verbatim in the source's own text — enforced at write time since 2026-09-05 by the gate described in §2.2, and applied retrospectively to the pre-gate corpus (see "Corrections in v5.13", item 19). Rule (v) binds both tracks: a community post that states no percentage states no rate, whatever the extraction returns. As of 2026-08-31 these rules admit 74 rates from 51 distinct sources out of 311 rate-bearing points — 71 from 50 as restated in "Corrections in v5.9" — (v5.1–v5.2 printed 145/67; the difference is the April-2026 seed rows excluded in "Corrections in v5.3"); effects whose eligible base is empty publish a clearly-labelled static figure from named published trials instead of a computed estimate.

**Track C (Clinical).** Let D_C(P, e) be the set of eligible data points with sideEffect = e, sourceType ∈ {clinical, regulatory}, and profile filters (sex, dose, ethnicity, exercise) matching P or marked "unspecified". The clinical estimate is computed as:

1. Weighted mean rate, with weights w_i = max(1, n_i) · q_i where n_i is the reported sample size and q_i is the extraction confidence weight.
2. Winsorization at the 5th/95th percentile when |D_C| > 10.
3. Dose adjustment applied when fewer than half of the eligible points carry a dose tag (majority-of-points threshold since 2026-08-28; before that, only when no point did): the weighted mean is scaled by the ratio of the target-tier entry to the medium-tier entry of the static reference table (see §4 on that table's provenance).
4. Log-odds transformation; addition of applicable modifier log-odds (sex, age ≥ 65, GI history, diabetes, first month of treatment); inverse transformation back to probability.
5. Cumulative modifier shift is capped at |ΣΔlogOdds| ≤ 2.5 to prevent implausible stacking.
6. Random-effects 95% confidence interval on the log-odds scale using a simplified, unweighted τ² estimator (inspired by DerSimonian-Laird [ref 8], not inverse-variance weighted) and delta-method standard error.

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
- **Between-study heterogeneity (τ²):** simplified, unweighted estimator on individual study rates (inspired by DerSimonian-Laird [ref 8]; does not use inverse-variance weights)
- **Total variance:** v = p(1-p)/N + τ²
- **SE on log-odds scale:** SE_logit = √v / (p(1-p))
- **95% CI:** [logit⁻¹(logit(p) - 1.96·SE_logit), logit⁻¹(logit(p) + 1.96·SE_logit)]

When k = 1 (only one study contributes), τ² is set to 0 and the interval reflects sampling variance only. This is flagged as "low confidence" regardless of the nominal N.

**Profile-adjusted estimates (added v5.4).** When the displayed rate is a profile-adjusted p_adjusted (§2.4) or a dose-tier rescale of the pooled rate, v and SE_logit are evaluated at the pooled rate p — the value the contributing study rates are dispersed around — and the resulting logit-scale half-width 1.96·SE_logit is applied symmetrically around logit(p_adjusted). The interval's width is therefore a property of the evidence and identical for every profile; only its centre moves with the profile. Through v5.3 the implementation evaluated v and SE_logit at p_adjusted instead — see "Corrections in v5.4".

### 2.6 Self-evolving parameter updates

A daily analysis pipeline computes empirical odds ratios for every (parameter dimension × effect) combination using the current data pool. For each test, the pipeline computes the log-odds ratio between the two groups (e.g., female vs male; age ≥ 65 vs < 65), its standard error via the delta method, and a two-sided z-test p-value.

Because this creates a multiple-testing problem, the full p-value battery from each run is adjusted using the Benjamini-Hochberg procedure to control the false discovery rate at q = 0.05. The number of tests per run is the number of (dimension × effect) cells with enough eligible evidence in both comparison groups; the daily logs from 2026-04-13 to 2026-09-07 record between 0 and 15 tests per run (5 on 2026-09-07). Through v5.6 this sentence said "~180-240 tests per run", a figure no logged run has approached — see "Corrections in v5.7".

Decision logic (using FDR-adjusted p-values):

| Condition | Action |
|---|---|
| N ≥ 30, p_adj ≤ 0.01, |Δ OR| ≤ 0.3 from current | Auto-apply; update config |
| N ≥ 20, p_adj ≤ 0.05, |Δ OR| > 0.3 | Flag for human review |
| New parameter: N ≥ 30, significant for ≥ 2 effects | Promote from "candidate" to "active"; flag for review |

Additional sanity checks are applied before any change is committed: odds ratios must lie in [0.1, 5.0] (an auto-applied change that would leave a modifier outside that range is reverted), and the total number of auto-applied changes per day is capped at 5, with the excess moved to the review queue. (Through v5.6 this sentence also said that base rates must lie in [0.01, 0.70]; no such check exists in the code and the claim is withdrawn — see "Corrections in v5.7".)

Every applied or flagged change increments the configuration version and archives the outgoing configuration, one file per version, before the new one is written; the archive has no retention cap, and the in-config changelog keeps its last 30 entries. No run has yet applied or flagged a change, so no archived version exists. (Through v5.6 this paragraph said "the previous 30 versions are retained for rollback" and that canonical patient profiles are re-evaluated against each new configuration with a regression alert on any shift above 20 percentage points; the first misread the changelog cap as a retention count, and no such regression test exists in the pipeline — both are withdrawn, see "Corrections in v5.7".)

### 2.7 Implementation

The system runs on Node.js with a Next.js frontend and Vercel KV for persistence. The full pipeline (collection → extraction → analysis → config update → sync) executes once daily on a single machine. The statistical code is implemented in plain JavaScript without external dependencies beyond the standard normal CDF approximation (Abramowitz-Stegun).

---

## 3. Results

### 3.1 Current database state

As of 2026-08-31 the corpus holds 1,482 collected data points, of which 1,332 are published (150 April-2026 seed points without a genuinely extracted origin are retained, labelled, and excluded from all public totals — see "Corrections in v5.3"), across 9 drug variants. Fifteen curated side effects are tracked publicly; extraction has produced 31 distinct effect labels in total. The published source mix is 233 clinical, 80 regulatory, 764 user reports, and 255 news. Of the 311 rate-bearing points, 74 rates from 51 distinct sources are eligible to support a published estimate (§2.3); 5 of the 15 published effects (pancreatitis, fatigue, hair loss, dizziness, emotional blunting) have no eligible clinical rate and publish a labelled static figure instead (as of 2026-09-04, quoted from the FDA Wegovy prescribing information for four of them and withdrawn for the fifth — see "Corrections in v5.5").

The model health status is "degraded" per the automated review, reflecting insufficient eligible data volume per effect.

### 3.2 Current evidentiary base per effect

Table 2 shows, for the effects with the strongest eligible clinical bases, the number of eligible clinical rates and distinct sources, the resulting confidence grade, and the community reporting frequency (share of the 26 screened distinct community reports mentioning the effect). The computed incidence estimates themselves — weighted means with modifier adjustments and random-effects intervals — are served live by the predictor and public API rather than frozen into this document, since they change as the corpus grows.

**Table 2.** Eligible evidentiary base and community reporting frequency (snapshot 2026-08-31, verified against https://magistra.health/api/data?q=effects; the smaller bases vs. earlier versions reflect the seed-row exclusion in "Corrections in v5.3").

| Side effect | Eligible clinical rates (distinct sources) | Confidence | Reporting frequency (of 26 screened reports) |
|---|---|---|---|
| Nausea | 29 (19) | high | 38.5% (10/26) |
| Diarrhoea | 9 (5) | moderate | 34.6% (9/26) |
| Constipation | 9 (6) | moderate | 26.9% (7/26) |
| Reduced appetite | 9 (8) | moderate | 30.8% (8/26) |
| Vomiting | 6 (6) | moderate | 42.3% (11/26) |
| Headache | 5 (4) | moderate | 3.8% (1/26) |
| Hair loss (alopecia) | 0 — literature fallback | — | 3.8% (1/26) |

*Restated 2026-09-08 (see "Corrections in v5.9"): the nausea, reduced-appetite and vomiting rows each include one rate from Nature s41586-026-10330-z that the paper does not state, withheld on 2026-09-08. Over the same 2026-08-31 snapshot those rows read 28 (18), 8 (7) and 5 (5); the other rows and both right-hand columns are unaffected. The left-hand column is a snapshot, not a live figure — the current counts are at `?q=effects`.*

The two right-hand columns are different quantities and are not comparable to each other (§2.3). The table's purpose is transparency about what each published estimate rests on: nausea's estimate draws on 28 independent clinical rates from 18 distinct sources (29 from 19 before the withdrawal in "Corrections in v5.9") — more than any other tracked effect — while hair loss, the effect whose apparent clinical-vs-community gap motivated much of v4.0's framing, now has no eligible clinical rate at all: the 3 rates from a single source that v5.1–v5.2 printed for it were April-2026 seed rows ("Corrections in v5.3"), so it publishes a clearly-labelled static literature figure instead. The right-hand column's denominator is 26, so each individual report shifts a reporting frequency by 3.8 percentage points; the column is printed with its numerator for that reason.

### 3.3 Convergence hypothesis (withdrawn)

v4.0 hypothesized that the clinical and real-world tracks would converge for mainstream GI side effects as clinical data volume grew. This hypothesis is withdrawn as unmeasurable in the framework's corrected form: the community track is a reporting frequency, not an incidence estimate, so "convergence" between the tracks is a comparison between two different quantities and has no defined meaning. What can be tracked instead — and is, via the live API — is the growth and confidence grading of each track's own evidentiary base.

---

## 4. Limitations

We enumerate limitations explicitly because hidden weaknesses are more dangerous than visible ones.

**Data volume.** Although the corpus held 1,482 collected points as of 2026-08-31, the eligible base behind published estimates is far smaller (74 rates across all effects, same date — 51 source entries counted one per source per effect, which is 23 distinct studies by URL; see "Corrections in v5.8"), and below the threshold for robust inference on most effects — 5 of the 15 published effects have no eligible clinical rate at all, and four more (abdominal pain, acid reflux, gallstones, injection-site reaction) rest on a single distinct source each. Model health is classified as "degraded" until the eligible base per effect grows substantially. Reported confidence intervals should be interpreted accordingly.

**Frozen community denominator, and it is small.** Reddit — the largest community source — has served the collector an HTTP 403 block page since 2026-05-28. After the 2026-08-29 topical screen ("Corrections in v5.1") the community corpus is **26 distinct reports**, and it is frozen at that size until a different access route exists. Every published reporting frequency is therefore a fixed number cited with its as-of date, not a continuously updated statistic, and at n=26 a single report moves any share by 3.8 percentage points — the Wilson intervals are correspondingly wide and should be read, not just the point estimate. This is the framework's weakest published quantity.

**Demographic bias.** Both the clinical and community data sources over-represent female, white, and Western populations. Candidate parameters for ethnicity and BMI are tracked but lack sufficient data for inclusion. The system explicitly flags this as a limitation on every prediction.

**Hand-coded modifiers.** The initial modifier values (female factor, age 65+ factor, etc.) are drawn from published clinical literature and applied uniformly across trials. These are provisional and are being replaced empirically as data accumulates. The model config tracks each modifier's provenance as either "clinical_literature" (hand-coded) or "empirical" (derived from data).

**No interaction terms.** Modifiers are applied additively on the log-odds scale, ignoring potential interactions (e.g., female × age ≥ 65). The cumulative cap at |ΣΔlogOdds| ≤ 2.5 is a partial mitigation but does not substitute for proper interaction modeling.

**No formal calibration — currently unmeasurable.** The system has not been validated against independent outcome data, and applying the rate-eligibility rules (§2.3) leaves no effect with enough eligible rates to fit the logistic calibration model v4.0 described. The honest statement is "calibration cannot currently be measured; here is the n per effect" — not a calibration statistic computed on an ineligible base. A held-out validation remains planned for when the eligible base permits it.

**LLM extraction accuracy.** A Claude model is used for structured extraction but has not been audited against human gold-standard labels on a representative sample. An audit of 50 sources per effect is planned. Until completed, reported sample sizes should be treated as noisy upper bounds.

**Selection bias in community data.** Patient communities over-report severe or unusual experiences; the reporting-frequency track inherits this bias — a mention share measures what a self-selected population chooses to write about, not what a cohort experiences. We do not attempt to correct for it beyond labelling the quantity for what it is and separating the two tracks so the user can see both.

**Dose-tier rescale conflates dose-response with study-population differences (added v5.6).** When fewer than half of an effect's pooled clinical points carry a dose tag, the predictor rescales the pooled corpus rate by the ratio of two entries in the static per-tier reference table (§2.3's literature fallback figures) for the requested tier versus the medium tier, rather than leaving the pooled rate untouched. For the ten tracked effects whose static triples carry a low/medium/high gradient (ratios of 0.42–0.75 for the low tier and 1.17–1.73 for the high tier, relative to medium), no per-tier derivation is recorded anywhere: the triples date from the tool's first commit (6 April 2026) and each effect's listed sources are study-level references, none per dose tier, so the ratio's provenance cannot be checked. The four effects re-sourced from the FDA Wegovy label in September 2026 carry one figure at every tier, so no rescale fires for them. Figures of unrecorded origin cannot be assumed to come from a single dose-ranging study isolated from population, sample-size and follow-up differences. Applying their ratio to a corpus rate pooled from a *different* mix of studies therefore mixes a dose effect with a study-design effect; the two are not separated anywhere in the pipeline. Each affected live estimate discloses that it was rescaled, the pooled-to-rescaled values, and the dose-tag coverage in its basis string (`doseNote`, added 2026-08-28) — so a reader checking one specific number already sees the adjustment — but this document did not previously name the rescale as a limitation, and no sensitivity analysis exists beyond a point check: on 2026-09-05, against production with no patient modifiers, every gradient effect's low- and high-tier estimate differed from its pooled rate by exactly the static ratio (nausea: pooled 32% → 18% low / 46% high, with 14 of 90 pooled records dose-tagged). Flagged by the framework's own daily automated peer review (2026-09-05).

**Titrate-to-target trial arms are mixed-dose quantities (added v5.11).** Several tracked registry arms do not hold participants at one dose: they titrate toward a target "or MTD" (maximum tolerated dose), so the arm's reported adverse-event rate is pooled over participants sitting at different doses. NCT04255433 states its tirzepatide arm reached "a maximum of 15 mg QW or MTD tolerated by the participant (5 mg QW or 10 mg QW)"; NCT05564039's two arms titrated "until 15 mg or MTD was reached" and "until 4.5 mg or MTD was reached". Neither registry publishes the distribution of achieved doses, so the rate cannot be attributed to a dose tier, and this framework records such arms as dose-unspecified — meaning the point contributes to every tier's pooled estimate rather than to one. The consequence is conservative in one direction and not in another: it prevents a mixed-dose rate from being published as a high-dose rate, but it also means a tier's pool can contain rates from participants who never reached that tier. Disaggregating them would require per-participant dose data that adverse-event summary tables do not carry. Until v5.11 seven such rows were tagged `high` and were therefore counted into the high-tier pool and excluded from the low and medium pools (see "Corrections in v5.11", item 16).

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

The FDR-corrected parameter update pipeline provides a principled mechanism for model evolution without requiring a human in the loop for every update. Safeguards (threshold gating, the odds-ratio bound, the daily auto-apply cap, a human review queue for larger changes, and per-version archiving of the outgoing configuration) are designed to make this safe. In practice every run to date has auto-applied and flagged zero changes, because the data volume is insufficient to meet the thresholds (0 to 15 tests per run in the daily logs from 2026-04-13 to 2026-09-07); this is a feature, not a bug. (Through v5.6 this list also named "canonical profile regression testing", which does not exist in the pipeline — see "Corrections in v5.7".)

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
