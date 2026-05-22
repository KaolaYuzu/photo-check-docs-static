# PhotoCheck Docs V3 — Architecture Notes
**Document Understanding + Secure Extraction**

## Architecture Overview

```
Upload → resetAllPreviousState
       → Safety Notice (always visible)
       → startOCR
           → detectGridFromCanvas         ← Layer 1a: Visual analysis
           → classifyDocumentType         ← Layer 1b: 4-class classification
           → runExtractionPipeline
               → googleDocumentAIAdapter  ← Layer 1c: Provider Adapter
               → computeRiskLevel         ← Layer 2:  Risk Assessment
               → updateSafetyNotice
               → updateArchMetaBar
               → Strategy Router          ← Layer 3:  Extraction Strategy
                   simple-table → runExcelMode (V2.5.1 legacy grid)
                   document     → runDocModeV3 (reading-order blocks)
                   structured-form → showModeGateCard
                   uncertain    → showModeGateCard
```

## Three Architecture Layers

### Layer 1 — Document Understanding
- `classifyDocumentType()` — V2.7.1 4-class classifier (gridRegularity, longRatio, etc.)
- `googleDocumentAIAdapter()` — converts OCR + grid → normalizedDocumentJSON v3
- `mapClassToDocType()` — classifier mode → documentType
- `mapClassToStrategy()` — classifier mode → extractionStrategy (includes `ask-user`)

### Layer 2 — Risk Assessment + Safety UX
- `computeRiskLevel()` — scans OCR text for financial/PII/legal signals → `low|medium|high`
- `updateSafetyNotice()` — shows standard or Secure Mode banner
- `updateArchMetaBar()` — Provider/Mode/Risk/Strategy display bar

### Layer 3 — Output Builders
- `runExcelMode()` — V2.5.1 legacy grid pipeline (simple-table only)
- `runDocModeV3()` — reading-order block text (document type)
- `buildTxtFromNormalizedDoc()` — plain-text from blocks
- `buildJsonFromNormalizedDoc()` — schema v3 JSON (auditable, strips PII fields)
- Legacy: `buildXLSXFromSchema()`, `buildSVGFromSchema()`, `buildCSVFromSchema()`

## normalizedDocumentJSON V3 Schema

```json
{
  "version": "v3",
  "documentType": "simple-table | structured-form | document | uncertain",
  "riskLevel": "low | medium | high",
  "extractionStrategy": "excel | form | doc | ask-user",
  "confidence": 0–1,
  "providerMeta": {
    "name": "google-document-ai | azure-document-intelligence | aws-textract | paddleocr | legacy-canvas-grid | mock",
    "processingTime": ms,
    "ocrEngine": string,
    "replaceable": true
  },
  "blocks": [
    { "id", "blockType": "table|kv-pair|paragraph|heading|list|unknown",
      "confidence", "bbox", "readingOrder",
      "content": { "text?", "key?", "value?", "rows?:[{cells:[]}]" } }
  ],
  "tables": [],
  "forms": [],
  "paragraphs": [],
  "meta": { "createdAt", "processingNotes", "_debug", "_noRetain": true }
}
```

See `normalized-document-schema-v3.json` for full JSON Schema with governance rules.

## Extraction Strategy Routing

| documentType | Strategy | Runner | Black Cell Detection |
|---|---|---|---|
| `simple-table` | `excel` | `runExcelMode` → V2.5.1 grid | ✅ allowed |
| `document` | `doc` | `runDocModeV3` → block reading-order | ❌ blocked |
| `structured-form` | `ask-user` | `showModeGateCard` → user chooses | only if user forces Excel |
| `uncertain` | `ask-user` | `showModeGateCard` → user chooses | only if user forces Excel |

## Risk Level Assessment

| Level | Triggers |
|---|---|
| `high` | Contract, national ID, medical record, shareholder, financial figures, confidential, court, insurance |
| `medium` | Phone, address, date patterns, invoice/receipt, quotation, structured-form by type |
| `low` | All others |

## Safety Design

**Fixed safety notice** (always visible under upload zone):
> "文件僅用於本次轉換。本系統不會保存你的原始圖片、辨識文字或輸出檔案。"

**Secure Mode notice** (medium or high risk):
> "安全處理模式已啟用。文件僅用於本次轉換。"

**Landing page security section**: 3-card layout (no image / no text / no output retention)

## Provider Adapter Interface

```js
// Interface contract (any provider implements this):
function providerAdapter(ocrResult, file, grid, classification) → normalizedDocumentJSON

// Active: Google Document AI adapter
function googleDocumentAIAdapter(ocrResult, file, grid, classification)

// Planned (drop-in replaceable):
// azureDocumentIntelligenceAdapter(...)
// awsTextractAdapter(...)
// paddleOCRAdapter(...)
// mockAdapter(...)
```

`replaceable: true` in providerMeta signals this is an adapter, not a hardcoded pipeline.

## Governance Rules (from schema)

**Audit trail MAY record:** processingTime, documentType, riskLevel, extractionStrategy, provider, success/failure, errorType, credits

**Audit trail MUST NOT record:** documentFullText, phoneNumbers, addresses, financialFigures, customerPII

**LLM Vision policy:** Only as optional fallback for low-confidence local blocks, NOT as primary parser for full sensitive documents.

**_noRetain: true** on all normalizedDocumentJSON — never persist.

## What Was Removed from V2.8

- `runDocModeV28` → replaced by `runDocModeV3` (cleaner, uses blocks)
- `riskLevel: "elevated"` → unified to `"medium"` (V3 schema uses low/medium/high only)
- V2.7 `runDocMode` → fully superseded by `runDocModeV3`

## What Was Preserved from V2.x

- SVG download (downloadSvg + PAD_X fix from V2.5.1)
- Data Preview scroll (65vh)
- Row gap placeholder reconstruction (V2.5)
- Credits logic (`consumeCreditForOCR`) — only successful new-image OCR charges 1 credit
- V2.7.1 4-class classifier
- V2.6.1 isPureNumber guards
- V2.5.1 legacy Excel flow (for simple-table)
- Demo Mode + Layout-only mode + OCR text mode

## Files

| File | Location | Purpose |
|---|---|---|
| `v3-prototype.html` | GitHub root | Main V3 prototype |
| `normalized-document-schema-v3.json` | GitHub root | Schema spec for integrators |
| `V3_ARCHITECTURE_NOTES.md` | GitHub root | This file |
| `README_V3_TESTING.md` | GitHub root | Testing guide |

## Test Matrix

| Document | Expected documentType | Strategy | Mode Gate |
|---|---|---|---|
| Menu / price list | simple-table | excel | No |
| Shareholder notice | document or uncertain | doc / ask-user | Yes (if uncertain) |
| Machine maintenance form | structured-form | ask-user | Yes |
| Re-upload (state reset) | fresh classification | varies | — |
