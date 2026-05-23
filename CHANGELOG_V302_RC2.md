# V3.0.2 RC2 — UX Softening Patch (full)

Base: V3.0.2 RC1
Scope: UX front-end only — zero changes to OCR, export, credits, normalizedDocumentJSON

## RC2 Fixes (v3-prototype.html only)

### Fix 1 — debug-bar hidden (CSS display:none!important)
Visual tab Debug Line Detection toggle no longer visible to users.

### Fix 2 — "🔄 換圖 / New image" button in results tabs
Users can scroll back to upload zone at any time from result view.
`scrollToUpload()` function added in navigation section.

### Fix 3 — proc-note cleaned
"正在呼叫 OCR API" → "AI 正在分析文件，完成後可直接編輯草稿內容。"

### Fix 4 — updateDpMeta() rewritten
Removed: 解析模式 / Schema v2 / currentDocMode / rowGapWarnings
Now shows: "AI 辨識草稿 · N 欄 · N 列 · 可直接編輯"

### Fix 5 — updateSafetyNotice() threshold raised
Previously: medium OR high → Secure Mode banner (menus with 總計 triggered it)
Now: only HIGH risk (contracts, medical, legal) triggers Secure Mode notice
medium risk stays on calm base notice

### Fix 6 — runExtractionPipeline() all types through Mode Gate
Previously: simple-table → direct Excel; doc-like → direct Doc
Now: ALL types → showModeGateCard() with recommendation
User always confirms output format for each new image.

### Fix 7 — showModeGateCard() recommendation system
- simple-table → "建議 Excel 模式 ★" button highlighted
- doc-like → "建議文件模式 ★" button highlighted
- structured-form / uncertain → neutral (no recommendation)
- Scrolls Mode Gate into view via setTimeout + scrollIntoView
- No confidence%, no debug bullets, no technical reasons

### Fix 8 — Doc mode showMsg cleaned
runDocModeV3 + legacy runDocMode: removed "強制 Excel 模式" engineering language
Now: "草稿已就緒，可直接下載文字內容。如需表格格式，點擊「切換至 Excel 模式」。"

### Fix 9 — analyzeLayoutOnly() showMsg cleaned
Removed "Enable Debug to inspect" / "偵測到的格線與結構"
Now: "版面分析完成。已顯示偵測到的表格結構，不消耗辨識次數。"

## NOT changed
- api/ocr.js — not touched
- vercel.json — not touched
- OCR call flow — not touched
- export logic (XLSX/SVG/CSV/JSON) — not touched
- credits logic — not touched
- normalizedDocumentJSON schema — not touched
- showApp() CTA scroll fix (requestAnimationFrame) — preserved from RC1

## RC2 Success Criteria Check
1. No Provider/Mode/Risk/Strategy/confidence in front-end ✅
2. Mode Gate has no tech bullets ✅
3. Secure Mode notice = calm, only for actual high risk ✅
4. User can change image (🔄 button in results) ✅
5. User can re-choose mode (Mode Gate always shown) ✅
6. New image never inherits previous mode ✅
7. Core upload/OCR/Excel/export flow unchanged ✅
