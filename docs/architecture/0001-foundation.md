# ADR 0001: Foundation Architecture

Status: accepted

## Context

Petite Grace must ship as one installable userscript while keeping source modules maintainable. It also needs to run inside a third-party learning platform without leaking credentials or polluting the host page.

## Decision

- Use TypeScript with Vite and Preact.
- Bundle to one IIFE userscript with an explicit metadata header.
- Mount all UI in a Shadow DOM.
- Keep the Xiaoya adapter behind a typed `CourseAdapter` interface.
- Use IndexedDB through `idb` for local data.
- Use PDF.js as the PDF engine.
- Implement a focused PPTX subset parser with fflate rather than adopting an unmaintained/restrictively licensed renderer.
- Use custom Fluent 2-inspired design tokens instead of a large component runtime.

## Consequences

- The first bundle is larger because PDF.js is embedded.
- PPTX support is intentionally bounded and must display compatibility warnings.
- Platform changes are isolated to the adapter and can be tested against fixtures.
- The app remains installable without a server or account.