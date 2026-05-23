# V3.0.2 UX Softening Patch
## V3.0.2 — UX Softening Patch

Base: V3.0.1 clean base
Scope: UX copy and visibility only — zero core logic changes

### Changes (v3-prototype.html only)

#### 1. arch-meta-bar — Hidden from front-end
- CSS: `display:none!important` (overrides any JS inline style)
- confidence / risk / strategy / provider no longer visible to users
- Internal data still updates correctly for any future use

#### 2. Safety Notice (Upload zone) — Reassurance tone
- Base notice: 🔒 → ✅, copy rewritten from "本系統不會保存…" to positive "AI 辨識後，先確認草稿再下載"
- High-risk/Secure Mode notice: ⚠️ → 🔒, "安全模式已啟用", removed alarming "敏感資訊" framing

#### 3. Mode Gate — Product language
- Removed confidence% from title (no more "信心度 73%")
- Removed debug bullets (classification.reasons list)
- Title: "請選擇輸出方式 / Choose output format" (clean, product-grade)
- Body: clear user-facing description, no technical jargon
- "只看 OCR 文字" renamed to "純文字輸出 / Plain text only"

#### 4. Doc Mode Warning — Softened
- Removed ⚠ prefix
- Changed from "未套用表格重建" (engineering) to "適合用於閱讀與匯出文字內容" (user benefit)
- "強制 Excel 模式" → "切換至 Excel 模式" (less aggressive wording)

#### 5. Excel Result Area — Draft hint bar added
- New `.draft-hint-bar` strip below table toolbar
- ZH: "💡 這是 AI 轉換草稿，您可以先調整欄寬與內容，再下載成 Excel 檔。"
- EN: "💡 This is an AI-generated conversion draft. You can review the content and adjust column widths before downloading the Excel file."

#### 6. Container utility class added
- `.container` CSS added — fixes Security section horizontal padding on mobile

### NOT changed
- api/ocr.js — not touched
- vercel.json — not touched
- OCR flow, export logic, credits logic — not touched
- normalizedDocumentJSON schema or architecture — not touched
- All CTA buttons (showApp) — already correct, no changes needed
