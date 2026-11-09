# ADR 0002: Advanced Reader

Status: accepted

## PDF

- Use PDF.js with an embedded worker blob so the userscript does not depend on a remote CDN.
- Render only pages intersecting the scroll viewport plus a bounded margin.
- Keep text layers enabled for selection, search and future annotation anchoring.
- Preserve the page layout in a single or two-column continuous grid.
- Save page, layout, zoom mode and scale in IndexedDB.

## PPTX

- Parse the Open XML package locally with `fflate`.
- Render supported text boxes, basic positioning, solid text colors and embedded images.
- Treat animations, SmartArt, charts, tables and font substitution as explicit compatibility boundaries.
- Never upload a private presentation to a third-party preview service.
- Provide the original-file download path when fidelity is insufficient.

## Consequences

- PDF.js adds roughly 1.8 MB to the userscript before gzip.
- Text and annotation alignment must be validated after zoom and viewport changes.
- PPTX preview is intentionally a subset, not a promise of Office fidelity.
