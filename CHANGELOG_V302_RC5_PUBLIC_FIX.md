# PhotoCheck Docs V3.0.2 RC5 — Public Directory Fix

## Root Cause

Vercel was serving the stale files inside `/public`, especially `public/index.html`, instead of the updated root-level `index.html`.

The root `index.html` already contains the RC5 marker and Clean State Controller, but `public/index.html` was still an old V2/V2.7 style build. That is why the preview continued to show:

- Provider / Mode / Risk / Strategy
- confidence / 信心度
- Structured form detected
- Force Excel / 強制 Excel
- direct Excel rendering before Mode Gate

## Fix

This package mirrors RC5 into both locations:

- `/index.html`
- `/v3-prototype.html`
- `/public/index.html`
- `/public/v3-prototype.html`

This prevents Vercel root routing from loading the old public build.

## QA Marker

The app header must show:

V3.0.2 RC5 QA

If this marker is missing, the preview is still loading an old file.

## Expected RC5 Flow

Upload image → OCR / AI analysis → independent Mode Gate → user chooses Excel / Word Doc / OCR → render result.

No image should directly enter Excel or Doc before user chooses a mode.
