# PhotoCheck Docs V3.0.2 RC5 — Clean State Controller

Date: 2026-05-23

## Status
RC5 candidate for Preview QA. This version is designed to break the RC1–RC4 loop where old UI/state paths could still render engineering information or bypass the output-format choice.

## Core change
The front-end now uses a strict public state flow:

Upload image
→ OCR / AI analysis
→ independent Mode Gate
→ user chooses Excel / Word Doc / OCR
→ selected result renders

No document type is allowed to auto-render Excel or Doc before the user chooses.

## Files changed
- index.html
- v3-prototype.html

Both files are intentionally identical so Vercel root URL and /v3-prototype.html load the same build.

## RC5 visible QA marker
The app header displays:

V3.0.2 RC5 QA

If this marker is not visible in Vercel Preview, the deployment is not loading the RC5 files.

## UX fixes
- Added RC5 Clean State Controller override at the end of the main script.
- Added strict public UI guard to hide/remove internal meta/debug elements.
- Forced all recognized document types into the independent Mode Gate first.
- Rebuilt Mode Gate copy as product language only:
  - Excel Table Mode
  - Word / Doc Mode
  - OCR text only
- Removed visible technical phrases from public UI:
  - Provider / Mode / Risk / Strategy
  - confidence percentage
  - structured-form detection copy
  - force/forced Excel wording
  - debug wording
- Re-choose output format uses the existing OCR result and does not consume another credit.
- Change image starts a clean new-image flow and clears previous result/mode state.
- index.html and v3-prototype.html are synced.

## Not changed
- api/ocr.js
- vercel.json
- OCR API core
- export logic
- credits logic
- normalizedDocumentJSON schema

## Preview QA checklist
1. Open the Vercel root URL, not /v3-prototype.html.
2. Confirm the header shows V3.0.2 RC5 QA.
3. Upload image 1.
4. Confirm it always shows the independent Mode Gate first.
5. Confirm no Provider / Mode / Risk / Strategy line appears.
6. Confirm no confidence percentage or structured-form detection copy appears.
7. Choose Excel Table Mode and confirm the table renders.
8. Click Re-choose and confirm Mode Gate returns without credit change.
9. Choose Word / Doc Mode or OCR text only and confirm it uses the same OCR result.
10. Click Change image and upload image 2.
11. Confirm image 2 also enters Mode Gate first and does not inherit image 1's mode.
12. Confirm XLSX download still works.
