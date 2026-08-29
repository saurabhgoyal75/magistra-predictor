# API Examples

The Magistra public API is free and requires no authentication. All endpoints return JSON.

Base URL: `https://magistra.health/api`

---

## 1. Discovery — find out what's available

```bash
curl https://magistra.health/api/data?q=help
```

Returns a complete API specification including every endpoint, parameter, and example. If you're an AI agent or LLM discovering this API for the first time, start here.

---

## 2. Database overview

```bash
curl https://magistra.health/api/data?q=overview
```

Returns:
- Total data points and last scraped timestamp
- The evidentiary base behind published rates (`evidentiaryBase`): how many
  corpus points state a rate, how many survive the eligibility rules, and how
  many distinct sources those collapse to — this, not the corpus size, is what
  any published estimate rests on
- Effects tracked (currently 15) with clinical rates
- Drugs covered (9 variants)
- Data sources, each with its point count and last-seen date
- Trials cited — 6 as of 2026-08-28: STEP-1 (NEJM 2021), STEP-2 (Lancet 2021),
  STEP-3 (JAMA 2021), SURMOUNT-1 (NEJM 2022), SURMOUNT-5 (NEJM 2025), SELECT
  (NEJM 2023). Call the endpoint for the current list rather than trusting this
  one; earlier versions of this file also listed STEP-4, STEP-5 and SUSTAIN-6,
  which are not cited by the system and have been removed.
- Citation format and licence

---

## 3. Single effect detail

```bash
curl "https://magistra.health/api/data?q=effect&id=nausea"
```

Available effect IDs:

| ID | Name | Severity |
|---|---|---|
| `nausea` | Nausea | mild |
| `diarrhea` | Diarrhoea | mild |
| `constipation` | Constipation | mild |
| `reduced_appetite` | Reduced appetite | mild |
| `headache` | Headache | mild |
| `pancreatitis` | Pancreatitis (rare) | severe |
| `fatigue` | Fatigue / Low energy | mild |
| `vomiting` | Vomiting | moderate |
| `abdominal_pain` | Abdominal pain | moderate |
| `acid_reflux` | Acid reflux (GERD) | mild |
| `gallstones` | Gallstones (cholelithiasis) | severe |
| `hair_loss` | Hair loss (thinning) | mild |
| `injection_site_reaction` | Injection site reaction | mild |
| `dizziness` | Dizziness | mild |
| `emotional_blunting` | Emotional blunting / Reduced pleasure | moderate |

---

## 4. All effects list

```bash
curl https://magistra.health/api/data?q=effects
```

Returns an array of all effects, each with: the static literature `clinicalRates`
(low/medium/high dose); `corpusClinical`, the pooled corpus-derived clinical
estimate with the stated-rate and distinct-source counts behind it (absent for
the 2 effects with no eligible clinical rate); `reportingFrequency`, the share of
distinct community reports mentioning the effect, with its denominator and
platforms; plus onset, duration, and management tips. There is no
"user-reported rate" field — averaging self-reported percentages from forum
posts was withdrawn in v5.0 and replaced by the reporting frequency.

---

## 5. Dual-track side effect prediction

```bash
curl -X POST https://magistra.health/api/predictor/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "molecule": "tirzepatide",
    "doseMg": 10.0,
    "doseTier": "medium",
    "sex": "female",
    "age": 42,
    "hasGiHistory": false,
    "hasDiabetes": true,
    "isFirstMonth": false
  }'
```

Returns an array of effects, each with TWO parallel figures. Abridged live
response to exactly the request above, captured from production on 2026-08-29
(`attribution`, `sources` and the Dutch `*Nl` strings elided for length):

```json
{
  "results": [
    {
      "effectId": "nausea",
      "effectName": "Nausea",
      "severity": "mild",
      "clinical": {
        "percentage": 33,
        "confidenceInterval": { "low": 7, "high": 76 },
        "confidenceLevel": "high",
        "dataPointCount": 70,
        "ratePointCount": 26,
        "rateSourceCount": 18,
        "basis": "26 stated rates from 18 distinct sources (of 70 clinical/regulatory records). Base rate 32% → 33% after profile adjustment (sex:female ×1.25, hasDiabetes ×0.85) — odds ratios hand-coded at the 2026-04-12 seed with no per-modifier citation recorded, not derived from this corpus",
        "isFallback": false
      },
      "realWorld": {
        "percentage": 38,
        "confidenceInterval": { "low": 22, "high": 57 },
        "confidenceLevel": "high",
        "dataPointCount": 10,
        "ratePointCount": 10,
        "rateSourceCount": 10,
        "basis": "10 of 26 distinct community reports (reddit.com, drugs.com) mention nausea — reporting frequency, not a measured incidence rate",
        "isFallback": false
      },
      "attribution": { ... },
      "sources": [ ... ]
    }
  ]
}
```

**Key interpretation — read this before using both numbers.** `clinical` and
`realWorld` are computed from disjoint data streams and are never averaged or
blended. They are also **not the same kind of quantity, and must not be
compared or subtracted**: `clinical` is an incidence estimate (of people
treated, how many experienced the effect); `realWorld` is a *reporting
frequency* (of distinct community reports, what share mention the effect).
Through v4.0 this file described the difference between them as "the signal"
and read a large gap as evidence of under-measurement in trials — that
interpretation is **withdrawn**, because the subtraction has no defined
meaning. Each figure is informative on its own terms, and every response
states the n and source count behind it so you can judge either one. The
`realWorld` field name is retained for backward compatibility; its `basis`
string, not its name, describes what it measures.

