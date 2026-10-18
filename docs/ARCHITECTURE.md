# Angular application guide

## Stack and provenance

Angular 21 standalone components, PrimeNG 21 with an OctoGear Aura preset, and the Angular Sakai layout. Use the committed package-lock.json for exact installed versions. The original Sakai source is https://github.com/primefaces/sakai-ng at commit `96d71496d685b5c110efd2875abaa2bf89a56ad2`; layout assets came from its pinned submodule commit `eaa70ece4cfa9aeb8f60b36dce5a422b6bae8003`. Keep `SAKAI_LICENSE.md` and the bundled font licenses. The demo pages, stock images, theme configurator, sample business data, and unrelated dependencies are excluded from the delivered app.

Official references: https://sakai.primeng.org/documentation, https://angular.dev/reference/versions, https://v21.primeng.org/installation.

## Responsibility boundaries

- `src/app/core/app-settings.ts`: load and validate runtime public configuration before startup. Failure displays a recoverable setup error instead of choosing a different API.
- `src/app/core/api-client.ts`: typed API envelope and centralized GET/POST URL construction.
- `src/app/core/api.interceptor.ts`: Accept/locale/bearer headers only for the configured API URL boundary, request timeout, and authenticated 401 handling.
- `src/app/core/session.service.ts`: in-memory token, current admin identity, login/logout and session generation. Credentials/tokens are not written to localStorage, sessionStorage, logs, or URLs.
- `src/app/core/auth.guard.ts`: client navigation guard; Laravel remains authoritative for permission checks.
- `src/app/core/locale.service.ts`: typed English/Arabic copy and document direction. Only language preference is stored in localStorage; preference storage is optional.
- `src/app/core/octogear-preset.ts` and `src/styles.scss`: shared PrimeNG theme, typography, tokens, and shell/table presentation.
- `src/app/layout/`: Sakai layout components/service, adapted to OctoGear. Keep business requests in features/core, not layout primitives.
- `src/app/features/`: standalone, route-lazy feature components. Login uses reactive forms; overview retrieves the existing dashboard summary and renders a PrimeNG table.
- `tests/auth.spec.ts`: browser integration tests with intercepted API responses. Synthetic data exists only in tests, not application source.

Add new features in focused directories. Reuse existing API client, localization, theme, and table patterns. Avoid generic CRUD scaffolding before real contracts justify it.

## Runtime configuration

Edit only `public/app-config.json`:

```json
{ "apiBaseUrl": "http://127.0.0.1:8000/api" }
```

For an existing production build, edit `dist/octogear-admin/browser/app-config.json` on the host. Runtime configuration loads on page startup with `cache: no-store`; reload open tabs after a change. It requires no application rebuild when editing the deployed JSON. Keep `/api` in the base exactly once, use HTTPS except for loopback development, and never put secrets in this public file.

Production also requires a web-server fallback to index.html, HTTPS, correct Laravel allowed origins, and deployment-specific configuration. A single frontend URL setting is not a substitute for those server tasks. No production deployment has been performed.

## First-slice behavior and limits

- Login -> token -> protected admin profile -> overview. The profile is required before entering the shell.
- Tokens stay in memory. Refreshing or reopening the page returns to login; persistent sign-in and cookie sessions are not implemented. Server tokens follow Laravel's existing expiry rules, not a new browser expiry policy.
- Successful logout revokes the current server token. If logout cannot be confirmed, show an error and allow retry; do not claim server revocation succeeded.
- HTTP 401 from an authenticated API request clears the session and returns to login. Failed credentials, blocked access, throttling, connection failure and validation each have feedback.
- Password recovery opens a truthful contact-administrator explanation. It does not send email/SMS, reset credentials, or invent a recovery endpoint.
- Overview shows existing API counts and order-status summary. No fabricated chart series, revenue conversions, customer rows or operational links.
- All other full management lists/forms remain subsequent slices. First establish their actual filters, pagination, permissions and response formats.
- Framework/browser build tests do not prove live authenticated end-to-end access with a real retained admin account. That requires an owner-supplied login, without sharing passwords in chat.

## Verification commands

Use Node 22.12+ on the 22.x line (verified with 22.17.0) or a version supported by Angular 21. npm 11 is used for dependency installation because the host npm 10.9.2 crashed inside peer-dependency resolution.

```powershell
npx --yes npm@11 ci
npm run typecheck
npm run build
npm test
```

Browser tests use the locally installed Google Chrome channel, one worker, and a lightweight local preview of the production build on 127.0.0.1:4200. Run the build before tests. Tests intercept API responses and do not log in to the retained Laravel database. The first simultaneous build/dev-server verification hit a timeout on a low-memory host; a sequential two-worker production build and static preview passed. Set `$env:NG_BUILD_MAX_WORKERS='2'` before builds on this host. A different local browser can be selected in playwright.config.ts. Do not run these browser tests against a production API or remove their request mocks.
