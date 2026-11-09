# ADR 0003: Annotation Anchors

Status: accepted

## Decision

An annotation stores both a stable document identity and multiple kinds of anchor evidence:

- document ID derived from course/resource identity
- page number
- selected text quote
- surrounding context
- page-relative rectangles
- relocation state

Page-relative rectangles are stored as fractions of the rendered page, not absolute screen pixels. Highlights therefore survive zoom and layout changes.

## Recovery

On document load, Petite Grace checks whether each annotation quote is present on its recorded page. If not, it scans the document for the same quote. A successful match updates the page while retaining the original data. A missing quote sets `needsRelocation` and preserves the annotation for user review instead of silently deleting it.

## Limits

If a file is replaced with substantially different text, the quote cannot always be located. The UI marks the item as needing relocation and keeps its note and original quote.
