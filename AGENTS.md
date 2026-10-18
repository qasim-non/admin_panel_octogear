# OctoGear Admin: working instructions

These instructions apply to `C:/Tamkkun/OctoGearProject/OctoGear-admin`.

## Read before every project request

1. Read this file, `README.md`, and `PROJECT_DOCUMENTATION.md`, including the current progress record and the complete sections relevant to the task.
2. Read any applicable nested instructions and feature documentation. Retrieve truncated content before proceeding.
3. Inspect the existing implementation before adding components, API calls, helpers, or business rules. Preserve unrelated edits.
4. Briefly identify the guidance used and the bounded implementation step before changing application code.

## Project boundaries and references

- Web project: `C:/Tamkkun/OctoGearProject/OctoGear-admin`.
- Current Laravel API: `C:/Tamkkun/OctoGearProject/OctoGear-api`.
- Read-only legacy wireframes: `C:/Tamkkun/yardy/Admin panal` (25 PNGs). Preserve these originals. Their historic Yardy label is not the product identity.
- Use OctoGear throughout product copy, branding, metadata, and new project identifiers. Keep original source-reference paths intact.
- The approved login direction is recorded in `PROJECT_DOCUMENTATION.md` and `docs/design/login-approved-concept.png`.
- Approved stack: Angular with PrimeNG and Sakai (Angular version). Preserve the compatible Angular 21 / PrimeNG 21 baseline and committed dependency lockfile. Read `docs/ARCHITECTURE.md` and feature guides before implementation.
- The owner authorizes useful additions beyond the wireframes: explain the need and include them in bounded steps; document changes. This does not authorize unrelated features or invented API behavior.

## Design and implementation

- Apply the documented navy, yellow, typography, spacing, form, table, accessibility, and bilingual design rules consistently.
- Use the original approved logo asset directly. Do not trace or regenerate it from the illustrative mockup.
- Centralize API base URL configuration and route all HTTP requests through the shared client. No scattered localhost or production origins.
- Reuse established API capabilities and shared web components. Do not invent backend support or duplicate business rules in the browser.
- Work in small, reviewable feature slices. Explain relevant Laravel request flow, changed files, validation, authorization, and tests so the owner can understand the code.
- Before editing Laravel, read `C:/Tamkkun/OctoGearProject/OctoGear-api/AGENTS.md` and every document it requires. Follow its architecture and feature contracts. Web instructions do not replace backend instructions.
- The owner authorizes necessary API routes and related changes for this admin project. Inspect existing routes first; explain and document actual additions. This is not authorization for unrelated rewrites, destructive resets, deployment, or live external messaging.
- Keep the project documentation current after each completed slice. Review the diff, run appropriate checks, and report actual outcomes and limitations.
- Do not claim authentication, permissions, production readiness, or API integration works based only on a visual mockup.
