# PhotoCheck Docs V2 — 測試說明 / Testing Guide

---

## 1. 本機開啟 v2-prototype.html / Open locally

直接雙擊 `v2-prototype.html` 即可在瀏覽器打開。  
**不需要 Node.js、不需要 npm install、不需要任何 build 步驟。**

> Double-click `v2-prototype.html` to open it in any browser.  
> No Node.js, no npm, no build step required.

---

## 2. 為什麼 Claude Preview 不能測 OCR？

Claude Preview（或直接本機 `file://` 開啟）無法呼叫 Vercel 的 `/api/ocr`，原因：

- `/api/ocr` 是部署在 `https://photo-check-docs-static.vercel.app` 的 Serverless Function
- Claude Preview 的 origin 不同，`fetch('/api/ocr')` 會拿到 HTML 404 頁面，而非 JSON
- 瀏覽器解析 HTML 字串為 JSON 時，就會出現：  
  `Unexpected token '<', "<!DOCTYPE..." is not valid JSON`

**V2 已修正：** fetch 後先讀 `response.text()`，若回傳以 `<!DOCTYPE` 或 `<html` 開頭，立即顯示明確錯誤，不再觸發 JSON.parse crash。

> **Why Claude Preview can't call OCR:**  
> `/api/ocr` is a Vercel Serverless Function. In preview or `file://` mode, the fetch request returns a 404 HTML page instead of JSON. V2 now detects this and shows a clear error instead of crashing.

---

## 3. 如何使用 Demo Mode / Using Demo Mode

當 OCR API 無法連線時，點擊：

> **「使用範例資料（Demo Mode）」**  
> **"Use sample data (Demo Mode)"**

Demo Mode 會載入一份模擬採購表單資料（5 欄 × 6 列），讓你完整體驗：

- ✅ Data Preview（可編輯 cell）
- ✅ Visual Preview（SVG 向量草稿）
- ✅ 下載 XLSX、SVG、CSV、JSON
- ✅ PDF Print Beta

**Demo Mode 不呼叫任何 API，完全離線可用。**

> Demo Mode loads a sample invoice table and lets you use all export features offline. No API call is made.

---

## 4. 部署到 Vercel 後測試 /api/ocr

1. 將 `v2-prototype.html` 上傳到你的 GitHub repo 根目錄
2. Vercel 自動部署後，訪問：  
   `https://photo-check-docs-static.vercel.app/v2-prototype.html`
3. 在該網域下，`fetch('/api/ocr')` 會正確路由到 Vercel Serverless Function
4. 上傳照片 → 點「啟動 AI 辨識」→ 正式 OCR 流程

> **Deploy to Vercel to test real OCR:**  
> Add `v2-prototype.html` to your GitHub repo root. After Vercel deploys, open:  
> `https://photo-check-docs-static.vercel.app/v2-prototype.html`  
> At this origin, `fetch('/api/ocr')` routes correctly to the Serverless Function.

---

## 5. 不要動的檔案 / Do NOT modify

| 檔案 | 說明 |
|------|------|
| `index.html` | Production V1 landing page — 請勿覆蓋 |
| `public/index.html` | 同上 |
| `api/ocr.js` | OCR Serverless Function — 未動 |
| `vercel.json` | Routing 設定 — 未動 |

`v2-prototype.html` 是獨立的原型檔，不影響以上任何檔案。
