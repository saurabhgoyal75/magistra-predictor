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
- Effects tracked (currently 15) with clinical rates
- Drugs covered (9 variants)
- Data sources
- Trials cited (STEP-1 through STEP-5, SURMOUNT-1/5, SELECT, SUSTAIN-6)
- Citation format

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
| `pancreatitis` | Pancreatitis | severe |
| `fatigue` | Fatigue / Low energy | mild |
| `vomiting` | Vomiting | moderate |
| `abdominal_pain` | Abdominal pain | moderate |
| `acid_reflux` | Acid reflux / GERD | mild |
| `gallstones` | Gallstones | severe |
| `hair_loss` | Hair loss | mild |
| `injection_site_reaction` | Injection site reaction | mild |
| `dizziness` | Dizziness | mild |
| `emotional_blunting` | Emotional blunting | moderate |

---

## 4. All effects list

```bash
curl https://magistra.health/api/data?q=effects
```

Returns an array of all effects with clinical rates (low/medium/high dose), user-reported rates, onset, duration, and management tips.

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

Returns an array of effects, each with TWO parallel estimates:

```json
{
  "results": [
    {
      "effectId": "nausea",
      "effectName": "Nausea",
      "severity": "mild",
      "clinical": {
        "percentage": 22,
        "confidenceInterval": { "low": 16, "high": 29 },
        "confidenceLevel": "moderate",
        "dataPointCount": 15,
        "basis": "15 clinical studies and regulatory reports",
        "isFallback": false
      },
      "realWorld": {
        "percentage": 41,
        "confidenceInterval": { "low": 28, "high": 54 },
        "confidenceLevel": "moderate",
        "dataPointCount": 21,
        "basis": "21 community reports (Reddit, forums, patient experiences, news)",
        "isFallback": false
      },
      "attribution": { ... },
      "sources": [ ... ]
    }
  ]
}
```

**Key interpretation:** The `clinical` and `realWorld` fields are computed from disjoint data streams. They are NOT averaged or blended. The gap between them is the signal — a large gap suggests the effect is either under-measured in trials or over-reported in communities (usually both).

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
import fetch from 'node-fetch';

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

console.log('\nDual-track predictions for:', profile);
console.log('─'.repeat(70));

for (const r of data.results) {
  const clin = r.clinical.percentage;
  const rw = r.realWorld.percentage;
  const gap = Math.abs(clin - rw);
  const arrow = rw > clin ? '↑' : rw < clin ? '↓' : '=';
  console.log(
    `${r.effectName.padEnd(30)} clinical=${clin.toString().padStart(3)}%  ${arrow}  real-world=${rw.toString().padStart(3)}%  (gap ${gap}pp)`
  );
}
```

Output:

```
Dual-track predictions for: { molecule: 'semaglutide', doseMg: 1.0, ... }
──────────────────────────────────────────────────────────────────────
Nausea                         clinical= 28%  ↑  real-world= 49%  (gap 21pp)
Diarrhoea                      clinical= 11%  ↑  real-world= 31%  (gap 20pp)
Reduced appetite               clinical= 11%  ↑  real-world= 24%  (gap 13pp)
Headache                       clinical=  7%  ↑  real-world= 21%  (gap 14pp)
Constipation                   clinical=  6%  ↑  real-world= 17%  (gap 11pp)
...
```

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