---

## 6. Weight loss journey prediction

```bash
curl -X POST https://magistra.health/api/predictor/journey \
  -H "Content-Type: application/json" \
  -d '{
    "sex": "female",
    "age": 42,
    "startingWeightKg": 95,
    "heightCm": 168,
    "doseTier": "medium",
    "hasDiabetes": true,
    "exerciseLevel": "moderate",
    "resistanceTraining": true,
    "proteinIntakeG": 100
  }'
```

Returns three predictions:
- **weightTrajectory**: 68-week expected weight loss curve
- **muscleRisk**: lean mass loss risk score and protein target
- **discontinuation**: expected regain trajectory if medication is stopped

All three are grounded in STEP trial data (Wilding 2021, Davies 2021, Jastreboff 2022, etc.) with expert-coded modifiers for exercise, protein, resistance training, and demographics. These modifiers are NOT yet empirically validated — see limitations.

---

## 7. Model review (agent health check)

```bash
curl https://magistra.health/api/data/review
```

Returns model health status, calibration metrics, bias reports, and proposed empirical changes. This endpoint is useful for monitoring: it flags when the database is "degraded" (insufficient data) and shows empirical modifier estimates from the daily analysis pipeline.

---

## 8. Node.js example

```javascript
// fetch-predictor.js
const profile = {
  molecule: 'semaglutide',
  doseMg: 1.0,
  doseTier: 'medium',
  sex: 'female',
  age: 35,
  hasGiHistory: false,
  hasDiabetes: false,
  isFirstMonth: true,
};

const res = await fetch('https://magistra.health/api/predictor/calculate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(profile),
});

const data = await res.json();

console.log('\nTwo tracks for:', profile.molecule, profile.doseMg + 'mg');
console.log('\u2500'.repeat(78));

for (const r of data.results.slice(0, 5)) {
  // Never subtract these two: one is an incidence estimate, the other a
  // reporting frequency. Print each with the n behind it instead.
  console.log(r.effectName);
  console.log(`  clinical incidence     ${String(r.clinical.percentage).padStart(3)}%  ` +
    `(${r.clinical.ratePointCount} rates / ${r.clinical.rateSourceCount} sources` +
    `${r.clinical.isFallback ? ', literature fallback' : ''})`);
  console.log(`  community reporting    ${String(r.realWorld.percentage).padStart(3)}%  ` +
    `(${r.realWorld.basis})`);
}
```

Actual output, run against production on 2026-08-29 (top 5 effects only):

```
Two tracks for: semaglutide 1mg
───────────────────────────────────────────────────────────────────────────
Nausea
  clinical incidence      60%  (26 rates / 18 sources)
  community reporting     38%  (10 of 26 distinct community reports (reddit.com, drugs.com) mention nausea — reporting frequency, not a measured incidence rate)
Vomiting
  clinical incidence      22%  (8 rates / 8 sources)
  community reporting     42%  (11 of 26 distinct community reports (reddit.com, drugs.com) mention vomiting — reporting frequency, not a measured incidence rate)
Diarrhoea
  clinical incidence      34%  (6 rates / 5 sources)
  community reporting     35%  (9 of 26 distinct community reports (reddit.com, drugs.com) mention diarrhoea — reporting frequency, not a measured incidence rate)
Constipation
  clinical incidence      35%  (9 rates / 6 sources)
  community reporting     27%  (7 of 26 distinct community reports (reddit.com, drugs.com) mention constipation — reporting frequency, not a measured incidence rate)
Headache
  clinical incidence      35%  (5 rates / 4 sources)
  community reporting      4%  (1 of 26 distinct community reports (reddit.com, drugs.com) mention headache — reporting frequency, not a measured incidence rate)
```

> **These are model outputs for one profile, not measurements — do not quote
> them as population rates.** The clinical figure is a corpus-pooled base rate
> adjusted by profile modifiers whose odds ratios are hand-coded, not derived
> from this corpus; several effects rest on a handful of distinct sources
> (headache: 4). The community figure is a reporting frequency over just 26
> distinct reports — on 2026-08-29 that denominator fell from 185 after we found
> a failed subreddit restriction had let 159 off-topic posts into the pool
> (see "Corrections in v5.1" in the preprint) — so a single report moves any
> share by 3.8 percentage points. The denominator is a fixed historical number
> rather than a live one: Reddit blocked our collector on 2026-05-28, and the
> other platform (Drugs.com) was last collected 2026-08-12. Cite it with a date.
> Earlier versions of this example printed a "gap Npp" column subtracting one
> from the other; that computation is withdrawn and has been removed from the
> sample code, because the two are different quantities. For the citable
> evidentiary base behind any effect, call `/api/data?q=effect&id=<effect>` and
> read the `rateBase` block: stated-rate count, distinct-source count, source
> URLs, and per-reason exclusions.

---

## 9. Rate limiting

No hard rate limits, but please be reasonable. The API runs on a hobby-tier deployment and large bursts may be throttled. For bulk research access, contact saurabh@magistra.health.

---

## 10. Citation

If you use this data in research or content:

```
Magistra Health. GLP-1 Safety & Efficacy Database.
https://magistra.health. Accessed [date].
```

BibTeX in [`CITATION.cff`](../CITATION.cff).
