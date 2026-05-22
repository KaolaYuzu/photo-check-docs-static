# V2.8 Document Understanding + Secure Extraction Architecture — Notes

## Development Base
V2.7.1 (4-class router). V2.7.x parameter tuning stopped. Architecture refactored.

## Pipeline
```
Upload → resetAllPreviousState → Safety Notice
       → startOCR → detectGridFromCanvas → classifyDocumentType (V2.7.1 4-class)
       → runExtractionPipeline
             → googleDocumentAIAdapter → normalizedDocumentJSON
             → computeRiskLevel → updateSafetyNotice
             → updateArchMetaBar
             → Strategy Router:
                   simple-table    → runExcelMode (legacy grid pipeline)
                   doc-like        → runDocModeV28 (blocks-based)
                   structured-form → showModeGateCard
                   uncertain       → showModeGateCard
```

## New / Modified Functions

| Function | Type | Description |
|----------|------|-------------|
| `createNormalizedDoc(opts)` | New | Creates empty normalizedDocumentJSON shell |
| `googleDocumentAIAdapter(ocr, file, grid, cls)` | New | Provider adapter: OCR → normalizedDocumentJSON |
| `mapClassToDocType(mode)` | New | V2.7.1 mode → normalizedDocumentJSON documentType |
| `mapClassToStrategy(mode)` | New | V2.7.1 mode → extractionStrategy |
| `computeRiskLevel(ocrResult, cls)` | New | Scans OCR text for financial/PII/legal signals |
| `updateSafetyNotice(riskLevel)` | New | Shows standard or high-risk safety notice |
| `updateArchMetaBar(normalizedDoc)` | New | Updates provider/mode/risk/strategy bar |
| `buildTxtFromNormalizedDoc(doc)` | New | TXT output from normalizedDoc.blocks |
| `buildJsonFromNormalizedDoc(doc)` | New | JSON export (strips internal debug fields per §6 audit rules) |
| `runExtractionPipeline(ocr, file, grid, cls)` | New | Main V2.8 entry: adapter → risk → arch bar → strategy router |
| `runDocModeV28(ocrResult, nDoc)` | New | Doc Mode using normalizedDoc blocks (richer than V2.7 runDocMode) |
| `resetAllPreviousState()` | Modified | Now clears `normalizedDoc`, resets safety notice, hides arch-meta-bar |
| `forceExcelModeFromGate()` | Modified | Updates normalizedDoc.extractionStrategy before running Excel Mode |
| `forceDocModeFromGate()` | Modified | Calls runDocModeV28 with normalizedDoc |
| `docDownloadJson()` | Modified | Uses buildJsonFromNormalizedDoc when normalizedDoc is available |

## normalizedDocumentJSON Schema

```json
{
  "version": "v2.8",
  "documentType": "simple-table | structured-form | document | unknown",
  "riskLevel": "standard | elevated | high",
  "extractionStrategy": "excel | form | doc | unknown",
  "confidence": 0–1,
  "providerMeta": { "name", "processingTime", "ocrEngine" },
  "blocks": [
    { "id", "blockType": "table|kv-pair|paragraph|heading|list|unknown",
      "confidence", "bbox", "readingOrder",
      "content": { "text?", "key?", "value?", "rows?:[{cells:[]}]" } }
  ],
  "tables": [],     // refs to table blocks
  "forms": [],      // refs to kv-pair blocks
  "paragraphs": [], // refs to paragraph/heading/list blocks
  "meta": { "createdAt", "processingNotes", "_debug", "_noRetain": true }
}
```

See `normalized-document-schema.json` for full JSON Schema.

## Extraction Strategy Routing Conditions

| Classifier Mode | Strategy | Runner |
|----------------|----------|--------|
| `simple-table` | `excel` | `runExcelMode` → legacy V2.5.1 grid pipeline |
| `doc-like` | `doc` | `runDocModeV28` → block-reading-order TXT |
| `structured-form` | `form` | `showModeGateCard` (user chooses) |
| `uncertain` | `unknown` | `showModeGateCard` (user chooses) |

## Risk Level Detection

**High:** contract, 身分證, passport, medical, shareholder, financial figures (\$XXX), confidential, court  
**Elevated:** phone, address, date patterns, total/invoice/receipt keywords, structured-form by type  
**Standard:** all others

Triggers: `computeRiskLevel()` runs regex on all OCR word text. High-risk → secure mode safety notice shown.

## Safety Architecture

**Always visible:** "文件僅用於本次轉換。本系統不會保存你的原始圖片、辨識文字或輸出檔案。"  
**High/elevated risk:** Replaces base notice with "安全處理模式已啟用" banner.

`_noRetain: true` flag on all normalizedDocumentJSON objects.

## Audit Trail Compliance (§6)
`buildJsonFromNormalizedDoc()` exports: documentType, extractionStrategy, confidence, provider, processingTime, blocks (content only). Does NOT export: OCR raw text of sensitive fields, phone/address/financial numbers, _debug internal data.

## Provider Interface
`extractDocument(image, options) → normalizedDocumentJSON` abstraction ready. Currently `googleDocumentAIAdapter` is the only implementation. Future: Azure Document Intelligence, AWS Textract, local/offline adapter.

## V2.5.1 Legacy Fallback
`runExcelMode` still calls `mapOCRToSchemaV21 → reconstructGridSchema → detectGridFromCanvas`. This legacy path is preserved but only triggered for `simple-table` classification.

## Unchanged
- SVG download (downloadSvg + PAD_X fix)
- Data Preview scroll (65vh)
- Row gap reconstruction
- Credits logic
- V2.7.1 4-class classifier
- V2.6.1 isPureNumber guards
- index.html, api/ocr.js, vercel.json
