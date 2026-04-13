#!/usr/bin/env node
// Model Analysis Engine — runs daily after data collection
// Computes empirical modifiers, discovers new parameters, updates model config
//
// Usage: node agents/data/src/analyze-model.mjs [--dry-run]

import fs from "fs";
import path from "path";

// Configure paths via environment variables or adapt to your project structure.
// The reference implementation reads from local JSON files; production uses Vercel KV.
const DATA_DIR = process.env.MAGISTRA_DATA_DIR || "./data";
const CONFIG_PATH = path.join(DATA_DIR, "model-config.json");
const HISTORY_DIR = path.join(DATA_DIR, "model-config-history");
const PENDING_PATH = path.join(DATA_DIR, "pending-model-changes.json");
const DB_PATH = path.join(DATA_DIR, "side-effects-db.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ── Statistical helpers ──

function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function pValueFromZ(z) {
  return 2 * (1 - normalCDF(Math.abs(z)));
}

function weightedMean(values, weights) {
  let sumWV = 0, sumW = 0;
  for (let i = 0; i < values.length; i++) {
    if (weights[i] > 0) { sumWV += values[i] * weights[i]; sumW += weights[i]; }
  }
  return sumW > 0 ? sumWV / sumW : null;
}

function confidenceWeight(conf) {
  return conf === "high" ? 1.0 : conf === "medium" ? 0.7 : 0.3;
}

// ── Core analysis functions ──

/**
 * Compute empirical odds ratio for a binary split of data points
 * Group1 = data points matching the condition, Group0 = not matching
 */
function computeOddsRatio(group1Rates, group1Weights, group0Rates, group0Weights) {
  if (group1Rates.length < 3 || group0Rates.length < 3) return null;

  const rate1 = weightedMean(group1Rates, group1Weights);
  const rate0 = weightedMean(group0Rates, group0Weights);
  if (rate1 === null || rate0 === null) return null;

  // Clamp to avoid log(0) or division by zero
  const r1 = Math.max(0.001, Math.min(0.999, rate1));
  const r0 = Math.max(0.001, Math.min(0.999, rate0));

  const logOdds1 = Math.log(r1 / (1 - r1));
  const logOdds0 = Math.log(r0 / (1 - r0));
  const coefficient = logOdds1 - logOdds0;
  const oddsRatio = Math.exp(coefficient);

  // Delta method SE
  const n1 = group1Rates.length;
  const n0 = group0Rates.length;
  const se = Math.sqrt(1 / (n1 * r1 * (1 - r1)) + 1 / (n0 * r0 * (1 - r0)));
  const z = coefficient / se;
  const pValue = pValueFromZ(z);

  return { coefficient: Math.round(coefficient * 1000) / 1000, oddsRatio: Math.round(oddsRatio * 1000) / 1000, se, pValue: Math.round(pValue * 10000) / 10000, n: n1 + n0, n1, n0 };
}

/**
 * Split data points by a dimension and compute OR for each effect
 */
function analyzeParameterForEffect(points, effectId, splitFn) {
  const effectPoints = points.filter(p => p.sideEffect === effectId && p.extractedRate !== null && p.extractedRate >= 0 && p.extractedRate <= 1);

  const group1 = [], group1W = [], group0 = [], group0W = [];

  for (const p of effectPoints) {
    const split = splitFn(p);
    if (split === null) continue; // skip "unspecified"
    const w = (p.extractedSampleSize || 1) * confidenceWeight(p.extractionConfidence);
    if (split) { group1.push(p.extractedRate); group1W.push(w); }
    else { group0.push(p.extractedRate); group0W.push(w); }
  }

  return computeOddsRatio(group1, group1W, group0, group0W);
}

// ── Parameter dimension definitions ──
// Each defines how to split data points into binary groups

const DIMENSIONS = [
  {
    id: "sex:female",
    paramId: "sex",
    label: "Female sex",
    split: (p) => {
      const sex = p.extractedDemographics?.sex;
      if (!sex || sex === "unspecified") return null;
      return sex === "female";
    },
  },
  {
    id: "age:65plus",
    paramId: "age",
    label: "Age 65+",
    split: (p) => {
      const age = p.extractedDemographics?.ageRange;
      if (!age) return null;
      // Parse age ranges like "65+", "60-70", "65-75"
      const nums = age.match(/\d+/g);
      if (!nums || nums.length === 0) return null;
      const maxAge = parseInt(nums[nums.length - 1]);
      if (age.includes("+") && parseInt(nums[0]) >= 65) return true;
      return maxAge >= 65;
    },
  },
  {
    id: "hasGiHistory",
    paramId: "hasGiHistory",
    label: "GI history",
    split: (p) => {
      // GI history is rarely directly in data — inferred from GI-related sources
      // For now, we can't reliably split on this from scraped data
      return null;
    },
  },
  {
    id: "hasDiabetes",
    paramId: "hasDiabetes",
    label: "Has diabetes",
    split: (p) => {
      // Check if the source text mentions diabetes
      const text = (p.rawExcerpt || "").toLowerCase();
      if (text.includes("type 2 diabetes") || text.includes("t2d") || text.includes("diabetic")) return true;
      if (text.includes("non-diabetic") || text.includes("without diabetes")) return false;
      return null;
    },
  },
  {
    id: "isFirstMonth",
    paramId: "isFirstMonth",
    label: "First month",
    split: (p) => {
      const text = (p.rawExcerpt || "").toLowerCase();
      if (text.includes("first month") || text.includes("initial") || text.includes("week 1") || text.includes("first week")) return true;
      if (text.includes("long-term") || text.includes("after 3 months") || text.includes("month 6")) return false;
      return null;
    },
  },
  // ── Candidate dimensions (not yet in UI) ──
  {
    id: "ethnicity:asian",
    paramId: "ethnicity",
    label: "Asian ethnicity",
    split: (p) => {
      const eth = p.extractedDemographics?.ethnicity;
      if (!eth || eth === "unspecified") return null;
      return eth === "asian";
    },
  },
  {
    id: "ethnicity:black",
    paramId: "ethnicity",
    label: "Black ethnicity",
    split: (p) => {
      const eth = p.extractedDemographics?.ethnicity;
      if (!eth || eth === "unspecified") return null;
      return eth === "black";
    },
  },
  {
    id: "exercise:active",
    paramId: "exerciseLevel",
    label: "Active exercise",
    split: (p) => {
      const ex = p.extractedLifestyle?.exerciseLevel;
      if (!ex || ex === "unspecified") return null;
      return ex === "active" || ex === "moderate";
    },
  },
  {
    id: "dose:high",
    paramId: "doseTier",
    label: "High dose",
    split: (p) => {
      const dose = p.extractedDoseTier;
      if (!dose || dose === "unspecified") return null;
      return dose === "high";
    },
  },
];

// ── FDR correction (Benjamini-Hochberg) ──

function applyFDRCorrection(results) {
  // results: array of { pValue, ...rest }
  // Returns same array with adjustedPValue added
  const sorted = results.filter(r => r.pValue !== null).sort((a, b) => a.pValue - b.pValue);
  const m = sorted.length;
  if (m === 0) return results;

  // BH procedure: adjusted_p[i] = min(p[i] * m / rank, 1.0)
  // Then enforce monotonicity from bottom up
  for (let i = 0; i < sorted.length; i++) {
    const rank = i + 1;
    sorted[i]._adjustedP = Math.min(1.0, sorted[i].pValue * m / rank);
  }
  // Enforce monotonicity (adjusted p can't increase as raw p increases)
  for (let i = sorted.length - 2; i >= 0; i--) {
    sorted[i]._adjustedP = Math.min(sorted[i]._adjustedP, sorted[i + 1]._adjustedP);
  }
  // Map back
  const adjustedMap = new Map();
  for (const s of sorted) {
    adjustedMap.set(`${s._dimId}:${s._effectId}`, s._adjustedP);
  }
  return results.map(r => ({
    ...r,
    adjustedPValue: adjustedMap.get(`${r._dimId}:${r._effectId}`) ?? r.pValue,
  }));
}

// ── Main analysis pipeline ──

async function main() {
  console.log(`\n=== Model Analysis Engine ===`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Load data
  if (!fs.existsSync(DB_PATH)) {
    console.log("No data points file found. Skipping analysis.");
    return;
  }
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log("No model config found. Run seed-model-config.mjs first.");
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const points = db.dataPoints || db;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

  console.log(`Data points: ${points.length}`);
  console.log(`Config version: ${config.version}`);
  console.log(`Effects: ${config.effects.length}`);

  // Collect all effect IDs
  const effectIds = config.effects.map(e => e.id);

  // Track changes
  const autoApplied = [];
  const flagged = [];
  const candidateUpdates = {};

  // ── Step A: Compute empirical modifiers for all dimensions x effects ──
  console.log(`\n--- Step A: Empirical modifier analysis ---`);

  // First pass: compute all results for FDR correction
  const allResults = [];
  for (const dim of DIMENSIONS) {
    for (const effectId of effectIds) {
      const result = analyzeParameterForEffect(points, effectId, dim.split);
      if (!result) continue;
      allResults.push({ ...result, _dimId: dim.id, _effectId: effectId, _paramId: dim.paramId });
    }
  }

  // Apply FDR correction across all tests
  const fdrResults = applyFDRCorrection(allResults);
  console.log(`  Total tests: ${fdrResults.length}, FDR-corrected`);

  // Second pass: apply decisions using FDR-adjusted p-values
  for (const r of fdrResults) {
    const dim = DIMENSIONS.find(d => d.id === r._dimId);
    if (!dim) continue;

    const effect = config.effects.find(e => e.id === r._effectId);
    if (!effect) continue;

    const currentModifier = effect.modifiers[r._dimId];
    const currentOR = currentModifier?.oddsRatio ?? 1.0;
    const orChange = Math.abs(r.oddsRatio - currentOR);
    const pAdj = r.adjustedPValue;

    console.log(`  ${r._dimId} → ${r._effectId}: OR=${r.oddsRatio} (raw p=${r.pValue}, adj p=${pAdj.toFixed(4)}, n=${r.n}) | delta=${orChange.toFixed(3)}`);

    // Track candidate parameter stats (using FDR-adjusted p-value)
    if (r._paramId) {
      candidateUpdates[r._paramId] = candidateUpdates[r._paramId] || { totalN: 0, significantEffects: new Set() };
      candidateUpdates[r._paramId].totalN = Math.max(candidateUpdates[r._paramId].totalN, r.n);
      if (pAdj < 0.05) candidateUpdates[r._paramId].significantEffects.add(r._effectId);
    }

    // Decision logic — using FDR-adjusted p-values
    const { autoApplyModifier, flagForReview } = config.thresholds;

    if (r.n >= autoApplyModifier.minN && pAdj <= autoApplyModifier.maxPValue && orChange <= autoApplyModifier.maxOddsRatioChange) {
      autoApplied.push({
        type: "modifier_updated",
        effect: r._effectId,
        modifier: r._dimId,
        from: currentOR,
        to: r.oddsRatio,
        reason: `Empirical OR=${r.oddsRatio} (adj p=${pAdj.toFixed(4)}, n=${r.n}) — auto-applied (FDR-corrected)`,
      });

      if (!DRY_RUN) {
        effect.modifiers[r._dimId] = {
          logOdds: r.coefficient,
          oddsRatio: r.oddsRatio,
          pValue: pAdj,
          n: r.n,
          source: "empirical",
          lastUpdated: new Date().toISOString().split("T")[0],
        };
      }
    } else if (r.n >= flagForReview.minN && pAdj <= flagForReview.maxPValue && orChange > autoApplyModifier.maxOddsRatioChange) {
      flagged.push({
        type: "modifier_updated",
        effect: r._effectId,
        modifier: r._dimId,
        from: currentOR,
        to: r.oddsRatio,
        reason: `Empirical OR=${r.oddsRatio} (adj p=${pAdj.toFixed(4)}, n=${r.n}) — flagged (significant change, delta=${orChange.toFixed(3)})`,
      });
    }
  }

  // ── Step B: Update candidate parameters ──
  console.log(`\n--- Step B: Candidate parameter discovery ---`);

  for (const candidate of config.candidateParameters) {
    const update = candidateUpdates[candidate.id];
    if (update) {
      candidate.currentN = update.totalN;
      candidate.significantEffects = [...update.significantEffects];

      // Check for promotion
      const { promoteParameter } = config.thresholds;
      if (candidate.currentN >= promoteParameter.minN && candidate.significantEffects.length >= promoteParameter.minSignificantEffects) {
        console.log(`  PROMOTE: ${candidate.id} — n=${candidate.currentN}, significant for ${candidate.significantEffects.length} effects`);
        flagged.push({
          type: "parameter_promoted",
          modifier: candidate.id,
          reason: `Parameter ${candidate.id} has n=${candidate.currentN} with significance for ${candidate.significantEffects.join(", ")} — ready for promotion to active`,
        });
      } else {
        console.log(`  ${candidate.id}: n=${candidate.currentN}/${candidate.requiredN}, significant for ${candidate.significantEffects.length} effects`);
      }
    }
  }

  // ── Step C: Update effect data point counts ──
  for (const effect of config.effects) {
    const count = points.filter(p => p.sideEffect === effect.id).length;
    effect.dataPointCount = count;
    effect.lastUpdated = new Date().toISOString().split("T")[0];
  }

  // ── Step D: Sanity checks ──
  console.log(`\n--- Step C: Sanity checks ---`);

  // Cap auto-applied changes
  const MAX_AUTO_PER_DAY = 5;
  if (autoApplied.length > MAX_AUTO_PER_DAY) {
    console.log(`  WARNING: ${autoApplied.length} auto-applied changes exceeds cap of ${MAX_AUTO_PER_DAY}. Moving excess to flagged.`);
    const excess = autoApplied.splice(MAX_AUTO_PER_DAY);
    flagged.push(...excess.map(c => ({ ...c, reason: c.reason + " — moved to review (daily cap exceeded)" })));
  }

  // Validate no impossible values
  for (const effect of config.effects) {
    for (const [modId, mod] of Object.entries(effect.modifiers)) {
      if (mod.oddsRatio > 5.0 || mod.oddsRatio < 0.1) {
        console.log(`  BLOCKED: ${effect.id}.${modId} OR=${mod.oddsRatio} outside [0.1, 5.0]`);
        // Revert to previous value if this was an auto-apply
        const applied = autoApplied.find(a => a.effect === effect.id && a.modifier === modId);
        if (applied) {
          mod.oddsRatio = applied.from;
          mod.logOdds = Math.log(applied.from);
          autoApplied.splice(autoApplied.indexOf(applied), 1);
        }
      }
    }
  }

  // ── Step E: Write results ──
  console.log(`\n--- Results ---`);
  console.log(`Auto-applied: ${autoApplied.length}`);
  console.log(`Flagged for review: ${flagged.length}`);

  if (autoApplied.length > 0 || flagged.length > 0) {
    // Archive current config
    if (!DRY_RUN) {
      if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
      const historyPath = path.join(HISTORY_DIR, `v${config.version}.json`);
      fs.writeFileSync(historyPath, JSON.stringify(config, null, 2));
      console.log(`  Archived v${config.version} to ${historyPath}`);
    }

    // Update config version
    config.version += 1;
    config.generatedAt = new Date().toISOString();

    // Add changelog
    const allChanges = [...autoApplied, ...flagged.map(f => ({ ...f, flagged: true }))];
    config.changelog.push({
      version: config.version,
      date: new Date().toISOString().split("T")[0],
      changes: allChanges,
      autoApplied: autoApplied.length > 0,
    });

    // Keep only last 30 changelog entries
    if (config.changelog.length > 30) {
      config.changelog = config.changelog.slice(-30);
    }

    // Write updated config
    if (!DRY_RUN) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      console.log(`  Written model config v${config.version}`);
    } else {
      console.log(`  [DRY RUN] Would write model config v${config.version}`);
    }

    // Write pending changes for review
    if (flagged.length > 0) {
      const pending = {
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        changes: flagged,
      };
      if (!DRY_RUN) {
        fs.writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));
        console.log(`  Written ${flagged.length} pending changes for review`);
      } else {
        console.log(`  [DRY RUN] Would write ${flagged.length} pending changes`);
      }
    }
  } else {
    console.log("  No changes needed. Model config unchanged.");
  }

  // Print summary
  console.log(`\n=== Analysis complete ===\n`);
  for (const change of autoApplied) {
    console.log(`  AUTO: ${change.effect}.${change.modifier}: ${change.from} → ${change.to}`);
  }
  for (const change of flagged) {
    console.log(`  FLAG: ${change.effect || "—"}.${change.modifier}: ${change.reason}`);
  }
}

main().catch(console.error);
