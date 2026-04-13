# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in this project — including but not limited to:

- Credential leakage in commits, issues, or releases
- Injection vulnerabilities in the methodology or extraction code
- Bugs that could expose patient data from the live system (magistra.health)
- Issues with the model update pipeline that could allow adversarial manipulation
- Anything else you believe requires private disclosure

**Please do not open a public GitHub issue.** Instead, email:

**saurabh@magistra.health**

I will acknowledge receipt within 48 hours and provide a substantive response within 7 days. Responsible disclosure is appreciated and I will publicly credit reporters in the methodology changelog (unless you request anonymity).

## Scope

- **In scope:** code in this repository, API endpoints at `magistra.health/api/*`, methodology issues that could affect prediction safety, extraction pipeline vulnerabilities
- **Out of scope:** phishing attempts, social engineering against me or my collaborators, denial-of-service attacks on the hosted site (report to Vercel directly)

## What we will NOT do

- Threaten legal action against good-faith security researchers
- Require NDAs for disclosure
- Delay public disclosure beyond what's reasonable to coordinate a fix

## What we ask from reporters

- Give us a reasonable window to fix before public disclosure (typically 30 days for non-critical, faster for critical)
- Do not access, modify, or destroy data that doesn't belong to you
- Do not use findings to harass or harm users

## Acknowledgments

Security researchers who report valid issues are acknowledged in the [methodology changelog](https://magistra.health/en/methodology) unless they request anonymity.
