# ADR 0004: Exercises and Free AI

Status: accepted

## Exercise boundary

The exercise parser accepts sanitized text structures from fetched HTML or the current host DOM. It never injects platform HTML into the app. Question, option, verified answer and explanation fields are normalized into typed data.

Question state is keyed by `resourceId:questionId` and stored locally. The app does not submit answers to the platform.

## Provider boundary

Groq, OpenRouter, Gemini and user-configured OpenAI-compatible endpoints share one Provider Registry. Provider adapters only expose:

- model discovery
- a single chat completion request

The AI service owns consent, local caching, rate limiting, fallback and paid-model guardrails.

## Privacy and cost rules

- No external request occurs without a per-question consent checkbox.
- Prompts contain only the current question, options and user answer.
- Platform tokens, cookies, grades and whole-course data are excluded.
- API keys are stored only in IndexedDB and are omitted from annotation/course exports.
- OpenRouter models whose model metadata does not show zero pricing are blocked unless the user explicitly allows paid use.
- AI output is always labelled as AI inference, never as a platform-verified answer.

## Failure behavior

Provider failures are collected and retried against another enabled provider when available. Reading, downloads and local review items remain usable with no API key.
