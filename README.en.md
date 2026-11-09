# Petite Grace

> A lightweight course companion for university learners.

Petite Grace brings chapter navigation, course-resource downloads, PDF/PPT reading, exercise study aids, bring-your-own-key LLM assistance, highlights, notes, and review into one low-distraction workspace. The first supported platform is Xiaoya (`*.ai-augmented.com`).

## Status

Development is staged from `v0.1.0` through `v0.5.0`. Real-platform acceptance is tracked in `docs/acceptance/`; fixture-based tests are never presented as real-platform verification.

## Development

```bash
npm install
npm run dev
npm run test
npm run test:e2e
npm run build
```

The userscript build is written to `dist/petite-grace.user.js`.

## Privacy

Credentials are used only in the active page session and are never persisted. External AI providers are opt-in and receive only the minimum selected context. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
