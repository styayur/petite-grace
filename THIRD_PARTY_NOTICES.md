# Third-Party Notices

Petite Grace is MIT licensed. This file records runtime dependencies and the reference projects reviewed before implementation.

## Runtime dependencies

| Dependency | License | Use |
| --- | --- | --- |
| Preact | MIT | Lightweight UI rendering |
| idb | ISC | IndexedDB wrapper |
| fflate | MIT | In-browser ZIP/PPTX container parsing |
| PDF.js (`pdfjs-dist`) | Apache-2.0 | PDF rendering and text layer |

Exact resolved versions are recorded in `package-lock.json`.

## Reference projects

The following projects were reviewed for data structures, interaction patterns, and failure modes. Petite Grace reimplements its own architecture and does not copy their proprietary or paid functionality.

### XiaoyaDownloader

- URL: https://github.com/zygame1314/XiaoyaDownloader
- License: MIT
- Reviewed for: Xiaoya course URL identification, course visit/resource API boundaries, resource metadata, download URL handling, and known ordering/download risks.

### XiaoyaAnswer

- URL: https://github.com/zygame1314/XiaoyaAnswer
- License: MIT
- Reviewed for: Xiaoya exercise DOM/API context, state indicators, provider configuration patterns, and privacy/security anti-patterns. Petite Grace does not include its activation-code or paid-feature mechanisms.

### OCS

- URL: https://github.com/ocsjs/ocsjs
- License: MIT
- Reviewed for: floating-window information architecture, exercise navigation patterns, and task status presentation. No OCS code is included.

### Readest

- URL: https://github.com/readest/readest
- License: AGPL-3.0

Readest is used only as a UX and architecture reference. No Readest source code is copied or linked into Petite Grace. Its AGPL license therefore does not apply to this repository. Any future source reuse requires a separate compatibility review.

### PDF.js

- URL: https://github.com/mozilla/pdf.js
- License: Apache-2.0
- Used as a runtime dependency for PDF rendering.

### Microsoft Fluent 2 and Immersive Reader

Used as design references. No Microsoft proprietary assets or implementation code are included.