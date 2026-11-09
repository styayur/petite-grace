# Engineering Rules

## Architecture

- `src/platform/xiaoya` is the only place that knows Xiaoya API details.
- `src/reader` owns document rendering; it must not import platform adapters.
- `src/annotations`, `src/review`, and `src/ai` must remain usable without the Xiaoya DOM.
- `src/entrypoints/xiaoya.user.ts` stays a thin bootstrap layer.
- The release may be one `.user.js` file, but source must remain modular.

## Data and privacy

- Never write the `prd-access-token` or any session credential to logs, storage, analytics, exports, or release assets.
- Never send the platform `Authorization` header to a foreign origin.
- Validate all resource URLs as HTTPS and keep a host allowlist.
- API keys stay local, are excluded from normal exports, and require explicit opt-in for external requests.
- Do not implement paid-license bypasses, unauthorized access, automatic answer submission, or platform restriction evasion.

## UI isolation

- Mount the application in a Shadow DOM.
- Do not globally override `body`, page fonts, host buttons, native `fetch`, `XMLHttpRequest`, or `Function.prototype`.
- Any event interception must be local, reversible, and tested.

## Quality gates

- `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` must pass before a release.
- New behavior requires unit tests. Platform/API boundaries require integration tests.
- Do not disable tests or weaken gates to obtain a green result.
- Do not call a release Stable while real-platform acceptance is `NOT_VERIFIED`.

## Dependencies

- Prefer maintained, small dependencies.
- Pin versions in `package.json` and commit the lockfile.
- Run `npm audit` and a production license inventory before release.
- Record material architecture decisions in `docs/architecture/`.

## Release

- Tag only after the version in `package.json`, userscript metadata, changelog, and acceptance JSON agree.
- Verify hashes from the downloaded GitHub release assets, not only from the local build directory.
