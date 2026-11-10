# Browser Compatibility Matrix

| Browser                       | Version tested | Status                           | Notes                                                                          |
| ----------------------------- | -------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| Chrome for Testing (Chromium) | 158            | Automated fixture E2E passed     | PDF.js, IndexedDB, Shadow DOM, keyboard and responsive tests                   |
| Microsoft Edge (Chromium)     | Not yet tested | Expected compatible, not claimed | Same Chromium engine but user-script manager behavior still needs a live check |
| Firefox                       | Not yet tested | Not claimed                      | IndexedDB and PDF.js likely work; userscript/API behavior needs verification   |
| Safari                        | Not yet tested | Not claimed                      | No compatibility claim until real testing is completed                         |

## Tested surface

- 1280×800 desktop viewport
- 480×820 narrow viewport
- Light theme
- PDF continuous/virtualized rendering
- MP4/native HLS/hls.js video initialization
- Signed-resource security boundaries
- Exercise state persistence
- Annotation persistence and zoom stability
- Review workflow
- AI settings modal and consent gating

## Not tested

- Live Xiaoya authentication and course API
- Browser-extension installation in Edge/Firefox/Safari
- Real PPTX files with complex charts, SmartArt, animations or formula objects
