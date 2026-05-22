# PhotoCheck Docs V3 — Testing Guide

## Access

**Local:** Double-click `v3-prototype.html` (no build required)

**Vercel (after deploy):**
```
https://photo-check-docs-static.vercel.app/v3-prototype.html
```

---

## Four Test Scenarios

### A. Menu / Price List (simple-table)
1. Upload a menu or invoice photo
2. Click **啟動 AI 辨識 / Start AI Recognition**
3. Expected:
   - documentType: `simple-table`
   - Strategy: `excel`
   - Arch bar shows `simple-table | excel | low`
   - Direct → Data Preview + Download tabs
   - XLSX / CSV / SVG / JSON download works
   - No Mode Gate shown

### B. Shareholder Notice / Official Announcement (document)
1. Upload a shareholder notice or formal announcement
2. Click AI Recognition
3. Expected:
   - documentType: `document` or `uncertain`
   - riskLevel: `high` or `medium` → Secure Mode notice shown
   - Either → Doc Mode directly, OR → Mode Gate
   - No large Excel grid produced automatically
   - Doc Mode shows reading-order text
   - TXT / JSON export available

### C. Machine Maintenance Form / Dense Form (structured-form)
1. Upload a maintenance record or dense form
2. Click AI Recognition
3. Expected:
   - documentType: `structured-form`
   - Mode Gate appears: Excel / Doc / OCR text choices
   - riskLevel: `medium` → Secure Mode notice
   - If user clicks "Excel Mode" → Excel draft produced
   - If user clicks "Doc Mode" → reading-order text shown

### D. State Reset Test (换图测试)
1. Upload Menu → run recognition → note documentType
2. Upload Shareholder Notice → note documentType changes
3. Upload Maintenance Form → note Mode Gate appears
4. Upload Menu again → confirm back to simple-table
5. Expected each time:
   - Safety notice resets
   - Arch bar resets
   - Old schema/tableSchema cleared
   - Old black cells cleared
   - riskLevel re-evaluated

---

## Demo Mode (no API required)

Click **使用範例資料 / Use sample data** — loads mock invoice, no credits used.

Click **只分析版面 / Analyze layout only** — runs canvas detection on uploaded image, no OCR.

---

## Why Claude Preview can't test OCR

`/api/ocr` is a Vercel Serverless Function. In Claude Preview or `file://` mode, the fetch returns HTML instead of JSON. V3 detects this and shows a clear error. Use Demo Mode or deploy to Vercel to test real OCR.

---

## Credits Logic (V3 = V2.3 rules, unchanged)

| Action | Credits |
|--------|---------|
| Demo Mode | 0 |
| Layout-only | 0 |
| AI Recognition (new image) | 1 |
| AI Recognition (same image again) | 0 (deduped by filename+size) |
| OCR failure | 0 |
| XLSX / SVG / CSV / JSON download | 0 |
| Force Excel / Force Doc Mode | 0 |
