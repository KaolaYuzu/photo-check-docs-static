# PhotoCheck Docs — Two-Phase Changelog

## Commit 1｜V3.0.2 RC5a credit clarity patch

Files changed: index.html, v3-prototype.html, public/index.html, public/v3-prototype.html (identical)
Scope: Front-end copy only — zero changes to credits logic, OCR, export, Mode Gate

Changes:
1. Nav credits badge: "剩餘次數" → "AI 辨識額度：" / "AI credits:" + tooltip
2. Under "啟動 AI 辨識" button: added .credit-note small text
   ZH: 啟動 AI 辨識會使用 1 次額度；預覽、重新選擇輸出方式與下載不會再次扣點。
   EN: AI recognition uses 1 credit per new image. Preview, re-selecting output format, and downloads do not use additional credits.
3. Export tab top: added .credit-done-note green confirmation bar
   ZH: ✓ 這次辨識已完成。重新選擇輸出方式或下載，不會再次使用 AI 辨識額度。
   EN: ✓ Recognition is complete. Re-selecting the output format or downloading files does not use another credit.
4. CSS: .credit-note, .credit-done-note styles

NOT changed: consumeCreditForOCR, getUsage, startOCR, Mode Gate, export, api/ocr.js, vercel.json

---

## Commit 2｜V3.0.3 layout alignment patch

Files changed: index.html, v3-prototype.html, public/index.html, public/v3-prototype.html (identical)
Version badge: "V3.0.3 QA · AI Drafts. You Verify."
Scope: Layout engine only — zero changes to credits, Mode Gate, UX flow, api/ocr.js

Functions changed:
1. detectGridFromCanvas()
   - Dark pixel floor: 0.02 → 0.05 (rejects text strokes as grid lines)
   - Neighbour pixel confirmation check (reduces single-pixel spike noise)
   - mergeClose gap: H 8→12, V 13→18 (collapses shadow/border near-duplicates)

2. assignWordsToCells() — complete rewrite
   - Primary metric: normalized bbox overlap score (intersection_area / word_area)
   - ≥0.45 → confident placement
   - 0.18–0.45 → low-confidence; accepted only if best ≥1.4× second-best
   - <0.18 → ambiguous; assigned to best, logged to console.debug
   - Black-cell +20% score boost preserved (V2.6.1 header priority)
   - Pure-number guard preserved (V2.6.1 §6.1, §6.3)
   - alignmentStats logged to console.debug (NOT shown in UI)

3. reconstructGridSchema()
   - OCR cluster fallback: when interiorH < 2 lines, infer rows from OCR y-clusters
   - Only replaces grid result if OCR gives MORE rows
   - reconstructionMode: canvasGrid-v22 → canvasGrid-v303
   - _debug object: + ocrClusterFallback, + alignmentStats fields

4. inferRowsFromOCRClusters() — new helper
   - Clusters word y-positions with tolerance = max(8, imageH × 1.8%)
   - Returns boundary array for row reconstruction

5. draft-hint-bar text → "系統已盡量對齊表格，下載前建議快速檢查欄位與內容。"

Functions NOT changed: detectCellBackgrounds, buildXLSXFromSchema, renderTableFromSchema,
  mapOCRToSchemaV21, extractOCRWords, isPureNumber, credits logic, Mode Gate, api/ocr.js, vercel.json

---

## File Sync Status
| File | Contains RC5a | Contains V3.0.3 | MD5 |
|------|---------------|-----------------|-----|
| index.html | ✓ | ✓ | 820a2d19... |
| v3-prototype.html | ✓ | ✓ | 820a2d19... |
| public/index.html | ✓ | ✓ | 820a2d19... |
| public/v3-prototype.html | ✓ | ✓ | 820a2d19... |
