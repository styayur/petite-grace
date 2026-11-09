# Reference Review

Date: 2026-11-10

## Scope

Reviewed the public source trees of XiaoyaDownloader, XiaoyaAnswer, OCS, and Readest, plus the published licenses of PDF.js, Preact, idb, and fflate. The goal was to understand platform boundaries and interaction patterns, not to copy an existing userscript.

## XiaoyaDownloader observations

- A valid course page is identified under `/app/jx-web/mycourse/<groupId>`.
- Course visit metadata is requested from `/api/jx-iresource/statistics/group/visit`.
- Course resources are requested from `/api/jx-iresource/resource/queryCourseResources?group_id=<groupId>`.
- The existing script uses the browser cookie `prd-access-token` as a Bearer token.
- Resource records expose IDs, parent IDs, names, MIME types, quote/file IDs, timestamps, and path/group metadata.
- Download URLs are resolved through same-origin `/api/jx-oresource/cloud/file_url/<quoteId>`.
- The existing implementation sometimes relies on object iteration order, which is not a sufficient ordering contract. Petite Grace therefore records `sourceIndex` and uses explicit order fields when available.
- The existing implementation attaches the platform token to download requests and can export `.ef2` data. Petite Grace does not reproduce those credential-handling patterns.

The field names above are implementation evidence from an open-source adapter, not a guarantee that the current live API is unchanged. Real-platform verification is tracked separately.

## XiaoyaAnswer observations

- Exercise pages contain platform-specific DOM markers and question/option structures.
- A floating panel and keyboard-centric task status display work well for repeated study actions.
- Its paid activation-code path and automatic answer-filling features are intentionally out of scope.
- Provider configuration in one large userscript demonstrates the need for a small Provider Registry and explicit privacy boundaries.

## OCS observations

- A persistent mini window is useful only when it remains collapsible and secondary.
- Per-question navigation needs clear viewed/needs-review state.
- Large task-management surfaces should not dominate the reading experience.

## Readest observations

- Chapter-level navigation, a central document surface, and a separate annotation summary are appropriate for long reading sessions.
- Reading position and annotation recovery need stable document IDs rather than pure pixel offsets.

## Architecture decision

Use TypeScript, Vite, Preact, PDF.js, IndexedDB, fflate, Vitest, and Playwright. Use custom Fluent-token CSS instead of a large Fluent UI component runtime because this userscript has a small, controlled component surface and needs a compact, auditable bundle.

## License decision

Readest is AGPL-3.0 and is reference-only. No source is copied. XiaoyaDownloader, XiaoyaAnswer, and OCS are MIT; any later code reuse must retain attribution and be explicitly reviewed.