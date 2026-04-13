# Contributing to magistra-predictor

Thank you for wanting to help. This project is deliberately open because we believe the only honest way to build a predictive tool that touches medical decisions is under public scrutiny.

---

## What we want

In rough order of priority:

1. **Critique of the methodology.** Specific, cited, constructive. Say what's wrong, why, and ideally what should replace it.
2. **Statistical improvements.** Replacements for the method-of-moments τ² estimator (we'd prefer REML or Paule-Mandel), proper interaction term modeling, better calibration testing.
3. **Data quality audits.** Independent spot-checks of LLM extraction accuracy against a gold-standard subset.
4. **New data sources.** Pharmacovigilance databases we're missing, especially from under-represented regions (Latin America, Africa, Southeast Asia).
5. **Extraction prompt improvements.** Our extraction is conservative; it may be missing implicit rates, demographic context, or temporal information.
6. **Bug reports.** Broken predictions, edge cases, unit issues.
7. **Translations.** The tool is currently English and Dutch; we'd like more.

---

## What we don't want

- **Promotional content.** This is a tool, not a marketing channel.
- **Medical claims we can't back up.** We are a statistical tool, not a clinical authority.
- **Removal of limitations.** The honest limitations list is a feature, not a problem to hide.
- **Monetization features.** The predictor and data are free. Commercial revenue comes from the doctor-matching platform, not the data tool.

---

## How to contribute

### For critique / methodology feedback

The fastest channel is the researcher feedback form on the methodology page:
https://magistra.health/en/methodology#researcher-feedback

Fill in your name (or anonymous), affiliation, topic, and specific feedback. We read everything and respond within a week.

For longer-form critique, open a GitHub issue in this repo with the label `methodology` or `statistics`.

### For code contributions

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-change`
3. Make your change with a clear commit message explaining what and why
4. Open a pull request against `main`
5. Explain in the PR description: what problem this solves, why this approach, and any tradeoffs

We will respond within a few days for small changes and within a week for larger ones.

### For new data sources

Open an issue with the label `data-source` and include:
- URL or API endpoint
- Access method (RSS, API, scraping)
- Terms of use / robots.txt compliance
- Estimated data volume
- Why this source is worth adding

### For extraction improvements

Open an issue with the label `extraction` and include:
- The source text that's being extracted incorrectly
- What should be extracted
- Your proposed fix to the prompt or logic

---

## Acknowledging contributors

Substantive contributions are acknowledged in two places:

1. **Git history.** PRs are merged with the contributor's name preserved.
2. **Public changelog.** The model configuration (`data/model-config.json`) contains a changelog with contributor attribution for methodology changes. A human-readable version is rendered on the methodology page.

If you prefer anonymity, let us know and we'll credit you as "Anonymous reviewer" with topic and affiliation only.

---

## Code of conduct

We don't have a formal code of conduct, but the spirit is:

- **Be specific.** "Your math is wrong" without a reference is not useful. "The DerSimonian-Laird estimator is known to underestimate τ² at k < 5 [citation] — consider Paule-Mandel or REML" is useful.
- **Assume good faith.** We're a small team trying to do something hard in public. Critique the approach, not the person.
- **Prefer fixing over flagging.** If you see a problem and can fix it, open a PR. If you can only flag it, open an issue.

---

## Contact for non-public critique

If you have feedback you'd rather not post publicly (e.g., unpublished data, sensitive clinical observations, collaborative opportunities), email:

**Saurabh Goyal** — saurabh@magistra.health

All non-public feedback is confidential unless you explicitly authorize publication.

---

## A final note

This project will make mistakes. Some of its current predictions will turn out to be wrong. Some of its methodology will turn out to be inadequate. The goal is to fix those things visibly, in public, with attribution. That is more valuable than hiding behind a polished facade. If you can help us do that, we'd be grateful.
